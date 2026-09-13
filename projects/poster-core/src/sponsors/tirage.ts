import type { SelectionSponsors } from '../model/journee';
import { SPONSORS, type EntreeSponsor } from './registre.generated';

/**
 * Tirage des sponsors.
 *
 * L'ancien script appelait `Math.random()` sur le resultat d'un parcours de
 * dossier : deux generations de la meme journee ne donnaient jamais la meme
 * affiche, et l'ordre dependait du systeme de fichiers. Impossible a tester,
 * et un apercu en direct aurait papillote a chaque frappe.
 *
 * Ici, meme graine et meme inventaire donnent toujours le meme resultat, sur
 * n'importe quelle machine.
 */

/** Generateur mulberry32 : court, rapide, et suffisant pour un tirage d'affichage. */
function mulberry32(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function graineNumerique(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface OptionsTirage {
  /** Nombre d'affichages deja accordes a chaque sponsor sur la saison. */
  compteurs?: Readonly<Record<string, number>>;
  /** Inventaire a utiliser ; par defaut celui livre avec l'application. */
  inventaire?: Readonly<Record<string, EntreeSponsor>>;
}

/**
 * Resout les trois emplacements d'une affiche.
 *
 * Les emplacements verrouilles gardent leur sponsor. Les autres sont pourvus
 * par rotation equitable : on privilegie les sponsors les moins affiches, et
 * la graine ne departage que les ex aequo. Un sponsor ne peut pas figurer deux
 * fois sur la meme affiche.
 */
export function tirerSponsors(
  selection: SelectionSponsors,
  options: OptionsTirage = {},
): EntreeSponsor[] {
  // Annotation explicite : `SPONSORS` porte des cles litterales, dont l'union
  // avec un inventaire quelconque perd l'indexation par chaine.
  const inventaire: Readonly<Record<string, EntreeSponsor>> = options.inventaire ?? SPONSORS;
  const compteurs = options.compteurs ?? {};

  // Tri par identifiant, jamais par ordre de dossier : c'est ce qui rend le
  // tirage reproductible d'une machine a l'autre.
  const actifs = Object.values(inventaire)
    .filter((s) => s.actif)
    .sort((a, b) => a.id.localeCompare(b.id));

  const retenus: EntreeSponsor[] = [];
  const pris = new Set<string>();

  for (const emplacement of selection.emplacements) {
    if (emplacement.verrouille && emplacement.sponsorId) {
      const fixe = inventaire[emplacement.sponsorId];
      if (fixe) {
        retenus.push(fixe);
        pris.add(fixe.id);
        continue;
      }
    }
    retenus.push(null as unknown as EntreeSponsor);
  }

  const hasard = mulberry32(graineNumerique(selection.graine));
  // Un rang aleatoire stable par sponsor departage les ex aequo sans biaiser
  // l'ordre alphabetique.
  const rangs = new Map(actifs.map((s) => [s.id, hasard()]));

  const candidats = actifs
    .filter((s) => !pris.has(s.id))
    .sort((a, b) => {
      const ecart = (compteurs[a.id] ?? 0) - (compteurs[b.id] ?? 0);
      return ecart !== 0 ? ecart : (rangs.get(a.id) ?? 0) - (rangs.get(b.id) ?? 0);
    });

  let prochain = 0;
  return retenus
    .map((retenu) => retenu ?? candidats[prochain++])
    .filter((s): s is EntreeSponsor => Boolean(s));
}

/** Fait tourner la graine, pour relancer un tirage de facon reproductible. */
export function relancerGraine(graine: string): string {
  const m = /^(.*)-(\d+)$/.exec(graine);
  if (!m) return `${graine}-2`;
  const [, base = graine, rang = '1'] = m;
  return `${base}-${Number(rang) + 1}`;
}
