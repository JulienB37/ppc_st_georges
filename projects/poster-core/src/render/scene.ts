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
  cx: number;
  cy: number;
  r: number;
  remplissage?: string;
  contour?: string;
  epaisseur?: number;
  opacite?: number;
}

export interface NoeudChemin extends Commun {
  type: 'chemin';
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
}

export interface NoeudImage extends Commun {
  type: 'image';
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
  enfants: Noeud[];
  transform?: string;
  clip?: string;
  opacite?: number;
}

export type Noeud = NoeudRect | NoeudCercle | NoeudChemin | NoeudTexte | NoeudImage | NoeudGroupe;

/** Une zone de decoupe, referencee par les noeuds via son identifiant. */
export interface Decoupe {
  id: string;
  /** Cercle de decoupe : seul cas dont l'affiche a besoin. */
  cercle: { cx: number; cy: number; r: number };
}

export interface Scene {
  largeur: number;
  hauteur: number;
  decoupes: Decoupe[];
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
