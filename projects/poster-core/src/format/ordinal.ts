/**
 * Ordinaux francais.
 *
 * L'ancien script ecrivait `1ere` et `12eme` sur l'affiche. Les abreviations
 * correctes sont `1re` et `12e`. « Journee » etant feminin, le rang 1 donne
 * `1re` (premiere) et non `1er`.
 */
export function ordinalJournee(rang: number): string {
  if (!Number.isInteger(rang) || rang < 1) {
    throw new RangeError(`Rang de journee invalide : ${rang}`);
  }
  return rang === 1 ? '1re' : `${rang}e`;
}

/**
 * Ordinal d'un quantieme de mois : `1er`, puis `2`, `3`... (« mai » est
 * masculin, et au-dela du premier le quantieme s'ecrit en chiffres nus :
 * on dit « le 9 mai », pas « le 9e mai »).
 */
export function quantiemeMois(jour: number): string {
  if (!Number.isInteger(jour) || jour < 1 || jour > 31) {
    throw new RangeError(`Quantieme invalide : ${jour}`);
  }
  return jour === 1 ? '1er' : String(jour);
}

/**
 * Rang de journee tel que le club l'ecrit sur l'affiche, en deux morceaux.
 *
 * L'abreviation strictement correcte est `1re` / `12e` : c'est ce que rend
 * `ordinalJournee`, et ce qui doit partir dans le texte de publication. Mais
 * le club ecrit `1ere` sur ses affiches et l'a demande explicitement. La forme
 * longue reste donc cantonnee au dessin, ou le suffixe est de toute facon pose
 * en exposant souligne — la ou l'usage typographique la tolere.
 *
 * Le decoupage en deux champs existe pour cela : l'exposant ne peut pas etre
 * obtenu par une balise, l'emetteur SVG n'ayant pas de `<tspan>` de style.
 */
export function rangJourneeParties(rang: number): { chiffre: string; suffixe: string } {
  if (!Number.isInteger(rang) || rang < 1) {
    throw new RangeError(`Rang de journee invalide : ${rang}`);
  }
  return { chiffre: String(rang), suffixe: rang === 1 ? 'ère' : 'ème' };
}
