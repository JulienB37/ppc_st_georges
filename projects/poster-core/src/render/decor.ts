import type { Degrade, Filtre, Noeud } from './scene';
import { COULEURS, FORMATS, type NomFormat } from './tokens';

/**
 * Decor de l'affiche : peinture, matiere, mouvement.
 *
 * Aucune photographie. Mais aucun aplat lisse non plus : un degrade propre et
 * une courbe de Bezier parfaite se lisent comme du plastique, pas comme une
 * affiche. La matiere vient de trois procedes, tous vectoriels :
 *
 * 1. Les coups de pinceau sont des chemins **fuseles** — epais au centre,
 *    effiles aux extremites — dont le contour est ensuite **dechire** par un
 *    filtre de deplacement pilote par un bruit fractal.
 * 2. Des **eclaboussures** sont semees autour de chaque coup, avec un
 *    generateur pseudo-aleatoire a graine : le rendu reste reproductible.
 * 3. Un **grain** module l'ensemble, pour qu'aucune couleur ne soit
 *    parfaitement uniforme.
 *
 * Le spike `tools/spikes/resvg-filtres.mjs` a verifie que resvg applique bien
 * `feTurbulence`, `feDisplacementMap`, `feComposite` et `feMorphology`.
 */

export interface Decor {
  degrades: Degrade[];
  filtres: Filtre[];
  /** Pose sous le contenu. */
  arriere: Noeud[];
  /** Pose par-dessus le contenu : grain et voiles. */
  avant: Noeud[];
}

/** Generateur a graine : le decor doit etre identique d'un rendu a l'autre. */
function hasard(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Point {
  x: number;
  y: number;
}

/**
 * Chemin d'un coup de pinceau fusele.
 *
 * On echantillonne une ligne moyenne quadratique, puis on decale de part et
 * d'autre selon la normale. La demi-largeur suit un profil en cloche : c'est
 * ce qui donne les extremites effilees d'une brosse chargee, la ou un
 * rectangle arrondi reste inerte.
 */
function cheminPinceau(
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

    // Point courant de la quadratique et sa tangente.
    const x = u * u * depart.x + 2 * u * t * controle.x + t * t * arrivee.x;
    const y = u * u * depart.y + 2 * u * t * controle.y + t * t * arrivee.y;
    const tx = 2 * u * (controle.x - depart.x) + 2 * t * (arrivee.x - controle.x);
    const ty = 2 * u * (controle.y - depart.y) + 2 * t * (arrivee.y - controle.y);
    const norme = Math.hypot(tx, ty) || 1;
    const nx = -ty / norme;
    const ny = tx / norme;

    // Profil en cloche, plus une irregularite qui evite l'aspect calibre.
    const cloche = Math.sin(Math.PI * t) ** 0.55;
    const bruit = 0.78 + alea() * 0.44;
    const w = demiLargeur * cloche * bruit;

    hauts.push({ x: x + nx * w, y: y + ny * w });
    bas.push({ x: x - nx * w, y: y - ny * w });
  }

  const segments = [
    `M ${hauts[0]!.x.toFixed(1)} ${hauts[0]!.y.toFixed(1)}`,
    ...hauts.slice(1).map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    ...bas.reverse().map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    'Z',
  ];
  return segments.join(' ');
}

/** Eclaboussures semees le long d'un coup de pinceau. */
function eclaboussures(
  autour: Point[],
  rayonMax: number,
  nombre: number,
  couleur: string,
  graine: number,
  filtre: string,
): Noeud[] {
  const alea = hasard(graine);
  const taches: Noeud[] = [];

  for (let i = 0; i < nombre; i++) {
    const ancre = autour[Math.floor(alea() * autour.length)]!;
    const angle = alea() * Math.PI * 2;
    const distance = (0.3 + alea() * 1.6) * rayonMax * 6;
    const r = rayonMax * (0.16 + alea() * 0.84);
    taches.push({
      type: 'ellipse',
      role: 'eclaboussure',
      cx: ancre.x + Math.cos(angle) * distance,
      cy: ancre.y + Math.sin(angle) * distance * 0.6,
      rx: r,
      ry: r * (0.6 + alea() * 0.7),
      remplissage: couleur,
      opacite: 0.35 + alea() * 0.5,
      filtre,
    });
  }
  return taches;
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
        { position: 0.55, couleur, opacite: intensite * 0.3 },
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

/**
 * Raquette et balle, dessinees.
 *
 * Le bois porte le filtre de peinture : son contour n'est plus une ellipse
 * parfaite mais un bord legerement mange, ce qui l'integre au reste.
 */
function raquette(cx: number, cy: number, echelle: number, angle: number, filtre: string): Noeud {
  const r = (v: number) => v * echelle;
  return {
    type: 'groupe',
    role: 'raquette',
    transform: `translate(${cx} ${cy}) rotate(${angle})`,
    filtre,
    enfants: [
      // Manche, dessine avant le bois pour passer dessous.
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

export function decorNocturne(
  format: NomFormat,
  couleurAccent: string,
  hauteurBandeau: number,
): Decor {
  const { largeur, hauteur } = FORMATS[format];
  const degrades: Degrade[] = [];
  const arriere: Noeud[] = [];
  const avant: Noeud[] = [];

  // Trois intensites de dechirure : large pour les grands coups, fine pour
  // les eclaboussures, tres discrete pour les objets qui doivent rester lisibles.
  const filtres: Filtre[] = [
    {
      id: 'peinture-large',
      type: 'peinture',
      frequence: 0.014,
      octaves: 4,
      graine: 11,
      amplitude: 34,
      marge: 30,
    },
    {
      id: 'peinture-fine',
      type: 'peinture',
      frequence: 0.06,
      octaves: 3,
      graine: 23,
      amplitude: 11,
      marge: 40,
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
    { id: 'grain', type: 'grain', frequence: 0.9, octaves: 3, graine: 3, intensite: 0.16 },
  ];

  // Fond : degrade en diagonale, plus clair sous le titre, tres sombre en bas
  // ou se posent les cartes.
  degrades.push({
    id: 'fond',
    type: 'lineaire',
    x1: 0,
    y1: 0,
    x2: 0.4,
    y2: 1,
    etapes: [
      { position: 0, couleur: COULEURS.nuitHaute },
      { position: 0.2, couleur: COULEURS.bleuNuit },
      { position: 0.58, couleur: COULEURS.nuitHaute },
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
    halo('halo-accent', couleurAccent, largeur * 0.84, hauteurBandeau * 0.5, 500, 0.42),
    halo('halo-bleu', COULEURS.bleuHalo, largeur * 0.06, hauteurBandeau * 1.45, 440, 0.3),
    halo('halo-bas', couleurAccent, largeur * 0.18, hauteur * 0.94, 380, 0.2),
  ]) {
    degrades.push(h.degrade);
    arriere.push(h.noeud);
  }

  // Grand coup de pinceau a l'accent, en travers du bandeau.
  const traitHaut = {
    depart: { x: -70, y: hauteurBandeau * 0.94 },
    controle: { x: largeur * 0.45, y: hauteurBandeau * 0.52 },
    arrivee: { x: largeur + 70, y: hauteurBandeau * 0.8 },
  };
  arriere.push({
    type: 'chemin',
    role: 'pinceau',
    d: cheminPinceau(traitHaut.depart, traitHaut.controle, traitHaut.arrivee, 30, 101),
    remplissage: couleurAccent,
    opacite: 0.82,
    filtre: 'peinture-large',
  });
  arriere.push(
    ...eclaboussures(
      [traitHaut.depart, traitHaut.arrivee],
      7,
      14,
      couleurAccent,
      202,
      'peinture-fine',
    ),
  );

  // Coup plus sombre et plus lent, sous le bandeau, qui asseoit le contenu.
  const traitMilieu = {
    depart: { x: largeur + 60, y: hauteurBandeau * 1.22 },
    controle: { x: largeur * 0.4, y: hauteurBandeau * 1.5 },
    arrivee: { x: -60, y: hauteurBandeau * 1.1 },
  };
  arriere.push({
    type: 'chemin',
    role: 'pinceau',
    d: cheminPinceau(traitMilieu.depart, traitMilieu.controle, traitMilieu.arrivee, 16, 303),
    remplissage: COULEURS.bleuHalo,
    opacite: 0.3,
    filtre: 'peinture-large',
  });

  // Coup de pied d'affiche, sous la signature manuscrite.
  const traitBas = {
    depart: { x: -70, y: hauteur * 0.9 },
    controle: { x: largeur * 0.5, y: hauteur * 1.0 },
    arrivee: { x: largeur + 70, y: hauteur * 0.88 },
  };
  arriere.push({
    type: 'chemin',
    role: 'pinceau',
    d: cheminPinceau(traitBas.depart, traitBas.controle, traitBas.arrivee, 26, 404),
    remplissage: couleurAccent,
    opacite: 0.5,
    filtre: 'peinture-large',
  });
  arriere.push(
    ...eclaboussures(
      [traitBas.depart, traitBas.controle, traitBas.arrivee],
      6,
      16,
      couleurAccent,
      505,
      'peinture-fine',
    ),
  );

  // Raquette et balle, debordantes du cadre. La balle file vers la gauche,
  // comme si elle venait d'etre frappee.
  arriere.push(raquette(largeur * 0.855, hauteurBandeau * 0.63, 0.78, 36, 'peinture-objet'));
  arriere.push(balle(largeur * 0.63, hauteurBandeau * 0.33, 21, Math.PI * 0.97));

  // Grain general, pose par-dessus tout le reste en tres faible opacite : il
  // enleve le cote parfaitement propre du degrade.
  avant.push({
    type: 'rect',
    role: 'grain',
    x: 0,
    y: 0,
    largeur,
    hauteur,
    remplissage: COULEURS.blanc,
    opacite: 0.06,
    filtre: 'grain',
  });

  return { degrades, filtres, arriere, avant };
}
