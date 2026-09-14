import type { Degrade, Filtre, Noeud } from './scene';
import { COULEURS, FORMATS, PROJECTION, type NomFormat } from './tokens';

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

function halo(
  id: string,
  couleur: string,
  cx: number,
  cy: number,
  rayon: number,
  intensite: number,
): { degrade: Degrade; noeud: Noeud } {
  return {
    degrade: {
      id,
      type: 'radial',
      cx: 0.5,
      cy: 0.5,
      r: 0.5,
      etapes: [
        { position: 0, couleur, opacite: intensite },
        { position: 0.5, couleur, opacite: intensite * 0.34 },
        { position: 1, couleur, opacite: 0 },
      ],
    },
    noeud: {
      type: 'ellipse',
      role: 'halo',
      cx,
      cy,
      rx: rayon,
      ry: rayon * 0.8,
      remplissage: `url(#${id})`,
    },
  };
}

/** Raquette et balle, dessinees, avec un bord mange par la peinture. */
function raquette(cx: number, cy: number, echelle: number, angle: number, filtre: string): Noeud {
  const r = (v: number) => v * echelle;
  return {
    type: 'groupe',
    role: 'raquette',
    transform: `translate(${cx} ${cy}) rotate(${angle})`,
    filtre,
    enfants: [
      {
        type: 'chemin',
        role: 'raquette-manche',
        d: `M ${r(-30)} ${r(96)} L ${r(-24)} ${r(212)} Q ${r(0)} ${r(234)} ${r(24)} ${r(212)} L ${r(30)} ${r(96)} Z`,
        remplissage: '#6B3A1E',
      },
      {
        type: 'ellipse',
        role: 'raquette-bois',
        cx: 0,
        cy: 0,
        rx: r(108),
        ry: r(124),
        remplissage: '#150D04',
      },
      {
        type: 'ellipse',
        role: 'raquette-revetement',
        cx: 0,
        cy: 0,
        rx: r(96),
        ry: r(111),
        remplissage: COULEURS.rougePpc,
      },
      {
        type: 'ellipse',
        role: 'raquette-reflet',
        cx: r(-30),
        cy: r(-38),
        rx: r(44),
        ry: r(56),
        remplissage: '#FFFFFF',
        opacite: 0.11,
        transform: `rotate(-18 ${r(-30)} ${r(-38)})`,
      },
    ],
  };
}

function balle(cx: number, cy: number, rayon: number, direction: number): Noeud {
  const trainee: Noeud[] = [1, 2, 3].map((i) => ({
    type: 'ellipse',
    role: 'trainee',
    cx: cx + Math.cos(direction) * rayon * 2.2 * i,
    cy: cy + Math.sin(direction) * rayon * 2.2 * i,
    rx: rayon * (1 - i * 0.16),
    ry: rayon * (1 - i * 0.16) * 0.8,
    remplissage: '#FFFFFF',
    opacite: 0.26 / i,
  }));

  return {
    type: 'groupe',
    role: 'balle',
    enfants: [
      ...trainee.reverse(),
      { type: 'cercle', cx, cy, r: rayon, remplissage: '#FFFFFF' },
      {
        type: 'ellipse',
        cx: cx - rayon * 0.28,
        cy: cy - rayon * 0.3,
        rx: rayon * 0.3,
        ry: rayon * 0.22,
        remplissage: '#DDE6F2',
        opacite: 0.6,
      },
    ],
  };
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
];

export function decorNocturne(
  format: NomFormat,
  couleurAccent: string,
  hauteurBandeau: number,
): Decor {
  const { largeur, hauteur } = FORMATS[format];
  const degrades: Degrade[] = [];
  const arriere: Noeud[] = [];
  const avant: Noeud[] = [];

  degrades.push({
    id: 'fond',
    type: 'lineaire',
    x1: 0,
    y1: 0,
    x2: 0.4,
    y2: 1,
    etapes: [
      { position: 0, couleur: COULEURS.nuitHaute },
      { position: 0.18, couleur: COULEURS.bleuNuit },
      { position: 0.55, couleur: COULEURS.nuitHaute },
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
    remplissage: 'url(#fond)',
  });

  for (const h of [
    halo('halo-accent', couleurAccent, largeur * 0.84, hauteurBandeau * 0.48, 520, 0.46),
    halo('halo-cyan', COULEURS.cyan, largeur * 0.04, hauteurBandeau * 1.3, 460, 0.26),
    halo('halo-violet', COULEURS.violet, largeur * 1.02, hauteur * 0.58, 480, 0.24),
    halo('halo-bas', couleurAccent, largeur * 0.2, hauteur * 0.96, 400, 0.24),
  ]) {
    degrades.push(h.degrade);
    arriere.push(h.noeud);
  }

  // Bandes dechirees : plusieurs couches obliques, teintes et opacites variees.
  // C'est elles qui donnent la profondeur de papier arrache.
  // Deux teintes voisines par zone, pas plus. Empiler trois couches de teintes
  // eloignees au meme endroit ne donne pas une dechirure franche mais un
  // degrade arc-en-ciel, qui lit comme une bavure.
  const bandes = [
    {
      y: hauteurBandeau * 0.76,
      h: 70,
      angle: -5,
      couleur: couleurAccent,
      opacite: 0.88,
      graine: 71,
    },
    {
      y: hauteurBandeau * 0.98,
      h: 16,
      angle: -5,
      couleur: COULEURS.magenta,
      opacite: 0.42,
      graine: 72,
    },
    // Zone centrale : deux voiles tres discrets, juste pour que le fond du
    // contenu ne soit pas mort.
    {
      y: hauteurBandeau * 1.5,
      h: 46,
      angle: 2,
      couleur: COULEURS.violet,
      opacite: 0.12,
      graine: 73,
    },
    { y: hauteur * 0.58, h: 34, angle: -2, couleur: COULEURS.cyan, opacite: 0.1, graine: 74 },
    { y: hauteur * 0.86, h: 62, angle: 4, couleur: couleurAccent, opacite: 0.5, graine: 75 },
    { y: hauteur * 0.94, h: 14, angle: 4, couleur: COULEURS.magenta, opacite: 0.34, graine: 76 },
  ];
  for (const b of bandes) {
    arriere.push({
      type: 'groupe',
      role: 'bande-dechiree',
      transform: `rotate(${b.angle} ${largeur / 2} ${b.y})`,
      filtre: 'peinture-bande',
      enfants: [
        {
          type: 'chemin',
          d: bandeDechiree(-90, b.y, largeur + 180, b.h, b.graine),
          remplissage: b.couleur,
          opacite: b.opacite,
        },
      ],
    });
  }

  arriere.push({
    type: 'chemin',
    role: 'pinceau',
    d: cheminPinceau(
      { x: -70, y: hauteurBandeau * 0.68 },
      { x: largeur * 0.5, y: hauteurBandeau * 0.28 },
      { x: largeur + 70, y: hauteurBandeau * 0.56 },
      22,
      101,
    ),
    remplissage: COULEURS.magenta,
    opacite: 0.42,
    filtre: 'peinture-large',
  });

  // Projections : trois essaims, denses dans le bandeau et au pied.
  arriere.push(
    ...essaim(
      {
        centre: { x: largeur * 0.42, y: hauteurBandeau * 0.82 },
        etendue: { x: largeur * 0.55, y: 130 },
        nombre: 130,
        rayonMax: 11,
        graine: 2024,
        partCoulures: 0.1,
      },
      PROJECTION,
      'peinture-fine',
    ),
    ...essaim(
      {
        centre: { x: largeur * 0.5, y: hauteur * 0.9 },
        etendue: { x: largeur * 0.55, y: 90 },
        nombre: 90,
        rayonMax: 10,
        graine: 3031,
        partCoulures: 0.12,
      },
      PROJECTION,
      'peinture-fine',
    ),
    ...essaim(
      {
        centre: { x: largeur * 0.5, y: hauteur * 0.52 },
        etendue: { x: largeur * 0.52, y: hauteur * 0.2 },
        nombre: 55,
        rayonMax: 8,
        graine: 5051,
        partCoulures: 0.08,
      },
      PROJECTION,
      'peinture-fine',
    ),
    ...essaim(
      {
        centre: { x: largeur * 0.88, y: hauteurBandeau * 0.3 },
        etendue: { x: 190, y: 130 },
        nombre: 60,
        rayonMax: 9,
        graine: 4041,
        partCoulures: 0.05,
      },
      [couleurAccent, COULEURS.jauneVif, COULEURS.blanc],
      'peinture-fine',
    ),
  );

  arriere.push(raquette(largeur * 0.855, hauteurBandeau * 0.63, 0.78, 36, 'peinture-objet'));
  arriere.push(balle(largeur * 0.63, hauteurBandeau * 0.33, 21, Math.PI * 0.97));

  avant.push({
    type: 'rect',
    role: 'grain',
    x: 0,
    y: 0,
    largeur,
    hauteur,
    remplissage: COULEURS.blanc,
    opacite: 0.07,
    filtre: 'grain',
  });

  return { degrades, filtres: FILTRES_DECOR, arriere, avant };
}
