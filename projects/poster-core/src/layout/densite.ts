import {
  ECHELLE,
  NOMINAL,
  PLAFONDS,
  PLANCHERS,
  SEUILS,
  echelonner,
  hauteurContenu,
  type NomFormat,
} from '../render/tokens';

/**
 * Loi de densite de l'affiche.
 *
 * L'ancien moteur incrementait `y` sans borne : au-dela d'environ huit
 * rencontres reparties en trois groupes, le contenu sortait du cadre et etait
 * **silencieusement rogne**. Une journee chargee produisait donc une affiche
 * fausse sans le moindre signal.
 *
 * Un facteur unique pilote desormais toute la geometrie, borne par des
 * planchers de lisibilite independants. Quand meme ces planchers ne suffisent
 * plus, on change de variante de mise en page plutot que de continuer a
 * reduire.
 */

export type Variante = 'duel' | 'liste' | 'doubleColonne';

/**
 * Ce que la mise en page a du faire pour tenir. Remonte jusqu'a l'interface,
 * qui previent l'utilisateur des l'etape « reduit ».
 */
export type Strategie = 'naturel' | 'compact' | 'reduit' | 'colonnes';

export interface Densite {
  variante: Variante;
  strategie: Strategie;
  /** Facteur d'echelle applique a la geometrie nominale. */
  facteur: number;
  pasRangee: number;
  ecartRangee: number;
  hauteurRangee: number;
  diametreLogo: number;
  tailleNom: number;
  hauteurPuce: number;
  taillePuce: number;
  largeurFilet: number;
  hauteurEnteteGroupe: number;
  ecartGroupe: number;
  /** Nombre de colonnes de la zone de contenu. */
  colonnes: 1 | 2;
}

function borner(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur));
}

export function hauteurDisponible(format: NomFormat): number {
  return hauteurContenu(format);
}

/** Hauteur que reclamerait la journee a l'echelle nominale. */
export function hauteurDemandee(nbRencontres: number, nbGroupes: number): number {
  return nbRencontres * NOMINAL.pasRangee + nbGroupes * NOMINAL.blocGroupe;
}

export function choisirVariante(nbRencontres: number, format: NomFormat): Variante {
  if (nbRencontres <= SEUILS.duel) return 'duel';
  if (nbRencontres >= SEUILS.doubleColonne[format]) return 'doubleColonne';
  return 'liste';
}

/**
 * Largeur minimale d'une colonne de rencontres.
 *
 * En deca, une rangee ne peut plus loger deux pastilles de logo, deux noms et
 * le « VS » central : les textes se chevauchent. Mieux vaut alors garder une
 * colonne unique et accepter un facteur d'echelle plus bas.
 */
export const LARGEUR_MIN_COLONNE = 470;

/**
 * Calcule la densite d'une affiche.
 *
 * Le seuil de double colonne correspond au point ou le facteur tomberait sous
 * son plancher. Mais il ne s'applique que si la largeur offerte permet deux
 * colonnes lisibles : sinon la liste reste le seul recours, meme a facteur bas.
 */
export function calculerDensite(
  nbRencontres: number,
  nbGroupes: number,
  format: NomFormat = 'portrait',
  /**
   * Hauteur reellement offerte au contenu. La composition la connait mieux que
   * les jetons : elle depend de la disposition des partenaires et du pied
   * d'affiche. A defaut, on retombe sur la valeur deduite du format.
   */
  hauteurDispo = hauteurDisponible(format),
  /** Largeur offerte au contenu, qui conditionne la double colonne. */
  largeurDispo = Infinity,
  /**
   * Nombre de rencontres par groupe, dans l'ordre.
   *
   * Necessaire en double colonne : la repartition ne coupant jamais un groupe,
   * une colonne peut recevoir bien plus que la moitie du contenu. Sans cette
   * information, le facteur serait calcule sur un partage moitie-moitie que la
   * repartition ne garantit pas, et la colonne la plus chargee deborderait.
   */
  rencontresParGroupe?: readonly number[],
): Densite {
  const deuxColonnesTiennent = largeurDispo / 2 >= LARGEUR_MIN_COLONNE;
  const souhaitee = deuxColonnesTiennent
    ? choisirVariante(nbRencontres, format)
    : // Sans la largeur pour deux colonnes, la liste reste le seul recours.
      choisirVariante(nbRencontres, format) === 'duel'
      ? 'duel'
      : 'liste';
  const essai = composer(
    souhaitee,
    nbRencontres,
    nbGroupes,
    format,
    hauteurDispo,
    rencontresParGroupe,
  );
  if (essai.tient || souhaitee === 'doubleColonne') return essai.densite;

  // Les planchers de lisibilite de l'en-tete de groupe ne suivent pas le
  // facteur : sur une journee tres fragmentee, ils peuvent consommer plus que
  // ce que le modele de demande prevoyait. Plutot que de rogner en silence —
  // le defaut exact de l'ancien moteur — on passe a la variante suivante,
  // sauf si la largeur ne le permet pas.
  if (!deuxColonnesTiennent) return essai.densite;
  return composer(
    'doubleColonne',
    nbRencontres,
    nbGroupes,
    format,
    hauteurDispo,
    rencontresParGroupe,
  ).densite;
}

function composer(
  variante: Variante,
  nbRencontres: number,
  nbGroupes: number,
  format: NomFormat,
  disponible: number,
  rencontresParGroupe?: readonly number[],
): { densite: Densite; tient: boolean } {
  const colonnes = variante === 'doubleColonne' ? 2 : 1;
  const demande =
    colonnes === 2
      ? demandeColonneLaPlusChargee(nbRencontres, nbGroupes, rencontresParGroupe)
      : hauteurDemandee(nbRencontres, nbGroupes);
  const brut = demande > 0 ? disponible / demande : ECHELLE.max;
  const facteur = borner(brut, ECHELLE.min, ECHELLE.max);

  const ecartRangee = echelonner(
    NOMINAL.ecartRangee,
    facteur,
    PLANCHERS.ecartRangee,
    PLAFONDS.ecartRangee,
  );
  const hauteurEnteteGroupe = echelonner(
    NOMINAL.hauteurEnteteGroupe,
    facteur,
    PLANCHERS.hauteurEnteteGroupe,
    PLAFONDS.hauteurEnteteGroupe,
  );
  const ecartGroupe = echelonner(
    NOMINAL.ecartGroupe,
    facteur,
    PLANCHERS.ecartGroupe,
    PLAFONDS.ecartGroupe,
  );

  // Les en-tetes ont leurs propres planchers et ne suivent donc pas toujours
  // le facteur. On mesure ce qu'ils consomment reellement, et le pas de rangee
  // s'ajuste sur ce qui reste : c'est cette correction qui garantit que rien
  // ne depasse, plutot qu'une formule qu'on esperait juste.
  const rangeesParColonne = nbRencontres / colonnes;
  const consommeParEntetes = (nbGroupes / colonnes) * (hauteurEnteteGroupe + ecartGroupe);
  const resteRangees = disponible - consommeParEntetes;

  /*
   * Un creneau peut n'avoir AUCUNE rencontre : c'est l'etat d'un document qu'on
   * commence a saisir, et celui d'un creneau qu'on vient d'ajouter.
   *
   * Le pas de rangee n'a alors pas de sens, mais il ne doit pas pour autant
   * valoir l'infini : la variante duel le reprend tel quel, et cet infini se
   * propageait jusqu'aux coordonnees, ou l'emetteur le voyait arriver en NaN et
   * refusait la scene. L'utilisateur lisait « Coordonnee non finie dans la
   * scene : NaN » alors qu'il n'avait encore rien saisi de faux.
   *
   * Sans rangee a placer, n'importe quelle valeur finie convient : le nominal
   * est la moins surprenante, et garde la geometrie continue quand la premiere
   * rencontre arrive.
   */
  const partEgale = rangeesParColonne > 0 ? resteRangees / rangeesParColonne : NOMINAL.pasRangee;
  // Le duel est la seule variante qui *doit* remplir la hauteur offerte : une
  // ou deux rencontres etalees a 115 px laissent les trois quarts du panneau
  // vides. Les autres variantes gardent leur plafond, sans quoi une journee
  // legere produirait des rangees demesurees.
  const pasRangee =
    variante === 'duel'
      ? partEgale
      : Math.min(echelonner(NOMINAL.pasRangee, facteur, 0, PLAFONDS.pasRangee), partEgale);
  const hauteurRangee = pasRangee - ecartRangee;
  const tient = hauteurRangee >= PLANCHERS.hauteurRangee;

  const strategie: Strategie =
    variante === 'doubleColonne'
      ? 'colonnes'
      : facteur >= 1
        ? 'naturel'
        : facteur >= 0.9
          ? 'compact'
          : 'reduit';

  const densite: Densite = {
    variante,
    strategie,
    facteur,
    pasRangee,
    ecartRangee,
    hauteurRangee,
    diametreLogo: echelonner(
      NOMINAL.diametreLogo,
      facteur,
      PLANCHERS.diametreLogo,
      PLAFONDS.diametreLogo,
    ),
    tailleNom: echelonner(NOMINAL.tailleNom, facteur, PLANCHERS.tailleNom, PLAFONDS.tailleNom),
    hauteurPuce: echelonner(
      NOMINAL.hauteurPuce,
      facteur,
      PLANCHERS.hauteurPuce,
      PLAFONDS.hauteurPuce,
    ),
    taillePuce: echelonner(NOMINAL.taillePuce, facteur, 14, 26),
    largeurFilet: echelonner(NOMINAL.largeurFilet, facteur, PLANCHERS.largeurFilet, 12),
    hauteurEnteteGroupe,
    ecartGroupe,
    colonnes,
  };

  return { densite, tient };
}

/**
 * Hauteur nominale reclamee par la colonne la plus chargee.
 *
 * La repartition ne coupe jamais un groupe : un groupe de cinq rencontres peut
 * donc occuper seul une colonne, bien au-dela de la moitie du contenu. C'est
 * cette colonne, et non la moyenne, qui contraint le facteur d'echelle.
 *
 * Les hauteurs relatives ne dependent pas du facteur — tout s'echelonne
 * ensemble — donc la repartition peut se faire sur les valeurs nominales.
 */
function demandeColonneLaPlusChargee(
  nbRencontres: number,
  nbGroupes: number,
  rencontresParGroupe?: readonly number[],
): number {
  if (!rencontresParGroupe?.length) {
    return hauteurDemandee(nbRencontres, nbGroupes) / 2;
  }
  const nominales = rencontresParGroupe.map((n) => n * NOMINAL.pasRangee + NOMINAL.blocGroupe);
  const [gauche, droite] = repartirEnColonnes([...nominales], (h) => h);
  const somme = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
  return Math.max(somme(gauche), somme(droite), 1);
}

/**
 * Repartit des groupes en deux colonnes de hauteurs voisines, sans jamais
 * couper un groupe.
 *
 * Remplissage glouton : on verse dans la colonne la moins chargee. Suffisant
 * ici, ou un groupe compte rarement plus de cinq rencontres.
 */
export function repartirEnColonnes<T>(groupes: T[], hauteurDe: (groupe: T) => number): [T[], T[]] {
  const gauche: T[] = [];
  const droite: T[] = [];
  let hGauche = 0;
  let hDroite = 0;

  for (const groupe of groupes) {
    const h = hauteurDe(groupe);
    if (hGauche <= hDroite) {
      gauche.push(groupe);
      hGauche += h;
    } else {
      droite.push(groupe);
      hDroite += h;
    }
  }
  return [gauche, droite];
}
