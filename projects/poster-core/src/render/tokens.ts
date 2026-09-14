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

/**
 * Formats de publication.
 *
 * Le portrait suit le gabarit fourni par le club, qui est en 2:3. Facebook
 * recadre en 4:5 dans le fil mais l'affiche entiere reste visible au clic.
 */
export const FORMATS = {
  portrait: { largeur: 1080, hauteur: 1620 },
  carre: { largeur: 1080, hauteur: 1080 },
} as const;

export type NomFormat = keyof typeof FORMATS;

/**
 * Panneaux noirs du gabarit fourni par le club, mesures sur l'image et
 * convertis dans le repere 1080 x 1620 :
 *   - contenu      : x 36-813,   y 494-1390  (777 x 896)
 *   - partenaires  : x 831-1069, y 620-1350  (238 x 730)
 *
 * Ce ne sont pas des choix de mise en page, ce sont des mesures : le gabarit
 * peint deja le blason, le titre, « LES RENCONTRES », les deux accroches
 * manuscrites et « Nos partenaires ». La composition ne fait que s'inscrire
 * dans les deux reserves laissees libres.
 */
export const PANNEAUX = {
  contenu: { x: 36, y: 494, largeur: 777, hauteur: 896 },
  partenaires: { x: 831, y: 620, largeur: 238, hauteur: 730 },
} as const;

/** Marge interieure des panneaux, pour ne pas coller a leur bord arrondi. */
export const RETRAIT_PANNEAU = 18;

/**
 * Bande peinte rouge du gabarit, sous « LES RENCONTRES ».
 *
 * Mesuree en cherchant, ligne par ligne, la plus longue plage de pixels
 * franchement rouges du gabarit, trou de 12 px tolere — le trace est
 * mouchete. La plage utile s'ouvre a y 396 et se referme a y 448, la plus
 * large courant de x 296 a x 608 vers y 427. Le rang de journee s'y inscrit :
 * c'est la place que le gabarit lui reserve, et il n'a donc plus besoin de sa
 * propre pastille de fond.
 *
 * La boite deborde volontairement de quelques pixels la plage mesuree. Les
 * titres du gabarit debordent eux aussi leur coup de pinceau : s'en tenir au
 * rouge strict donnait un rang de journee timide sous un « LES RENCONTRES »
 * deux fois plus haut.
 */
export const BANDE_JOURNEE = { x: 278, y: 394, largeur: 330, hauteur: 56 } as const;

/**
 * Cadre du format carre, qui n'a pas encore de gabarit.
 *
 * Il retombe donc sur une geometrie calculee — bandeau de titre en haut, bande
 * de partenaires en bas — la ou le portrait lit ses reserves sur l'image.
 */
const HAUTEUR_BANDEAU_CARRE = 330;
const HAUTEUR_SPONSORS_CARRE = 176;

/** Hauteur reellement offerte au contenu, retrait interieur deduit. */
export function hauteurContenu(format: NomFormat): number {
  return format === 'portrait'
    ? PANNEAUX.contenu.hauteur - 2 * RETRAIT_PANNEAU
    : FORMATS.carre.hauteur - HAUTEUR_BANDEAU_CARRE - HAUTEUR_SPONSORS_CARRE;
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
 *
 * Les trois premieres sont reprises d'une maquette fournie par le club, puis
 * FONCEES d'un tiers — chaque canal multiplie par 2/3. Elles ne renvoient PLUS
 * a la gamme de projection : celle-ci sert au decor, et la confondre avec les
 * teintes de creneau ferait deriver l'une avec l'autre. Le rouge d'identite
 * `rougePpc` en est egalement distinct, pour la meme raison.
 *
 * L'assombrissement a un effet mesurable sur la lisibilite du texte blanc pose
 * dessus : le contraste passe de 4,8 a 8,8:1 sur le rouge, de 2,8 a 5,7:1 sur
 * le turquoise et de 6,1 a 10,2:1 sur le violet. Le turquoise clair etait donc
 * sous le seuil AA de 4,5:1 — le defaut meme que cette refonte corrige.
 *
 * Teintes de depart estimees a l'oeil sur la maquette, faute de pouvoir en
 * echantillonner les pixels. A reprendre par la mesure si le fichier est fourni.
 */
export const TEINTES_CRENEAU = [
  /** Rouge framboise sombre : un cran plus rose que le rouge d'identite. */
  '#941232',
  /** Turquoise profond, plus vert que le cyan de projection. */
  '#157178',
  /** Violet amethyste, et non le violet electrique de la gamme de projection. */
  '#5D2A74',
  /**
   * Quatrieme creneau, rare : trois suffisent a une journee ordinaire, mais la
   * loi de densite en accepte quatre.
   */
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
 * Rotation des textes poses sur les bandes peintes du gabarit, en degres.
 *
 * Mesuree par regression sur le centroide vertical des bandes, colonne par
 * colonne : -7,24 deg sur la bande blanche de « LES RENCONTRES » (49 colonnes)
 * et -7,42 deg sur la bande rouge (28 colonnes).
 *
 * C'est une ROTATION et non un `skewX`. Le cisaillement penche les futs mais
 * laisse la ligne de base horizontale : sur une bande inclinee, le texte
 * cisaille reste visiblement a plat. C'est l'erreur que portait le jeton
 * `INCLINAISON` qu'il remplace, et qui a disparu avec lui.
 */
export const ROTATION_GABARIT = -7.3;

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
