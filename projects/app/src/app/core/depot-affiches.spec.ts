import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';
import {
  afficheVide,
  dupliquerAffiche,
  EQUIPES_CLUB,
  nouvelleRencontre,
  versDomaine,
  type Affiche,
} from 'poster-core';

import { DepotAffiches } from './depot-affiches';

/**
 * La vraie implementation est testee, pas un double.
 *
 * `fake-indexeddb` fournit une base conforme dans jsdom : c'est donc le chemin
 * de code reel qui est verifie — cle, index, relecture — et non une mecanique
 * d'attente qui ressemblerait a IndexedDB sans en partager les pieges.
 */
function affiche(numero: number, majLe: string): Affiche {
  // Une affiche COMPLETE : le depot refuse un document invalide, et c'est le
  // comportement voulu. La construire a moitie ne testerait que ce refus.
  const editable = afficheVide('adultes', numero, '2026-09-01T10:00:00.000Z');
  editable.groupes[0] = {
    ...editable.groupes[0]!,
    date: '2026-09-19',
    heure: '18:00',
    rencontres: [
      {
        ...nouvelleRencontre(EQUIPES_CLUB[0]!),
        adversaireClubId: 'us-chouzy-tt',
        adversaireLibelle: 'US Chouzy TT',
      },
    ],
  };
  return { ...versDomaine(editable), majLe };
}

describe('DepotAffiches', () => {
  let depot: DepotAffiches;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    depot = TestBed.inject(DepotAffiches);
    await depot.vider();
  });

  it('enregistre puis relit une affiche a l identique', async () => {
    const a = affiche(1, '2026-09-17T10:00:00.000Z');
    await depot.enregistrer(a);
    expect(await depot.lire(a.id)).toEqual(a);
  });

  it('remplace un enregistrement au lieu d en accumuler', async () => {
    const a = affiche(1, '2026-09-17T10:00:00.000Z');
    await depot.enregistrer(a);
    await depot.enregistrer({ ...a, numero: 5 });
    const historique = await depot.historique();
    expect(historique).toHaveLength(1);
    expect(historique[0]!.type === 'ok' && historique[0]!.affiche.numero).toBe(5);
  });

  it('classe l historique du plus recemment modifie au plus ancien', async () => {
    await depot.enregistrer(affiche(1, '2026-09-10T10:00:00.000Z'));
    await depot.enregistrer(affiche(2, '2026-09-17T10:00:00.000Z'));
    await depot.enregistrer(affiche(3, '2026-09-14T10:00:00.000Z'));

    const numeros = (await depot.historique()).map((e) => (e.type === 'ok' ? e.affiche.numero : 0));
    expect(numeros).toEqual([2, 3, 1]);
  });

  it('rend introuvable ce qui n a pas ete enregistre', async () => {
    expect(await depot.lire('inexistant')).toBeUndefined();
  });

  it('supprime une entree', async () => {
    const a = affiche(1, '2026-09-17T10:00:00.000Z');
    await depot.enregistrer(a);
    await depot.supprimer(a.id);
    expect(await depot.historique()).toEqual([]);
  });

  it('conserve une affiche dupliquee a cote de son original', async () => {
    // Le geste hebdomadaire : les deux journees doivent coexister, ce que des
    // identifiants regeneres garantissent.
    const a = affiche(1, '2026-09-10T10:00:00.000Z');
    await depot.enregistrer(a);
    await depot.enregistrer({
      ...dupliquerAffiche(a, '2026-09-17T10:00:00.000Z'),
      majLe: '2026-09-17T10:00:00.000Z',
    });
    expect((await depot.historique()).map((e) => (e.type === 'ok' ? e.affiche.numero : 0))).toEqual(
      [2, 1],
    );
  });

  describe('document d une autre version', () => {
    /** Ecrit sans passer par le depot, comme le ferait un import de sauvegarde. */
    async function ecrireBrut(valeur: unknown): Promise<void> {
      const { openDB } = await import('idb');
      const base = await openDB('ppc-affiches', 1);
      await base.put('affiches', valeur as never);
      base.close();
    }

    it('le signale dans l historique au lieu de l ouvrir en silence', async () => {
      // Le `upgrade` d'IndexedDB ne voit que les documents deja presents : un
      // document importe echappe a sa surveillance. C'est donc la relecture qui
      // protege, et elle doit le dire.
      await ecrireBrut({ ...affiche(1, '2026-09-17T10:00:00.000Z'), versionSchema: 2 });
      const historique = await depot.historique();
      expect(historique[0]!.type).toBe('illisible');
      expect(historique[0]!.type === 'illisible' && historique[0]!.raison).toMatch(/version 2/);
    });

    it('garde son identifiant lisible, pour qu on puisse le supprimer', async () => {
      await ecrireBrut({ id: 'abime', versionSchema: 2 });
      const historique = await depot.historique();
      expect(historique[0]!.type === 'illisible' && historique[0]!.id).toBe('abime');
    });

    it('leve a la lecture directe plutot que de rendre une forme inattendue', async () => {
      await ecrireBrut({ id: 'abime', versionSchema: 2 });
      await expect(depot.lire('abime')).rejects.toThrow(/version 2/);
    });
  });
});
