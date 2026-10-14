/**
 * Les equipes du club, dans l'ordre.
 *
 * Le rang d'une equipe et sa division ne sont pas deux informations
 * independantes : l'equipe 1 joue en R2, la 2 en R3, et ainsi de suite. Les
 * saisir separement, comme le faisait l'ancien script, ouvrait la porte a
 * « D2 (3) » — une combinaison qui n'existe pas — et obligeait a retaper un
 * numero que la division determine deja.
 *
 * La saisie se fait donc sur UN champ. Le numero est l'identite stable de
 * l'equipe ; la division est son etiquette, qui change au gre des montees et
 * des descentes.
 *
 * L'ordre est celui fourni par le club le 17 septembre 2026, et il concorde
 * avec la configuration historique — « R2 (1) », « R3 (2) », « D1 (5) »... a
 * trois etiquettes pres, que le club a precisees depuis : les deux equipes
 * notees « PR » deviennent PR1 et PR2, et la huitieme passe de D3 a D4.
 *
 * Les jeunes n'engagent qu'UNE equipe, en D1 jeune : leur table est distincte,
 * et c'est la categorie de l'affiche qui choisit laquelle s'applique.
 */

import type { Categorie } from '../model/journee';

export interface EquipeClub {
  /** Rang de l'equipe au sein du club, imprime entre parentheses. */
  numero: number;
  /** Pastille de division affichee. */
  division: string;
}

export const EQUIPES_CLUB: readonly EquipeClub[] = [
  { numero: 1, division: 'R2' },
  { numero: 2, division: 'R3' },
  { numero: 3, division: 'PR1' },
  { numero: 4, division: 'PR2' },
  { numero: 5, division: 'D1' },
  { numero: 6, division: 'D2' },
  { numero: 7, division: 'D3' },
  { numero: 8, division: 'D4' },
] as const;

export const EQUIPES_JEUNES: readonly EquipeClub[] = [{ numero: 1, division: 'D1 jeune' }] as const;

/** Table des equipes d'une categorie d'affiche. */
export function equipesDe(categorie: Categorie): readonly EquipeClub[] {
  return categorie === 'jeunes' ? EQUIPES_JEUNES : EQUIPES_CLUB;
}

export function equipeParDivision(
  division: string,
  categorie: Categorie = 'adultes',
): EquipeClub | undefined {
  return equipesDe(categorie).find((e) => e.division === division);
}

export function equipeParNumero(numero: number): EquipeClub | undefined {
  return EQUIPES_CLUB.find((e) => e.numero === numero);
}

/**
 * Premiere equipe non encore engagee dans la journee.
 *
 * Une equipe ne joue qu'une fois par journee : proposer la suivante libre evite
 * de choisir a chaque ajout, et evite surtout de l'engager deux fois. Quand les
 * equipes sont prises — cas qui n'arrive que par erreur de saisie, ou chez les
 * jeunes qui n'en ont qu'une — on rend la derniere plutot que rien, pour que
 * le bouton reste utilisable.
 */
export function equipeLibreSuivante(
  numerosUtilises: readonly number[],
  categorie: Categorie = 'adultes',
): EquipeClub {
  const equipes = equipesDe(categorie);
  const pris = new Set(numerosUtilises);
  return equipes.find((e) => !pris.has(e.numero)) ?? equipes[equipes.length - 1]!;
}

/**
 * Options a proposer, la valeur courante comprise meme si elle est inconnue.
 *
 * Un document importe peut porter une etiquette qui n'est plus dans la table —
 * « PR » ou un second « D3 », venus de la configuration historique. La
 * conserver dans la liste evite de l'effacer en silence : l'utilisateur voit ce
 * qui est reellement enregistre et decide lui-meme de l'aligner.
 */
export function optionsDivision(
  divisionCourante: string,
  categorie: Categorie = 'adultes',
): EquipeClub[] {
  const equipes = equipesDe(categorie);
  if (!divisionCourante || equipeParDivision(divisionCourante, categorie)) return [...equipes];
  return [...equipes, { numero: 0, division: divisionCourante }];
}
