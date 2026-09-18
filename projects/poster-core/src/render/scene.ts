import type { FamillePolice } from './tokens';

/**
 * Scene : arbre de noeuds deja positionnes.
 *
 * Separer le calcul de la mise en page de l'emission du SVG rend le premier
 * testable sans rien rasteriser. L'ancien moteur melangeait les deux — la
 * geometrie etait recalculee en ligne a chaque appel de dessin — de sorte que
 * ni le chevauchement des gelules ni le pictogramme place hors cadre a x=328
 * ne pouvaient etre detectes autrement qu'a l'oeil.
 */

export interface Boite {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export type Ancre = 'start' | 'middle' | 'end';

interface Commun {
  /** Etiquette libre, utilisee par les tests d'invariants et le debogage. */
  role?: string;
}

export interface NoeudRect extends Commun {
  type: 'rect';
  filtre?: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  rx?: number;
  remplissage?: string;
  contour?: string;
  epaisseur?: number;
  opacite?: number;
}

export interface NoeudCercle extends Commun {
  type: 'cercle';
  filtre?: string;
  cx: number;
  cy: number;
  r: number;
  remplissage?: string;
  contour?: string;
  epaisseur?: number;
  opacite?: number;
}

export interface NoeudEllipse extends Commun {
  type: 'ellipse';
  filtre?: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  remplissage?: string;
  opacite?: number;
  transform?: string;
}

export interface NoeudChemin extends Commun {
  type: 'chemin';
  filtre?: string;
  d: string;
  remplissage?: string;
  contour?: string;
  epaisseur?: number;
  opacite?: number;
  /** Boite englobante, que l'emetteur ne sait pas deduire d'un chemin. */
  boite?: Boite;
}

export interface NoeudTexte extends Commun {
  type: 'texte';
  x: number;
  y: number;
  contenu: string;
  famille: FamillePolice;
  graisse: number;
  taille: number;
  couleur: string;
  ancre?: Ancre;
  /** En fraction du corps, converti en `letter-spacing` absolu a l'emission. */
  interlettrage?: number;
  opacite?: number;
  /**
   * Largeur d'avance mesuree au moment de la composition.
   *
   * Portee par le noeud parce que l'emetteur n'a pas de moteur de mesure, et
   * que les tests d'invariants en ont besoin pour verifier qu'aucun texte ne
   * deborde de son conteneur.
   */
  largeurMesuree: number;
  /** Hauteur de ligne reelle, ascendante + descendante. */
  hauteurMesuree: number;
  /**
   * Contour du texte.
   *
   * L'emetteur dessine alors le texte DEUX FOIS : une passe contouree puis une
   * passe pleine par-dessus. `paint-order` ferait la meme chose en une passe,
   * mais son support par resvg n'est pas verifie.
   */
  contour?: string;
  epaisseurContour?: number;
}

export interface NoeudImage extends Commun {
  type: 'image';
  filtre?: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Toujours une data URL : voir `emettreSvg`. */
  source: string;
  clip?: string;
  preserveAspectRatio?: string;
}

export interface NoeudGroupe extends Commun {
  type: 'groupe';
  filtre?: string;
  enfants: Noeud[];
  transform?: string;
  clip?: string;
  opacite?: number;
}

export type Noeud =
  NoeudRect | NoeudCercle | NoeudEllipse | NoeudChemin | NoeudTexte | NoeudImage | NoeudGroupe;

/** Une zone de decoupe, referencee par les noeuds via son identifiant. */
export interface Decoupe {
  id: string;
  /** Cercle de decoupe : seul cas dont l'affiche a besoin. */
  cercle: { cx: number; cy: number; r: number };
}

/** Une etape de degrade : position sur l'axe, couleur, et opacite eventuelle. */
export interface EtapeDegrade {
  position: number;
  couleur: string;
  opacite?: number;
}

/**
 * Degrade lineaire ou radial, reference par `url(#id)`.
 *
 * Les halos de l'affiche sont des degrades radiaux dont l'etape exterieure est
 * transparente, plutot que des flous gaussiens : moins couteux a rasteriser,
 * et surtout d'un rendu previsible, la ou les filtres SVG varient d'un moteur
 * a l'autre.
 */
export type Degrade =
  | {
      id: string;
      type: 'lineaire';
      /** Coordonnees en fraction de la boite englobante. */
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      etapes: EtapeDegrade[];
    }
  | { id: string; type: 'radial'; cx: number; cy: number; r: number; etapes: EtapeDegrade[] };

/**
 * Filtres de matiere, references par `filter="url(#id)"`.
 *
 * Deux effets seulement, et ils suffisent a sortir l'affiche du registre
 * « aplat vectoriel lisse » :
 *
 * - `peinture` deforme le contour d'une forme par un bruit fractal, ce qui
 *   donne des bords dechires de coup de pinceau au lieu d'une courbe de
 *   Bezier parfaite ;
 * - `grain` module l'interieur d'une forme, pour que la couleur ne soit pas
 *   parfaitement uniforme.
 *
 * Le type est ferme plutot qu'une chaine de primitives libre : l'emetteur
 * reste le seul endroit qui connaisse la syntaxe SVG, et un filtre mal forme
 * ne compile pas.
 */
export type Filtre =
  | {
      id: string;
      type: 'peinture';
      /** Echelle du bruit : plus bas, plus les accidents sont larges. */
      frequence: number;
      octaves: number;
      graine: number;
      /** Amplitude de la deformation, en unites de la scene. */
      amplitude: number;
      /** Debordement autorise autour de la forme, en pourcentage. */
      marge: number;
    }
  | {
      /**
       * Contour detoure, dit « sticker » : la silhouette alpha de la source est
       * dilatee, remplie d'une couleur unie, et composee SOUS l'original.
       *
       * C'est ce qui permet de detourer un logo raster sans le vectoriser, et
       * donc de le poser sans pastille sur un fond charge.
       */
      id: string;
      type: 'contour';
      /** Epaisseur du liseré, en unites de la scene. */
      rayon: number;
      couleur: string;
      marge: number;
    }
  | {
      id: string;
      type: 'grain';
      frequence: number;
      octaves: number;
      graine: number;
      /** 0 = invisible, 1 = tres marque. */
      intensite: number;
    };

export interface Scene {
  largeur: number;
  hauteur: number;
  decoupes: Decoupe[];
  degrades: Degrade[];
  filtres: Filtre[];
  noeuds: Noeud[];
}

/**
 * Boite englobante d'un noeud, dans son propre repere.
 *
 * Rend `null` pour un groupe transforme : composer une matrice arbitraire
 * depasse ce dont l'affiche a besoin, et mieux vaut ne rien affirmer que
 * renvoyer une boite fausse a un test d'invariant.
 */
export function boiteDe(noeud: Noeud): Boite | null {
  switch (noeud.type) {
    case 'rect':
      return { x: noeud.x, y: noeud.y, largeur: noeud.largeur, hauteur: noeud.hauteur };
    case 'cercle':
      return {
        x: noeud.cx - noeud.r,
        y: noeud.cy - noeud.r,
        largeur: 2 * noeud.r,
        hauteur: 2 * noeud.r,
      };
    case 'ellipse':
      // Une ellipse transformee n'a pas de boite fiable sans composer la
      // matrice : on prefere ne rien affirmer.
      return noeud.transform
        ? null
        : {
            x: noeud.cx - noeud.rx,
            y: noeud.cy - noeud.ry,
            largeur: 2 * noeud.rx,
            hauteur: 2 * noeud.ry,
          };
    case 'image':
      return { x: noeud.x, y: noeud.y, largeur: noeud.largeur, hauteur: noeud.hauteur };
    case 'chemin':
      return noeud.boite ?? null;
    case 'texte': {
      const ancre = noeud.ancre ?? 'start';
      const decalage =
        ancre === 'middle' ? noeud.largeurMesuree / 2 : ancre === 'end' ? noeud.largeurMesuree : 0;
      return {
        x: noeud.x - decalage,
        // `y` est la ligne de base : la boite remonte de l'ascendante.
        y: noeud.y - noeud.hauteurMesuree * 0.8,
        largeur: noeud.largeurMesuree,
        hauteur: noeud.hauteurMesuree,
      };
    }
    case 'groupe':
      return noeud.transform ? null : englober(noeud.enfants.map(boiteDe));
  }
}

export function englober(boites: (Boite | null)[]): Boite | null {
  const valides = boites.filter((b): b is Boite => b !== null);
  if (valides.length === 0) return null;

  const x = Math.min(...valides.map((b) => b.x));
  const y = Math.min(...valides.map((b) => b.y));
  const droite = Math.max(...valides.map((b) => b.x + b.largeur));
  const bas = Math.max(...valides.map((b) => b.y + b.hauteur));
  return { x, y, largeur: droite - x, hauteur: bas - y };
}

/** Parcours en profondeur, groupes compris. */
export function* parcourir(noeuds: Noeud[]): Generator<Noeud> {
  for (const noeud of noeuds) {
    yield noeud;
    if (noeud.type === 'groupe') yield* parcourir(noeud.enfants);
  }
}

/**
 * Parcours limite aux noeuds dont les coordonnees vivent dans le repere de la
 * scene.
 *
 * Un groupe transforme — incline, tourne — place ses enfants dans un autre
 * repere : leur `x` brut ne veut plus rien dire dans le cadre de l'affiche.
 * Les verifications geometriques doivent donc s'arreter a la frontiere d'un
 * tel groupe, sous peine de comparer des coordonnees incomparables.
 */
export function* parcourirPlanaire(noeuds: Noeud[]): Generator<Noeud> {
  for (const noeud of noeuds) {
    yield noeud;
    if (noeud.type === 'groupe' && !noeud.transform) yield* parcourirPlanaire(noeud.enfants);
  }
}

/** Tous les noeuds portant un role donne, a n'importe quelle profondeur. */
export function noeudsParRole(scene: Scene, role: string): Noeud[] {
  return [...parcourir(scene.noeuds)].filter((n) => n.role === role);
}

export function seChevauchent(a: Boite, b: Boite, tolerance = 0): boolean {
  return (
    a.x + a.largeur - tolerance > b.x &&
    b.x + b.largeur - tolerance > a.x &&
    a.y + a.hauteur - tolerance > b.y &&
    b.y + b.hauteur - tolerance > a.y
  );
}

export function contient(exterieur: Boite, interieur: Boite, tolerance = 0.5): boolean {
  return (
    interieur.x >= exterieur.x - tolerance &&
    interieur.y >= exterieur.y - tolerance &&
    interieur.x + interieur.largeur <= exterieur.x + exterieur.largeur + tolerance &&
    interieur.y + interieur.hauteur <= exterieur.y + exterieur.hauteur + tolerance
  );
}
