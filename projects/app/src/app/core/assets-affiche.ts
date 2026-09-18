import { Injectable } from '@angular/core';
import { CLUBS, SPONSORS, tirerSponsors, type Affiche, type EntreeSponsor } from 'poster-core';
import {
  fondPour,
  type AssetsAffiche,
  type FacePolice,
  type LogoResolu,
  type SponsorResolu,
} from 'poster-core/render';

import { urlAsset } from '../shared/url-asset';

/**
 * Charge les assets du rendu, et les livre deja resolus.
 *
 * `poster-core` ne lit JAMAIS un fichier — c'est un invariant tenu par ESLint,
 * et precisement ce qui cassait l'ancien script une fois empaquete : ses
 * chemins de polices etaient relatifs au repertoire courant. Tout ce qui vient
 * du reseau ou du disque entre donc par ici, et en ressort en data URL.
 *
 * Tout est memoise. Les polices et le gabarit ne changent pas d'une frappe a
 * l'autre, et l'apercu se redessine a chaque frappe : les recharger a chaque
 * fois en ferait le poste de cout le plus lourd du cycle.
 */
@Injectable({ providedIn: 'root' })
export class AssetsAffiches {
  private polices?: Promise<FacePolice[]>;
  private wasmResvg?: Promise<ArrayBuffer>;
  private readonly logos = new Map<string, Promise<LogoResolu>>();
  private fond?: Promise<AssetsAffiche['fond']>;

  /** Octets du module wasm de resvg, servis depuis les assets de l'application. */
  chargerWasm(): Promise<ArrayBuffer> {
    this.wasmResvg ??= fetch(urlAsset('assets/resvg/index_bg.wasm')).then((r) => r.arrayBuffer());
    return this.wasmResvg;
  }

  /**
   * Faces livrees, lues dans leur manifeste.
   *
   * Le manifeste est la source de verite, et non une liste recopiee ici : une
   * face ajoutee par `tools/build-fonts.mjs` arrive donc sans modification de
   * code, et une face manquante se voit au chargement plutot qu'au rendu.
   */
  chargerPolices(): Promise<FacePolice[]> {
    this.polices ??= (async () => {
      const manifeste = (await (
        await fetch(urlAsset('assets/fonts/fonts.manifest.json'))
      ).json()) as {
        faces: { fichier: string; famille: string; graisse: number }[];
      };

      return Promise.all(
        manifeste.faces.map(async (face) => ({
          famille: face.famille,
          graisse: face.graisse,
          donnees: new Uint8Array(
            await (await fetch(urlAsset(`assets/fonts/${face.fichier}`))).arrayBuffer(),
          ),
        })),
      );
    })();
    return this.polices;
  }

  /**
   * Assets d'une affiche : blason, logos des adversaires, sponsors tires, fond.
   *
   * Les sponsors passent par `tirerSponsors`, donc par la graine du document :
   * deux rendus de la meme affiche montrent les memes partenaires, condition
   * necessaire a un apercu qui ne papillote pas.
   */
  async pourAffiche(affiche: Affiche): Promise<AssetsAffiche> {
    const clubsUtilises = new Set(
      affiche.groupes.flatMap((g) => g.rencontres.map((r) => r.adversaire.clubId)),
    );

    /*
     * Un logo introuvable vaut un logo ABSENT, et non un rendu perdu.
     *
     * La composition sait deja poser un monogramme a la place et le signaler :
     * c'est la degradation prevue pour un club sans logo livre. Laisser la
     * promesse rejeter aurait fait echouer l'affiche entiere pour un fichier
     * manquant — et c'est exactement ce qui arrivait hors ligne.
     */
    const sansEchec = async (id: string) =>
      [id, await this.logoDuClub(id).catch(() => undefined)] as const;

    const [blason, fond, ...logos] = await Promise.all([
      this.logoDuClub('pp-st-georgescher').catch(() => undefined),
      this.chargerFond().catch(() => undefined),
      ...[...clubsUtilises].map(sansEchec),
    ]);

    /*
     * Un partenaire dont l'image ne se charge pas est OMIS, et n'emporte pas
     * le reste.
     *
     * Avec `Promise.all` sur des promesses non protegees, un seul fichier
     * introuvable faisait echouer la composition entiere : l'affiche
     * disparaissait et l'utilisateur lisait « Le rendu a echoue : Failed to
     * fetch » sans savoir de quoi. Mieux vaut une affiche a quatre partenaires
     * qu'aucune affiche, et la composition signale le manque.
     */
    const sponsors: SponsorResolu[] = (
      await Promise.all(
        tirerSponsors(affiche.sponsors).map(async (entree: EntreeSponsor) => {
          try {
            return {
              id: entree.id,
              source: await dataUrl(urlAsset(`assets/sponsors/${entree.fichier}`)),
              largeur: entree.largeur,
              hauteur: entree.hauteur,
            };
          } catch {
            return undefined;
          }
        }),
      )
    ).filter((s): s is SponsorResolu => s !== undefined);

    return {
      blason: blason as LogoResolu,
      // Un club sans logo livre est simplement absent de la table : la
      // composition pose alors un monogramme et le signale.
      logos: new Map(
        (logos as (readonly [string, LogoResolu | undefined])[]).filter(
          (paire): paire is readonly [string, LogoResolu] => paire[1] !== undefined,
        ),
      ),
      sponsors,
      ...(fond ? { fond } : {}),
    };
  }

  private logoDuClub(clubId: string): Promise<LogoResolu | undefined> {
    const entree = (CLUBS as Record<string, (typeof CLUBS)[keyof typeof CLUBS]>)[clubId];
    if (!entree) return Promise.resolve(undefined);

    let promesse = this.logos.get(clubId);
    if (!promesse) {
      promesse = (async () => ({
        source: await dataUrl(urlAsset(`assets/clubs/${entree.fichier}`)),
        largeur: entree.largeur,
        hauteur: entree.hauteur,
      }))();
      // Une promesse rejetee ne doit pas rester en cache : le prochain rendu
      // doit pouvoir retenter, le reseau ayant pu revenir entre-temps.
      promesse.catch(() => this.logos.delete(clubId));
      this.logos.set(clubId, promesse);
    }
    return promesse;
  }

  private chargerFond(): Promise<AssetsAffiche['fond']> {
    this.fond ??= (async () => {
      const entree = fondPour(1080);
      if (!entree) return undefined;
      return {
        source: await dataUrl(urlAsset(`assets/fond/${entree.fichier}`)),
        largeur: entree.largeur,
        hauteur: entree.hauteur,
      };
    })();
    return this.fond;
  }
}

/** Nombre de sponsors attendus par l'affiche, pour memoire. */
export const NB_SPONSORS = Object.keys(SPONSORS).length;

/**
 * Encode un fichier en data URL.
 *
 * L'encodage se fait par TRANCHES : `btoa(String.fromCharCode(...octets))`
 * deborde la pile des arguments au-dela d'une centaine de kilo-octets, et le
 * gabarit en pese cent-soixante-dix.
 */
async function dataUrl(chemin: string): Promise<string> {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`Asset introuvable : ${chemin}`);
  const octets = new Uint8Array(await reponse.arrayBuffer());

  let binaire = '';
  const TRANCHE = 8192;
  for (let i = 0; i < octets.length; i += TRANCHE) {
    binaire += String.fromCharCode(...octets.subarray(i, i + TRANCHE));
  }

  const type = chemin.endsWith('.jpg') || chemin.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
  return `data:${type};base64,${btoa(binaire)}`;
}
