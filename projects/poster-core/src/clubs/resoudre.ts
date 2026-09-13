import type { EntreeClub } from './registre.generated';
import { clubIdDepuisLibelle, normaliserNomClub } from './normaliser';

/**
 * Rapprochement d'un nom saisi vers un club connu.
 *
 * L'ancien script n'avait que deux issues : le fichier existe, ou bien
 * `default.png` et une ligne dans la console. Un logo pouvait donc etre faux
 * pendant des mois sans que personne le sache.
 *
 * On distingue desormais trois cas, dont un intermediaire : une correspondance
 * approchee n'est JAMAIS appliquee d'office, elle est proposee. C'est a
 * l'utilisateur de confirmer, et sa confirmation devient un alias — la
 * prochaine journee resoudra directement.
 */
export type ResolutionClub =
  | { type: 'exact'; club: EntreeClub }
  | { type: 'suggestion'; club: EntreeClub; score: number }
  | { type: 'absent'; normalise: string };

export interface IndexClubs {
  /** Identifiants et alias confondus, tous sous forme normalisee. */
  readonly parCle: ReadonlyMap<string, EntreeClub>;
  readonly tous: readonly EntreeClub[];
}

/**
 * Construit l'index de rapprochement.
 *
 * Les clubs ajoutes par l'utilisateur sont passes apres ceux livres avec
 * l'application : a cle egale, le dernier l'emporte, ce qui permet de corriger
 * un logo perime sans attendre une mise a jour.
 */
export function construireIndex(...sources: Iterable<EntreeClub>[]): IndexClubs {
  const parCle = new Map<string, EntreeClub>();
  const tous: EntreeClub[] = [];

  for (const source of sources) {
    for (const club of source) {
      tous.push(club);
      parCle.set(club.id, club);
      for (const alias of club.alias) parCle.set(alias, club);
    }
  }
  return { parCle, tous };
}

/** Bigrammes d'une chaine : `aze-tt` -> az, ze, e-, -t, tt. */
function bigrammes(texte: string): Map<string, number> {
  const sortie = new Map<string, number>();
  for (let i = 0; i < texte.length - 1; i++) {
    const paire = texte.slice(i, i + 2);
    sortie.set(paire, (sortie.get(paire) ?? 0) + 1);
  }
  return sortie;
}

/**
 * Coefficient de Sorensen-Dice sur bigrammes, entre 0 et 1.
 *
 * Preferable a une distance d'edition ici : il tolere bien l'ajout ou le
 * retrait d'un mot entier (« ASJ La Chaussee St Victor » contre « La Chaussee
 * St Victor »), cas de loin le plus frequent sur les feuilles de match.
 */
export function similarite(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const ba = bigrammes(a);
  const bb = bigrammes(b);
  let communs = 0;
  let totalA = 0;
  for (const [paire, n] of ba) {
    totalA += n;
    communs += Math.min(n, bb.get(paire) ?? 0);
  }
  const totalB = [...bb.values()].reduce((t, n) => t + n, 0);
  return (2 * communs) / (totalA + totalB);
}

export interface OptionsResolution {
  /** En deca, on prefere avouer l'echec plutot que proposer n'importe quoi. */
  seuilSuggestion?: number;
}

const SEUIL_DEFAUT = 0.82;

/**
 * Resout « Gien AS TT 1 » vers le club Gien AS TT.
 *
 * Le numero d'equipe final est retire avant toute comparaison : c'est le club
 * qu'on cherche, pas l'equipe.
 */
export function resoudreClub(
  libelle: string,
  index: IndexClubs,
  options: OptionsResolution = {},
): ResolutionClub {
  const cle = clubIdDepuisLibelle(libelle);

  const direct = index.parCle.get(cle);
  if (direct) return { type: 'exact', club: direct };

  const seuil = options.seuilSuggestion ?? SEUIL_DEFAUT;
  let meilleur: { club: EntreeClub; score: number } | null = null;

  for (const club of index.tous) {
    // On compare a l'identifiant et a chacun de ses alias, en gardant le
    // meilleur score : un club peut etre connu sous plusieurs formes.
    for (const candidat of [club.id, ...club.alias]) {
      const score = similarite(cle, candidat);
      if (!meilleur || score > meilleur.score) meilleur = { club, score };
    }
  }

  if (meilleur && meilleur.score >= seuil) {
    return { type: 'suggestion', club: meilleur.club, score: meilleur.score };
  }
  return { type: 'absent', normalise: cle };
}

/**
 * Classe les clubs par pertinence pour l'autocompletion.
 *
 * Le rapprochement par prefixe de jetons prime sur la similarite globale :
 * en tapant « bloi 41 », on attend « Blois Ping 41 » en tete, ce qu'un simple
 * score de similarite ne garantit pas.
 */
export function chercherClubs(saisie: string, index: IndexClubs, limite = 8): EntreeClub[] {
  const requete = normaliserNomClub(saisie).trim();
  if (!requete) return [...index.tous].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));

  const jetons = requete.split('-').filter(Boolean);

  const notes = index.tous.map((club) => {
    const cibles = [club.id, ...club.alias];
    const motsCible = club.id.split('-');

    const tousJetonsPresents = jetons.every((jeton) =>
      motsCible.some((mot) => mot.startsWith(jeton)),
    );
    const meilleureSimilarite = Math.max(...cibles.map((c) => similarite(requete, c)));

    return { club, note: (tousJetonsPresents ? 1 : 0) + meilleureSimilarite };
  });

  return notes
    .filter((n) => n.note > 0.3)
    .sort((a, b) => b.note - a.note || a.club.libelle.localeCompare(b.club.libelle, 'fr'))
    .slice(0, limite)
    .map((n) => n.club);
}
