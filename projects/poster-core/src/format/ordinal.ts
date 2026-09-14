/**
 * Ordinaux francais.
 *
 * L'ancien script ecrivait `1ere` et `12eme` sur l'affiche.
 */

/**
 * Forme ordinale que prend un rang de journee.
 *
 * Le seul cas particulier est le premier rang, et il vit ICI et nulle part
 * ailleurs : deux fonctions rendent le rang, l'une abregee pour la prose et
 * l'autre longue pour l'affiche. Si chacune portait sa propre liste de cas, il
 * suffirait d'en corriger une pour que l'image et le texte de publication se
 * contredisent.
 *
 * Le rang 2 n'en est PAS un : « seconde » serait recevable, le club prefere
 * « 2eme », qui est aussi la forme reguliere.
 */
type FormeRang = 'premiere' | 'ordinaire';

function formeDuRang(rang: number): FormeRang {
  if (!Number.isInteger(rang) || rang < 1) {
    throw new RangeError(`Rang de journee invalide : ${rang}`);
  }
  return rang === 1 ? 'premiere' : 'ordinaire';
}

/**
 * Rang de journee abrege, pour la prose : `1re`, `2e`, `5e`, `11e`.
 *
 * Ce sont les abreviations correctes. « Journee » etant feminin, le rang 1
 * donne `1re` (premiere) et non `1er`.
 */
export function ordinalJournee(rang: number): string {
  return formeDuRang(rang) === 'premiere' ? '1re' : `${rang}e`;
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
 * Rang de journee tel que le club l'ecrit sur l'affiche, en deux morceaux :
 * `1ère`, `2ème`, `5ème`, `11ème`.
 *
 * La forme abregee ci-dessus est celle que recommande l'usage ; le club ecrit
 * la forme longue sur ses affiches et l'a demande explicitement. Elle reste
 * cantonnee au dessin, ou le suffixe est pose en exposant — la seule forme sous
 * laquelle l'usage typographique tolere l'abreviation longue.
 *
 * Le decoupage en deux champs existe pour l'exposant, que l'emetteur SVG ne
 * peut pas obtenir autrement, faute de `<tspan>` de style.
 */
export function rangJourneeParties(rang: number): { chiffre: string; suffixe: string } {
  const suffixe = formeDuRang(rang) === 'premiere' ? 'ère' : 'ème';
  return { chiffre: String(rang), suffixe };
}
