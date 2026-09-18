import { Injectable } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { relireDocument, type Affiche } from 'poster-core';

/**
 * Persistance locale des affiches.
 *
 * IndexedDB et non `localStorage` : les documents sont des objets, pas des
 * chaines, et une saison entiere doit tenir sans se soucier du quota de 5 Mo
 * ni du cout de la serialisation a chaque frappe.
 *
 * DOUBLE VERSIONNEMENT, comme l'exige le plan. `VERSION_BASE` decrit la
 * structure — les magasins, les index — et `versionSchema` decrit chaque
 * document. Les deux sont necessaires et ne se remplacent pas : le `upgrade`
 * d'IndexedDB ne voit que les documents deja presents, alors qu'un document
 * peut arriver par import d'une sauvegarde. C'est donc `relireDocument`, a la
 * LECTURE, qui garantit qu'on ne travaille jamais sur une forme inattendue.
 *
 * Un document illisible n'est ni jete ni ouvert en silence : il est signale,
 * et l'historique le montre comme tel.
 */

/** Structure de la base. A incrementer a chaque changement de magasin ou d'index. */
const VERSION_BASE = 1;
const NOM_BASE = 'ppc-affiches';

interface SchemaBase extends DBSchema {
  affiches: {
    key: string;
    value: Affiche;
  };
}

/** Une entree d'historique, relue ou signalee comme illisible. */
export type EntreeHistorique =
  { type: 'ok'; affiche: Affiche } | { type: 'illisible'; id: string; raison: string };

@Injectable({ providedIn: 'root' })
export class DepotAffiches {
  private base?: Promise<IDBPDatabase<SchemaBase>>;

  /**
   * Ouvre la base a la demande.
   *
   * Paresseux a dessein : un benevole qui ne fait que consulter n'a pas besoin
   * qu'on ouvre une base, et les tests qui n'y touchent pas n'en creent pas.
   */
  private ouvrir(): Promise<IDBPDatabase<SchemaBase>> {
    this.base ??= openDB<SchemaBase>(NOM_BASE, VERSION_BASE, {
      upgrade(base) {
        if (!base.objectStoreNames.contains('affiches')) {
          base.createObjectStore('affiches', { keyPath: 'id' });
        }
      },
    });
    return this.base;
  }

  async enregistrer(affiche: Affiche): Promise<void> {
    const base = await this.ouvrir();
    await base.put('affiches', affiche);
  }

  async supprimer(id: string): Promise<void> {
    const base = await this.ouvrir();
    await base.delete('affiches', id);
  }

  /**
   * Historique, du plus recemment modifie au plus ancien.
   *
   * Chaque document est RELU : la base peut contenir une forme d'une autre
   * version — sauvegarde importee, application revenue en arriere — et
   * l'ouvrir telle quelle reviendrait a lui appliquer un schema qui n'est pas
   * le sien.
   *
   * Le tri se fait en memoire et NON par un index sur `majLe`. Un index ne
   * contient que les enregistrements qui portent la cle indexee : un document
   * abime, sans `majLe`, en serait absent — donc invisible dans l'historique et
   * impossible a supprimer. Un test le verifie. Trier quelques centaines de
   * documents en memoire ne coute rien ; en perdre un coute cher.
   */
  async historique(): Promise<EntreeHistorique[]> {
    const base = await this.ouvrir();
    const bruts = await base.getAll('affiches');
    const parDateDecroissante = [...bruts].sort((a, b) =>
      String((b as { majLe?: unknown }).majLe ?? '').localeCompare(
        String((a as { majLe?: unknown }).majLe ?? ''),
      ),
    );

    return parDateDecroissante.map((brut) => {
      const relecture = relireDocument(brut);
      if (relecture.type === 'ok') return { type: 'ok', affiche: relecture.affiche };
      return {
        type: 'illisible',
        // L'identifiant reste lisible meme si le reste ne l'est pas : c'est ce
        // qui permet de proposer la suppression de l'entree fautive.
        id: String((brut as { id?: unknown }).id ?? '?'),
        raison: relecture.raison,
      };
    });
  }

  async lire(id: string): Promise<Affiche | undefined> {
    const base = await this.ouvrir();
    const brut = await base.get('affiches', id);
    if (!brut) return undefined;
    const relecture = relireDocument(brut);
    if (relecture.type === 'ok') return relecture.affiche;
    throw new Error(relecture.raison);
  }

  /** Vide la base. Reserve aux tests et au « reinitialiser » de secours. */
  async vider(): Promise<void> {
    const base = await this.ouvrir();
    await base.clear('affiches');
  }
}
