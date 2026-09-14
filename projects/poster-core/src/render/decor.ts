import type { Degrade, Filtre, Noeud } from './scene';
import { COULEURS, FORMATS, type NomFormat } from './tokens';

/**
 * Decor de l'affiche : peinture, dechirures, projections.
 *
 * Aucune photographie, mais aucun aplat lisse non plus. Quatre procedes, tous
 * vectoriels :
 *
 * 1. Des **bandes dechirees** — quadrilateres aux bords dentes — se
 *    superposent en plusieurs teintes, ce qui donne au fond une profondeur de
 *    papier arrache qu'un degrade seul n'atteint pas.
 * 2. Les **coups de pinceau** sont fuseles : epais au centre, effiles aux
 *    extremites, contour ensuite dechire par un bruit fractal.
 * 3. Des **projections** — centaines d'eclaboussures et quelques coulures —
 *    dans une gamme large, semees par un generateur a graine.
 * 4. Un **grain** module l'ensemble.
 *
 * Le spike `tools/spikes/resvg-filtres.mjs` a verifie que resvg applique bien
 * `feTurbulence`, `feDisplacementMap`, `feComposite` et `feMorphology`.
 *
 * Point de performance : les eclaboussures sont regroupees par teinte et le
 * filtre est pose sur le groupe. Le filtrer tache par tache ferait autant de
 * passes de rasterisation qu'il y a de taches.
 */

export interface Decor {
  degrades: Degrade[];
  filtres: Filtre[];
  arriere: Noeud[];
  avant: Noeud[];
}

/** Generateur a graine : le decor doit etre identique d'un rendu a l'autre. */
export function hasard(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Point {
  x: number;
  y: number;
}

function trace(points: Point[]): string {
  return (
    `M ${points[0]!.x.toFixed(1)} ${points[0]!.y.toFixed(1)} ` +
    points
      .slice(1)
      .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ') +
    ' Z'
  );
}

/**
 * Contour d'une bande dechiree.
 *
 * Chaque bord est echantillonne et bruite independamment, si bien que la bande
 * n'a plus de cote droit. C'est ce qui remplace les rectangles arrondis
 * derriere les titres : un bord net se lit comme un gabarit, un bord dente
 * comme du papier arrache.
 */
export function bandeDechiree(
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  graine: number,
  dents = 18,
): string {
  const alea = hasard(graine);
  const amplitude = hauteur * 0.17;
  const points: Point[] = [];

  for (let i = 0; i <= dents; i++) {
    const t = i / dents;
    points.push({ x: x + t * largeur, y: y + (alea() - 0.5) * 2 * amplitude });
  }
  for (let i = dents; i >= 0; i--) {
    const t = i / dents;
    points.push({ x: x + t * largeur, y: y + hauteur + (alea() - 0.5) * 2 * amplitude });
  }
  return trace(points);
}

/**
 * Parallelogramme a coins VIFS.
 *
 * Le surlignage de titre de la reference n'est pas un rectangle arrondi mais
 * une bande cisaillee aux angles francs. Un coin arrondi lit « composant
 * d'interface » ; un coin vif lit « affiche ».
 */
export function parallelogramme(
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
  cisaillement: number,
): string {
  return trace([
    { x: x + cisaillement, y },
    { x: x + largeur + cisaillement, y },
    { x: x + largeur, y: y + hauteur },
    { x, y: y + hauteur },
  ]);
}

/**
 * Anneau peint : deux boucles de rayon irregulier, en sens opposes.
 *
 * L'enroulement inverse de la boucle interieure creuse le trou sans recourir a
 * une regle de remplissage particuliere. Remplace le contour de cercle parfait
 * du blason, qui faisait « gabarit ».
 */
export function anneauPeint(
  cx: number,
  cy: number,
  rayon: number,
  epaisseur: number,
  graine: number,
  dents = 48,
): string {
  const alea = hasard(graine);
  const boucle = (r: number, sens: 1 | -1, irregularite: number): Point[] => {
    const points: Point[] = [];
    for (let i = 0; i < dents; i++) {
      const angle = sens * (i / dents) * Math.PI * 2;
      const rr = r * (1 + (alea() - 0.5) * irregularite);
      points.push({ x: cx + Math.cos(angle) * rr, y: cy + Math.sin(angle) * rr });
    }
    return points;
  };
  return `${trace(boucle(rayon, 1, 0.08))} ${trace(boucle(rayon - epaisseur, -1, 0.06))}`;
}

/**
 * Chemin d'un coup de pinceau fusele.
 *
 * Ligne moyenne quadratique echantillonnee, decalee de part et d'autre selon
 * la normale, la demi-largeur suivant un profil en cloche bruite : c'est ce
 * qui donne les extremites effilees d'une brosse chargee, la ou un rectangle
 * arrondi reste inerte.
 */
export function cheminPinceau(
  depart: Point,
  controle: Point,
  arrivee: Point,
  demiLargeur: number,
  graine: number,
  echantillons = 26,
): string {
  const alea = hasard(graine);
  const hauts: Point[] = [];
  const bas: Point[] = [];

  for (let i = 0; i <= echantillons; i++) {
    const t = i / echantillons;
    const u = 1 - t;

    const x = u * u * depart.x + 2 * u * t * controle.x + t * t * arrivee.x;
    const y = u * u * depart.y + 2 * u * t * controle.y + t * t * arrivee.y;
    const tx = 2 * u * (controle.x - depart.x) + 2 * t * (arrivee.x - controle.x);
    const ty = 2 * u * (controle.y - depart.y) + 2 * t * (arrivee.y - controle.y);
    const norme = Math.hypot(tx, ty) || 1;

    const cloche = Math.sin(Math.PI * t) ** 0.5;
    const w = demiLargeur * cloche * (0.72 + alea() * 0.56);

    hauts.push({ x: x + (-ty / norme) * w, y: y + (tx / norme) * w });
    bas.push({ x: x - (-ty / norme) * w, y: y - (tx / norme) * w });
  }
  return trace([...hauts, ...bas.reverse()]);
}

/** Une coulure : goutte etiree vers le bas, comme de la peinture fraiche. */
function coulure(x: number, y: number, longueur: number, largeur: number): string {
  const d = largeur / 2;
  return (
    `M ${(x - d).toFixed(1)} ${y.toFixed(1)} ` +
    `L ${(x - d * 0.5).toFixed(1)} ${(y + longueur * 0.82).toFixed(1)} ` +
    `Q ${x.toFixed(1)} ${(y + longueur).toFixed(1)} ${(x + d * 0.5).toFixed(1)} ${(y + longueur * 0.82).toFixed(1)} ` +
    `L ${(x + d).toFixed(1)} ${y.toFixed(1)} Z`
  );
}

export interface OptionsEssaim {
  centre: Point;
  /** Demi-etendue horizontale et verticale de la zone semee. */
  etendue: Point;
  nombre: number;
  rayonMax: number;
  graine: number;
  /** Proportion de taches prolongees par une coulure. */
  partCoulures?: number;
}

/**
 * Essaim d'eclaboussures, groupe par teinte.
 *
 * Un seul filtre par teinte : le poser sur chaque tache multiplierait les
 * passes de rasterisation par le nombre de taches.
 */
export function essaim(
  options: OptionsEssaim,
  couleurs: readonly string[],
  filtre: string,
): Noeud[] {
  const { centre, etendue, nombre, rayonMax, graine } = options;
  const alea = hasard(graine);
  const parCouleur = new Map<string, Noeud[]>();

  for (let i = 0; i < nombre; i++) {
    const couleur = couleurs[Math.floor(alea() * couleurs.length)]!;
    // Densite plus forte au centre : la moyenne de deux tirages uniformes
    // resserre la loi autour de zero.
    const x = centre.x + (alea() + alea() - 1) * etendue.x;
    const y = centre.y + (alea() + alea() - 1) * etendue.y;
    const r = rayonMax * (0.1 + alea() ** 2.2 * 0.9);

    const liste = parCouleur.get(couleur) ?? [];
    liste.push({
      type: 'ellipse',
      role: 'eclaboussure',
      cx: x,
      cy: y,
      rx: r,
      ry: r * (0.62 + alea() * 0.72),
      remplissage: couleur,
      opacite: 0.3 + alea() * 0.55,
    });

    if (alea() < (options.partCoulures ?? 0.07)) {
      liste.push({
        type: 'chemin',
        role: 'coulure',
        d: coulure(x, y, r * (4 + alea() * 9), r * (0.5 + alea() * 0.5)),
        remplissage: couleur,
        opacite: 0.28 + alea() * 0.4,
      });
    }
    parCouleur.set(couleur, liste);
  }

  return [...parCouleur.values()].map((enfants) => ({
    type: 'groupe',
    role: 'essaim',
    filtre,
    enfants,
  }));
}

/**
 * Filtres de matiere, partages par le decor et par la composition.
 *
 * Quatre intensites de dechirure, de la plus large — pour les grands coups de
 * pinceau — a la plus discrete, pour les objets qui doivent rester lisibles.
 */
export const FILTRES_DECOR: Filtre[] = [
  {
    id: 'peinture-large',
    type: 'peinture',
    frequence: 0.012,
    octaves: 4,
    graine: 11,
    amplitude: 44,
    marge: 34,
  },
  {
    id: 'peinture-bande',
    type: 'peinture',
    frequence: 0.03,
    octaves: 4,
    graine: 17,
    amplitude: 18,
    marge: 26,
  },
  {
    id: 'peinture-fine',
    type: 'peinture',
    frequence: 0.09,
    octaves: 3,
    graine: 23,
    amplitude: 9,
    marge: 50,
  },
  {
    id: 'peinture-objet',
    type: 'peinture',
    frequence: 0.02,
    octaves: 3,
    graine: 5,
    amplitude: 6,
    marge: 26,
  },
  { id: 'grain', type: 'grain', frequence: 0.85, octaves: 3, graine: 3, intensite: 0.24 },
  // Liseré blanc epais : detoure le blason du club, pose sans pastille.
  { id: 'contour-blason', type: 'contour', rayon: 7, couleur: '#FFFFFF', marge: 30 },
  // Liseré fin, pour les logos adverses dans leur pastille.
  { id: 'contour-fin', type: 'contour', rayon: 2, couleur: '#FFFFFF', marge: 20 },
];

export interface FondPhoto {
  source: string;
  largeur: number;
  hauteur: number;
}

/**
 * Decor de l'affiche, desormais porte par une photographie.
 *
 * Le fond livre par le club contient deja le titre « CHAMPIONNAT PAR EQUIPE »,
 * l'accroche manuscrite du haut, les raquettes, la balle, la silhouette du
 * joueur et l'anneau rouge qui attend le blason. La composition ne redessine
 * donc AUCUN de ces elements — les superposer les dedoublerait.
 *
 * Il reste a poser :
 * - la photo, recadree en « couvrir » ;
 * - un voile sombre sur la zone de contenu, sans lequel les cartes ne se
 *   detachent pas de la surface de table, la plus claire de l'image
 *   (luminance mesuree a 84 sur 255, contre 22 au bas de l'affiche) ;
 * - un degrade de pied, pour que la signature manuscrite reste lisible.
 *
 * Les coups de pinceau et essaims d'eclaboussures dessines ont ete retires :
 * la photographie apporte sa propre matiere, et les y ajouter ne faisait que
 * brouiller les deux.
 */
export function decorPhoto(
  format: NomFormat,
  fond: FondPhoto | undefined,
  hautContenu: number,
  basContenu: number,
): Decor {
  const { largeur, hauteur } = FORMATS[format];
  const degrades: Degrade[] = [];
  const arriere: Noeud[] = [];

  if (fond) {
    arriere.push({
      type: 'image',
      role: 'fond',
      x: 0,
      y: 0,
      largeur,
      hauteur,
      source: fond.source,
      // « slice » recadre pour couvrir : l'image est en 4:5 a 0,7 % pres, donc
      // le rognage reel est imperceptible.
      preserveAspectRatio: 'xMidYMid slice',
    });
  } else {
    // Repli sans fond livre : un aplat nocturne, pour que l'affiche reste
    // lisible plutot que transparente.
    degrades.push({
      id: 'fond-repli',
      type: 'lineaire',
      x1: 0,
      y1: 0,
      x2: 0.3,
      y2: 1,
      etapes: [
        { position: 0, couleur: COULEURS.bleuNuit },
        { position: 1, couleur: COULEURS.nuit },
      ],
    });
    arriere.push({
      type: 'rect',
      role: 'fond',
      x: 0,
      y: 0,
      largeur,
      hauteur,
      remplissage: 'url(#fond-repli)',
    });
  }

  // Voile de contenu : degrade vertical opaque au centre, fondu aux extremites
  // pour ne pas trancher net sur la photo.
  degrades.push({
    id: 'voile-contenu',
    type: 'lineaire',
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    etapes: [
      { position: 0, couleur: COULEURS.nuit, opacite: 0 },
      { position: 0.1, couleur: COULEURS.nuit, opacite: 0.72 },
      { position: 0.9, couleur: COULEURS.nuit, opacite: 0.72 },
      { position: 1, couleur: COULEURS.nuit, opacite: 0 },
    ],
  });
  arriere.push({
    type: 'rect',
    role: 'voile-contenu',
    x: 0,
    y: hautContenu - 28,
    largeur,
    hauteur: basContenu - hautContenu + 56,
    remplissage: 'url(#voile-contenu)',
  });

  // Degrade de pied : la signature manuscrite se pose sur un sol sombre mais
  // texture, qui la mangerait sans cela.
  degrades.push({
    id: 'voile-pied',
    type: 'lineaire',
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    etapes: [
      { position: 0, couleur: COULEURS.nuit, opacite: 0 },
      { position: 1, couleur: COULEURS.nuit, opacite: 0.78 },
    ],
  });
  arriere.push({
    type: 'rect',
    role: 'voile-pied',
    x: 0,
    y: hauteur - 210,
    largeur,
    hauteur: 210,
    remplissage: 'url(#voile-pied)',
  });

  return { degrades, filtres: FILTRES_DECOR, arriere, avant: [] };
}
