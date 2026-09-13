/**
 * Jetons de design de l'affiche.
 *
 * Remplacent les nombres magiques de l'ancien moteur (`_teamHeigth = 18`,
 * `.move(118, 68)`, `y + 275`...), dont certains sortaient du cadre sans que
 * rien ne le signale.
 *
 * Le repere passe des unites millimetriques heritees d'Inkscape
 * (`viewBox 0 0 287.05 285.30`) a un repere ou **1 unite = 1 pixel a l'export
 * 1080**. Toutes les valeurs deviennent des entiers lisibles.
 */

/** Formats de publication. Le 4:5 occupe le plus de surface dans un fil mobile. */
export const FORMATS = {
  portrait: { largeur: 1080, hauteur: 1350 },
  carre: { largeur: 1080, hauteur: 1080 },
} as const;

export type NomFormat = keyof typeof FORMATS;

export const MARGE_X = 48;
/** Largeur utile entre marges. */
export const LARGEUR_UTILE = FORMATS.portrait.largeur - 2 * MARGE_X;
export const HAUTEUR_BANDEAU = 236;
export const HAUTEUR_SPONSORS = 176;
export const PADDING_CONTENU_Y = 24;

export function hauteurContenu(format: NomFormat): number {
  return FORMATS[format].hauteur - HAUTEUR_BANDEAU - HAUTEUR_SPONSORS;
}

/**
 * Palette.
 *
 * Le contraste de la zone de contenu passe de 1,6:1 (gelules blanches sur
 * panneau #cbcbcb) a 8,9:1. A la taille ou l'affiche est reellement vue —
 * vignette d'environ 400 px dans un fil mobile — c'etait le defaut le plus
 * couteux de l'ancienne maquette.
 */
export const COULEURS = {
  bleuProfond: '#0A2C4C',
  bleuTable: '#12497A',
  bleuLigne: '#1C5E96',
  rougePpc: '#E4032E',
  rougeOmbre: '#B00224',
  vertJeunes: '#00B25B',
  encre: '#101820',
  blanc: '#FFFFFF',
  ivoire: '#F4F6F8',
  grisLigne: '#D9DEE5',
} as const;

export const OPACITES = {
  secondaire: 0.88,
  tertiaire: 0.62,
  motif: 0.08,
  filet: 0.3,
} as const;

/**
 * Familles typographiques.
 *
 * Valeurs litterales : l'emetteur SVG n'accepte aucune autre chaine, ce qui
 * interdit de reintroduire une famille generique. L'ancien template reference
 * `font-family:Sans`, famille fantome que le code compensait par un mapping
 * artificiel vers Comic Sans MS.
 */
export const POLICES = {
  display: 'Anton',
  texte: 'Barlow Semi Condensed',
} as const;

export type FamillePolice = (typeof POLICES)[keyof typeof POLICES];

/**
 * Graisses livrees, et elles seules.
 *
 * resvg ne synthetise pas le gras : demander une graisse non livree ferait
 * rendre la face la plus proche, en silence.
 */
export const GRAISSES = {
  display: 400,
  courant: 500,
  appuye: 600,
  fort: 700,
} as const;

/** Interlettrage, en fraction du corps. */
export const INTERLETTRAGE = {
  capitales: 0.07,
  display: -0.01,
  courant: 0,
} as const;

/** Espacements, base 8. */
export const ESPACES = { s1: 8, s2: 12, s3: 16, s4: 24, s5: 32, s6: 48, s7: 64, s8: 96 } as const;

export const RAYONS = { puce: 6, carte: 16, drapeau: 16, filet: 4, onglet: 999 } as const;

export const TRAITS = {
  contourPastille: 2,
  ongletExterieur: 2.5,
  anneauBlason: 5,
  regle: 6,
  motif: 6,
} as const;

/**
 * Geometrie nominale d'une rangee de rencontre, avant application du facteur
 * de densite.
 */
export const NOMINAL = {
  pasRangee: 100,
  ecartRangee: 12,
  diametreLogo: 80,
  tailleNom: 34,
  hauteurPuce: 32,
  taillePuce: 22,
  largeurFilet: 8,
  hauteurEnteteGroupe: 64,
  ecartGroupe: 32,
  /** Hauteur consommee par un en-tete de groupe, ecart compris. */
  blocGroupe: 96,
} as const;

/**
 * Planchers de lisibilite.
 *
 * Independants du facteur d'echelle : en deca, l'affiche cesse de remplir sa
 * fonction en vignette, et il vaut mieux changer de variante de mise en page.
 */
export const PLANCHERS = {
  tailleNom: 20,
  diametreLogo: 44,
  largeurFilet: 6,
  hauteurRangee: 52,
  ecartRangee: 8,
  hauteurPuce: 22,
  hauteurEnteteGroupe: 44,
  ecartGroupe: 20,
} as const;

export const PLAFONDS = {
  pasRangee: 115,
  ecartRangee: 18,
  diametreLogo: 104,
  tailleNom: 40,
  hauteurPuce: 38,
  hauteurEnteteGroupe: 78,
  ecartGroupe: 44,
} as const;

/** Bornes du facteur de densite. */
export const ECHELLE = { min: 0.62, max: 1.15 } as const;

/**
 * Seuils de bascule entre variantes.
 *
 * Le seuil de double colonne correspond au point ou le facteur d'echelle
 * tomberait sous son plancher. Il descend a 8 en carre : c'est la
 * justification chiffree du portrait par defaut, la journee type du club
 * comptant 8 rencontres.
 */
export const SEUILS = {
  duel: 3,
  doubleColonne: { portrait: 11, carre: 8 },
} as const;

/** Regles de cadrage d'un logo dans sa pastille, selon son rapport largeur/hauteur. */
export const CADRAGE_LOGO = {
  ratioCarreMin: 0.8,
  ratioCarreMax: 1.25,
  /**
   * Cote de la boite carree inscrite. Legerement au-dela du carre inscrit
   * exact (0,707) : les angles de la boite sont presque toujours vides, et
   * s'en tenir au carre exact laissait les logos flotter dans leur pastille.
   */
  facteurCarre: 0.78,
  facteurLargeW: 0.9,
  facteurLargeHMax: 0.64,
  facteurHaut: 0.86,
  /** Corps du monogramme de repli, en fraction du diametre. */
  facteurMonogramme: 0.34,
} as const;

export const SPONSORS_MEP = {
  largeurCellule: 232,
  hauteurCellule: 116,
  ecart: 18,
  retrait: 12,
  x0: 300,
  /** Un logo presque carre parait plus lourd qu'un logo large a surface egale. */
  reductionCarre: 0.9,
  ratioLarge: 1.4,
} as const;

/** Applique le facteur de densite, borne par un plancher et un plafond. */
export function echelonner(nominal: number, facteur: number, plancher = 0, plafond = Infinity) {
  return Math.min(plafond, Math.max(plancher, nominal * facteur));
}

/** Couleur d'accent de l'affiche : rouge pour les adultes, vert pour les jeunes. */
export function accent(categorie: 'adultes' | 'jeunes'): string {
  return categorie === 'jeunes' ? COULEURS.vertJeunes : COULEURS.rougePpc;
}
