import {
  ECHELLE,
  NOMINAL,
  PADDING_CONTENU_Y,
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
  return hauteurContenu(format) - 2 * PADDING_CONTENU_Y;
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
 * Calcule la densite d'une affiche.
 *
 * Le seuil de double colonne correspond au point ou le facteur tomberait sous
 * son plancher : au-dela, reduire encore rendrait les noms illisibles en
 * vignette, alors que deux colonnes tiennent confortablement.
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
): Densite {
  const souhaitee = choisirVariante(nbRencontres, format);
  const essai = composer(souhaitee, nbRencontres, nbGroupes, format, hauteurDispo);
  if (essai.tient || souhaitee === 'doubleColonne') return essai.densite;

  // Les planchers de lisibilite de l'en-tete de groupe ne suivent pas le
  // facteur : sur une journee tres fragmentee, ils peuvent consommer plus que
  // ce que le modele de demande prevoyait. Plutot que de rogner en silence —
  // le defaut exact de l'ancien moteur — on passe a la variante suivante.
  return composer('doubleColonne', nbRencontres, nbGroupes, format, hauteurDispo).densite;
}

function composer(
  variante: Variante,
  nbRencontres: number,
  nbGroupes: number,
  format: NomFormat,
  disponible: number,
): { densite: Densite; tient: boolean } {
  const colonnes = variante === 'doubleColonne' ? 2 : 1;
  // En double colonne, chaque colonne ne porte que la moitie du contenu.
  const demande = hauteurDemandee(nbRencontres, nbGroupes) / colonnes;
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

  const pasRangee = Math.min(
    echelonner(NOMINAL.pasRangee, facteur, 0, PLAFONDS.pasRangee),
    rangeesParColonne > 0 ? resteRangees / rangeesParColonne : Infinity,
  );
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
