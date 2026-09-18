/**
 * Libelle imprime pour une equipe adverse.
 *
 * Le modele separe le CLUB de son EQUIPE : `libelle` nomme le club — c'est ce
 * que le catalogue propose et ce a quoi un logo est attache — et `numero` dit
 * de quelle equipe de ce club il s'agit. Les deux se recomposent ici, et
 * nulle part ailleurs.
 *
 * Sans cette fonction le numero saisi n'apparaissait pas sur l'affiche : le
 * moteur imprimait `libelle` seul. La rencontre y perdait une information que
 * la ligne locale, elle, portait bien (« St Georges 3 »), donnant une affiche
 * dissymetrique ou l'on ne savait pas quelle equipe du club adverse se
 * deplacait.
 *
 * `numero` nul ou zero signifie « aucune equipe designee » : le club joue alors
 * sous son seul nom, ce qui arrive chez les jeunes et dans les clubs a equipe
 * unique. On n'imprime donc pas de « 0 ».
 */
export function libelleAdversaire(adversaire: { libelle: string; numero: number | null }): string {
  return adversaire.numero ? `${adversaire.libelle} ${adversaire.numero}` : adversaire.libelle;
}
