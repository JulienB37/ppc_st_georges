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
export const HAUTEUR_BANDEAU = 330;
export const HAUTEUR_SPONSORS = 176;
export const PADDING_CONTENU_Y = 24;

export function hauteurContenu(format: NomFormat): number {
  return FORMATS[format].hauteur - HAUTEUR_BANDEAU - HAUTEUR_SPONSORS;
}

/**
 * Palette nocturne.
 *
 * Registre d'affiche d'evenement : fond sombre, halos colores, accents vifs.
 * On perd un peu du confort de lecture de la version claire, ce qui est
 * assume, mais le texte reste blanc sur fond tres sombre — soit un contraste
 * superieur a 12:1, tres au-dessus du 1,6:1 des anciennes affiches.
 */
export const COULEURS = {
  nuit: '#04070E',
  nuitHaute: '#0A1424',
  bleuNuit: '#0E2542',
  bleuHalo: '#1C6FD9',
  rougePpc: '#E4032E',
  rougeHalo: '#FF1F4B',
  magentaHalo: '#B3179B',
  vertJeunes: '#00B25B',
  vertHalo: '#12E07E',
  /** Fond des cartes de rencontre, pose sur le fond nocturne. */
  carte: '#0C1B31',
  carteBord: '#2E5480',
  encre: '#101820',
  blanc: '#FFFFFF',
  ivoire: '#F4F6F8',
  grisLigne: '#D9DEE5',
  /** Texte secondaire sur fond sombre. */
  brume: '#A8BCD6',

  /**
   * Couleurs de projection.
   *
   * Elles n'habillent aucun element d'information : elles ne servent qu'aux
   * eclaboussures, aux coulures et aux bandes dechirees du fond. Une affiche
   * d'evenement tient beaucoup de sa vitalite de cette gamme large, la ou deux
   * teintes seules donnent un rendu monochrome et terne.
   */
  cyan: '#12C2C9',
  magenta: '#E5007E',
  violet: '#7B2FF7',
  orange: '#FF7A18',
  jauneVif: '#FFC300',
} as const;

/**
 * Teintes des en-tetes de creneau, cyclees par groupe.
 *
 * La reference change de couleur a chaque creneau plutot que de coder le lieu :
 * cela rythme la liste et donne de la vie, le lieu restant porte par son icone
 * et son libelle.
 */
export const TEINTES_CRENEAU = [
  COULEURS.rougePpc,
  COULEURS.cyan,
  COULEURS.violet,
  COULEURS.orange,
] as const;

/** Anneaux des pastilles de logo, cycles par rangee. */
export const TEINTES_ANNEAU = [
  COULEURS.cyan,
  COULEURS.rougeHalo,
  COULEURS.jauneVif,
  COULEURS.violet,
] as const;

/** Gamme projetee sur le fond, hors elements d'information. */
export const PROJECTION = [
  COULEURS.cyan,
  COULEURS.magenta,
  COULEURS.violet,
  COULEURS.orange,
  COULEURS.rougeHalo,
] as const;

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
  /** Accents manuscrits : la chaleur que portait le Comic Sans, en tenue. */
  manuscrit: 'Caveat',
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
  manuscrit: 700,
} as const;

/**
 * Inclinaison des blocs de titre, en degres.
 *
 * Appliquee par `skewX` sur le groupe : Anton n'a pas d'italique, et resvg ne
 * synthetise pas l'oblique — demander `font-style: italic` ne ferait rien.
 */
export const INCLINAISON = -8;

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
  hauteurEnteteGroupe: 80,
  ecartGroupe: 32,
  /** Hauteur consommee par un en-tete de groupe, ecart compris. */
  blocGroupe: 112,
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
  hauteurEnteteGroupe: 58,
  ecartGroupe: 20,
} as const;

export const PLAFONDS = {
  pasRangee: 115,
  ecartRangee: 18,
  diametreLogo: 104,
  tailleNom: 40,
  hauteurPuce: 38,
  hauteurEnteteGroupe: 94,
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

/** Regles de cadrage d'un logo dans sa pastille. */
export const CADRAGE_LOGO = {
  /**
   * Surcote appliquee au plus grand rectangle inscriptible dans le disque.
   *
   * Les angles de la boite d'un logo sont presque toujours vides : s'en tenir
   * au rectangle inscrit exact laisse le logo flotter. Au-dela de 1,1 en
   * revanche, les logos a fond plein commencent a se faire rogner les coins.
   */
  remplissage: 1.06,
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
