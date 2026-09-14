import type { Degrade, Noeud } from './scene';
import { COULEURS, FORMATS, type NomFormat } from './tokens';

/**
 * Decor nocturne de l'affiche, entierement dessine.
 *
 * Aucune photographie : degrades, halos, coups de pinceau, raquette et balle
 * sont des primitives SVG. L'affiche reste donc nette a n'importe quelle
 * taille d'export, ne depend d'aucun asset a fournir, et se decline en vert
 * pour les jeunes en changeant une seule couleur.
 *
 * Les halos sont des degrades radiaux a etape exterieure transparente plutot
 * que des flous gaussiens : moins couteux, et surtout d'un rendu previsible
 * d'un moteur a l'autre.
 */

export interface Decor {
  degrades: Degrade[];
  /** Pose sous le contenu. */
  arriere: Noeud[];
  /** Pose par-dessus le contenu, pour les voiles et les eclats. */
  avant: Noeud[];
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
        { position: 0.55, couleur, opacite: intensite * 0.32 },
        { position: 1, couleur, opacite: 0 },
      ],
    },
    noeud: {
      type: 'ellipse',
      role: 'halo',
      cx,
      cy,
      rx: rayon,
      ry: rayon * 0.82,
      remplissage: `url(#${id})`,
    },
  };
}

/**
 * Raquette et balle, dessinees.
 *
 * Le bois est une ellipse inclinee, le revetement une ellipse plus petite, et
 * le manche un chemin ferme. Suffisant a cette echelle : l'element est
 * decoratif et largement deborde du cadre.
 */
function raquette(cx: number, cy: number, echelle: number, angle: number): Noeud {
  const r = (v: number) => v * echelle;
  return {
    type: 'groupe',
    role: 'raquette',
    transform: `translate(${cx} ${cy}) rotate(${angle})`,
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
        remplissage: '#1A1005',
      },
      {
        type: 'ellipse',
        role: 'raquette-revetement',
        cx: 0,
        cy: 0,
        rx: r(97),
        ry: r(112),
        remplissage: COULEURS.rougePpc,
      },
      // Reflet : une ellipse claire decalee, en faible opacite.
      {
        type: 'ellipse',
        role: 'raquette-reflet',
        cx: r(-30),
        cy: r(-38),
        rx: r(44),
        ry: r(56),
        remplissage: '#FFFFFF',
        opacite: 0.13,
        transform: `rotate(-18 ${r(-30)} ${r(-38)})`,
      },
    ],
  };
}

/**
 * Balle et sa trainee.
 *
 * Sans trainee, la balle flotte sans lien avec la raquette : les quelques
 * ellipses qui la precedent suffisent a raconter la frappe.
 */
function balle(cx: number, cy: number, rayon: number, direction: number): Noeud {
  const trainee: Noeud[] = [1, 2, 3].map((i) => ({
    type: 'ellipse',
    role: 'trainee',
    cx: cx + Math.cos(direction) * rayon * 2.1 * i,
    cy: cy + Math.sin(direction) * rayon * 2.1 * i,
    rx: rayon * (1 - i * 0.14),
    ry: rayon * (1 - i * 0.14) * 0.82,
    remplissage: '#FFFFFF',
    opacite: 0.3 / i,
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
        remplissage: '#E8EEF6',
        opacite: 0.55,
      },
    ],
  };
}

/** Trainee lumineuse en diagonale, qui donne le mouvement. */
function eclat(id: string, x: number, largeur: number, hauteur: number, inclinaison: number) {
  const degrade: Degrade = {
    id,
    type: 'lineaire',
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    etapes: [
      { position: 0, couleur: '#FFFFFF', opacite: 0 },
      { position: 0.5, couleur: '#FFFFFF', opacite: 0.055 },
      { position: 1, couleur: '#FFFFFF', opacite: 0 },
    ],
  };
  const noeud: Noeud = {
    type: 'rect',
    role: 'eclat',
    x,
    y: -60,
    largeur,
    hauteur,
    remplissage: `url(#${id})`,
    // `skewX` sur un rectangle donne un parallelogramme, sans chemin a ecrire.
    epaisseur: undefined,
  };
  return {
    degrade,
    noeud: {
      type: 'groupe',
      role: 'eclat',
      transform: `skewX(${inclinaison})`,
      enfants: [noeud],
    } satisfies Noeud,
  };
}

export function decorNocturne(
  format: NomFormat,
  couleurHalo: string,
  hauteurBandeau: number,
): Decor {
  const { largeur, hauteur } = FORMATS[format];
  const degrades: Degrade[] = [];
  const arriere: Noeud[] = [];

  // Fond : degrade vertical, plus clair au niveau du bandeau pour y detacher
  // le titre, et tres sombre en bas ou se posent les cartes.
  degrades.push({
    id: 'fond',
    type: 'lineaire',
    x1: 0,
    y1: 0,
    x2: 0.35,
    y2: 1,
    etapes: [
      { position: 0, couleur: COULEURS.nuitHaute },
      { position: 0.22, couleur: COULEURS.bleuNuit },
      { position: 0.62, couleur: COULEURS.nuitHaute },
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

  const halos = [
    halo('halo-accent', couleurHalo, largeur * 0.82, hauteurBandeau * 0.55, 520, 0.5),
    halo('halo-bleu', COULEURS.bleuHalo, largeur * 0.08, hauteurBandeau * 1.5, 460, 0.34),
    halo('halo-magenta', COULEURS.magentaHalo, largeur * 0.95, hauteur * 0.72, 420, 0.26),
  ];
  for (const h of halos) {
    degrades.push(h.degrade);
    arriere.push(h.noeud);
  }

  for (const [i, e] of [
    eclat('eclat-1', largeur * 0.12, 150, hauteur + 120, -14),
    eclat('eclat-2', largeur * 0.58, 86, hauteur + 120, -14),
    eclat('eclat-3', largeur * 0.78, 230, hauteur + 120, -14),
  ].entries()) {
    degrades.push({ ...e.degrade, id: `eclat-${i + 1}` });
    arriere.push(e.noeud);
  }

  // Coups de pinceau : deux chemins organiques, l'un a l'accent, l'autre en
  // magenta, qui traversent le bandeau et le bas de l'affiche.
  arriere.push({
    type: 'chemin',
    role: 'pinceau',
    d:
      `M -30 ${hauteurBandeau * 0.86} C ${largeur * 0.25} ${hauteurBandeau * 0.6}, ` +
      `${largeur * 0.55} ${hauteurBandeau * 1.04}, ${largeur + 30} ${hauteurBandeau * 0.66} ` +
      `L ${largeur + 30} ${hauteurBandeau * 0.78} C ${largeur * 0.55} ${hauteurBandeau * 1.16}, ` +
      `${largeur * 0.25} ${hauteurBandeau * 0.72}, -30 ${hauteurBandeau * 0.98} Z`,
    remplissage: couleurHalo,
    opacite: 0.5,
  });
  arriere.push({
    type: 'chemin',
    role: 'pinceau',
    d:
      `M -30 ${hauteur * 0.9} C ${largeur * 0.3} ${hauteur * 0.84}, ` +
      `${largeur * 0.6} ${hauteur * 0.97}, ${largeur + 30} ${hauteur * 0.87} ` +
      `L ${largeur + 30} ${hauteur * 0.93} C ${largeur * 0.6} ${hauteur * 1.03}, ` +
      `${largeur * 0.3} ${hauteur * 0.9}, -30 ${hauteur * 0.96} Z`,
    remplissage: COULEURS.magentaHalo,
    opacite: 0.22,
  });

  // Raquette et balle, en haut a droite, debordantes du cadre. La balle file
  // vers la gauche, comme si elle venait d'etre frappee.
  arriere.push(raquette(largeur * 0.95, hauteurBandeau * 0.66, 0.84, 32));
  arriere.push(balle(largeur * 0.66, hauteurBandeau * 0.42, 22, Math.PI * 0.96));

  return { degrades, arriere, avant: [] };
}
