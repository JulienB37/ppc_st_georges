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
