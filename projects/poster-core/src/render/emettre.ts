import type { Decoupe, Degrade, Filtre, Noeud, Scene } from './scene';

/**
 * Emission du SVG.
 *
 * Aucun calcul ici : la scene arrive entierement positionnee. En echange,
 * l'emetteur se porte garant de deux proprietes que le rendu final exige.
 */

/** Arrondi a 0,01 : sortie stable d'une execution a l'autre, donc diffs lisibles. */
function n(valeur: number): string {
  if (!Number.isFinite(valeur)) {
    throw new Error(`Coordonnee non finie dans la scene : ${valeur}`);
  }
  const arrondi = Math.round(valeur * 100) / 100;
  return Object.is(arrondi, -0) ? '0' : String(arrondi);
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attributs(paires: [string, string | number | undefined][]): string {
  return paires
    .filter((p): p is [string, string | number] => p[1] !== undefined && p[1] !== '')
    .map(
      ([cle, valeur]) => ` ${cle}="${typeof valeur === 'number' ? n(valeur) : echapper(valeur)}"`,
    )
    .join('');
}

function emettreNoeud(noeud: Noeud): string {
  switch (noeud.type) {
    case 'rect':
      return `<rect${attributs([
        ['x', noeud.x],
        ['y', noeud.y],
        ['width', noeud.largeur],
        ['height', noeud.hauteur],
        ['rx', noeud.rx],
        ['fill', noeud.remplissage ?? 'none'],
        ['stroke', noeud.contour],
        ['stroke-width', noeud.epaisseur],
        ['opacity', noeud.opacite],
        ['filter', noeud.filtre ? `url(#${noeud.filtre})` : undefined],
      ])}/>`;

    case 'cercle':
      return `<circle${attributs([
        ['cx', noeud.cx],
        ['cy', noeud.cy],
        ['r', noeud.r],
        ['fill', noeud.remplissage ?? 'none'],
        ['stroke', noeud.contour],
        ['stroke-width', noeud.epaisseur],
        ['opacity', noeud.opacite],
        ['filter', noeud.filtre ? `url(#${noeud.filtre})` : undefined],
      ])}/>`;

    case 'ellipse':
      return `<ellipse${attributs([
        ['cx', noeud.cx],
        ['cy', noeud.cy],
        ['rx', noeud.rx],
        ['ry', noeud.ry],
        ['fill', noeud.remplissage ?? 'none'],
        ['opacity', noeud.opacite],
        ['transform', noeud.transform],
        ['filter', noeud.filtre ? `url(#${noeud.filtre})` : undefined],
      ])}/>`;

    case 'chemin':
      return `<path${attributs([
        ['d', noeud.d],
        ['fill', noeud.remplissage ?? 'none'],
        ['stroke', noeud.contour],
        ['stroke-width', noeud.epaisseur],
        ['stroke-linecap', noeud.contour ? 'round' : undefined],
        ['opacity', noeud.opacite],
        ['filter', noeud.filtre ? `url(#${noeud.filtre})` : undefined],
      ])}/>`;

    case 'texte': {
      // Pas de `dominant-baseline` : son interpretation diverge d'un moteur a
      // l'autre. Les lignes de base sont calculees a la composition, a partir
      // des metriques reelles de la police, et emises en absolu.
      const commun: [string, string | number | undefined][] = [
        ['x', noeud.x],
        ['y', noeud.y],
        ['font-family', noeud.famille],
        ['font-weight', noeud.graisse],
        ['font-size', noeud.taille],
        ['fill', noeud.couleur],
        ['text-anchor', noeud.ancre && noeud.ancre !== 'start' ? noeud.ancre : undefined],
        ['letter-spacing', noeud.interlettrage ? noeud.interlettrage * noeud.taille : undefined],
        ['opacity', noeud.opacite],
        ['xml:space', 'preserve'],
      ];
      const passe = (extra: [string, string | number | undefined][] = []) =>
        `<text${attributs([...commun, ...extra])}>${echapper(noeud.contenu)}</text>`;

      // Passe contouree d'abord, passe pleine par-dessus : c'est ce qui donne
      // un liseré exterieur net plutot qu'un trait qui mange les glyphes.
      if (noeud.contour) {
        return (
          passe([
            ['stroke', noeud.contour],
            ['stroke-width', noeud.epaisseurContour],
            ['stroke-linejoin', 'round'],
          ]) + passe()
        );
      }
      return passe();
    }

    case 'image':
      // Garde dure : un `href` externe ne serait resolu ni par resvg, ni dans
      // un SVG charge comme image. C'est la cause exacte des logos absents
      // lorsque l'ancien script etait lance depuis un autre repertoire.
      if (!noeud.source.startsWith('data:')) {
        throw new Error(
          `Image non embarquee : « ${noeud.source.slice(0, 40)}… ». ` +
            `Toute image doit arriver en data URL.`,
        );
      }
      return `<image${attributs([
        ['x', noeud.x],
        ['y', noeud.y],
        ['width', noeud.largeur],
        ['height', noeud.hauteur],
        ['preserveAspectRatio', noeud.preserveAspectRatio ?? 'xMidYMid meet'],
        ['clip-path', noeud.clip ? `url(#${noeud.clip})` : undefined],
        ['filter', noeud.filtre ? `url(#${noeud.filtre})` : undefined],
        ['href', noeud.source],
      ])}/>`;

    case 'groupe': {
      const enfants = noeud.enfants.map(emettreNoeud).join('');
      if (!enfants) return '';
      return `<g${attributs([
        ['transform', noeud.transform],
        ['clip-path', noeud.clip ? `url(#${noeud.clip})` : undefined],
        ['opacity', noeud.opacite],
        ['filter', noeud.filtre ? `url(#${noeud.filtre})` : undefined],
      ])}>${enfants}</g>`;
    }
  }
}

function emettreDegrades(degrades: Degrade[]): string {
  return degrades
    .map((d) => {
      const etapes = d.etapes
        .map(
          (e) =>
            `<stop${attributs([
              ['offset', e.position],
              ['stop-color', e.couleur],
              ['stop-opacity', e.opacite],
            ])}/>`,
        )
        .join('');

      if (d.type === 'lineaire') {
        return `<linearGradient${attributs([
          ['id', d.id],
          ['x1', d.x1],
          ['y1', d.y1],
          ['x2', d.x2],
          ['y2', d.y2],
        ])}>${etapes}</linearGradient>`;
      }
      return `<radialGradient${attributs([
        ['id', d.id],
        ['cx', d.cx],
        ['cy', d.cy],
        ['r', d.r],
      ])}>${etapes}</radialGradient>`;
    })
    .join('');
}

function emettreFiltres(filtres: Filtre[]): string {
  return filtres
    .map((f) => {
      if (f.type === 'contour') {
        return (
          `<filter${attributs([
            ['id', f.id],
            ['x', `${-f.marge}%`],
            ['y', `${-f.marge}%`],
            ['width', `${100 + 2 * f.marge}%`],
            ['height', `${100 + 2 * f.marge}%`],
          ])}>` +
          `<feMorphology${attributs([
            ['operator', 'dilate'],
            ['radius', f.rayon],
            ['in', 'SourceAlpha'],
            ['result', 'silhouette'],
          ])}/>` +
          `<feFlood${attributs([
            ['flood-color', f.couleur],
            ['result', 'teinte'],
          ])}/>` +
          `<feComposite${attributs([
            ['in', 'teinte'],
            ['in2', 'silhouette'],
            ['operator', 'in'],
            ['result', 'liseré'],
          ])}/>` +
          `<feMerge>` +
          `<feMergeNode${attributs([['in', 'liseré']])}/>` +
          `<feMergeNode${attributs([['in', 'SourceGraphic']])}/>` +
          `</feMerge>` +
          `</filter>`
        );
      }

      if (f.type === 'peinture') {
        // Le bruit fractal sert de carte de deplacement : chaque pixel du
        // contour est pousse selon les canaux R et G du bruit, ce qui dechire
        // les bords. C'est ce qui distingue un coup de pinceau d'un aplat.
        return (
          `<filter${attributs([
            ['id', f.id],
            ['x', `${-f.marge}%`],
            ['y', `${-f.marge}%`],
            ['width', `${100 + 2 * f.marge}%`],
            ['height', `${100 + 2 * f.marge}%`],
          ])}>` +
          `<feTurbulence${attributs([
            ['type', 'fractalNoise'],
            ['baseFrequency', f.frequence],
            ['numOctaves', f.octaves],
            ['seed', f.graine],
            ['result', 'bruit'],
          ])}/>` +
          `<feDisplacementMap${attributs([
            ['in', 'SourceGraphic'],
            ['in2', 'bruit'],
            ['scale', f.amplitude],
            ['xChannelSelector', 'R'],
            ['yChannelSelector', 'G'],
          ])}/>` +
          `</filter>`
        );
      }

      // Grain : le bruit est decoupe a la forme source puis multiplie par
      // elle, ce qui module la couleur sans deborder.
      return (
        `<filter${attributs([['id', f.id]])}>` +
        `<feTurbulence${attributs([
          ['type', 'fractalNoise'],
          ['baseFrequency', f.frequence],
          ['numOctaves', f.octaves],
          ['seed', f.graine],
          ['result', 'grain'],
        ])}/>` +
        `<feComposite${attributs([
          ['in', 'grain'],
          ['in2', 'SourceGraphic'],
          ['operator', 'in'],
          ['result', 'masque'],
        ])}/>` +
        `<feComponentTransfer${attributs([
          ['in', 'masque'],
          ['result', 'atténué'],
        ])}>` +
        `<feFuncA${attributs([
          ['type', 'linear'],
          ['slope', f.intensite],
          ['intercept', 0],
        ])}/>` +
        `</feComponentTransfer>` +
        `<feBlend${attributs([
          ['in', 'SourceGraphic'],
          ['in2', 'atténué'],
          ['mode', 'multiply'],
        ])}/>` +
        `</filter>`
      );
    })
    .join('');
}

function emettreDecoupes(decoupes: Decoupe[]): string {
  const contenu = decoupes
    .map(
      (d) =>
        `<clipPath id="${echapper(d.id)}">` +
        `<circle${attributs([
          ['cx', d.cercle.cx],
          ['cy', d.cercle.cy],
          ['r', d.cercle.r],
        ])}/></clipPath>`,
    )
    .join('');
  return contenu;
}

export interface OptionsEmission {
  /**
   * Faces a declarer en `@font-face`, deja encodees en base64.
   *
   * resvg **ne lit pas** ces declarations — il ne connait que les tampons qu'on
   * lui passe. Elles ne servent qu'a rendre le `.svg` exporte lisible dans un
   * navigateur ou un logiciel de dessin. Les omettre ne change rien au PNG.
   */
  facesEmbarquees?: { famille: string; graisse: number; base64: string }[];
}

export function emettreSvg(scene: Scene, options: OptionsEmission = {}): string {
  const faces = options.facesEmbarquees ?? [];
  const style = faces.length
    ? `<style>${faces
        .map(
          (f) =>
            `@font-face{font-family:'${f.famille}';font-weight:${f.graisse};` +
            `src:url('data:font/woff2;base64,${f.base64}') format('woff2');}`,
        )
        .join('')}</style>`
    : '';

  const ouverture =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${n(scene.largeur)} ${n(scene.hauteur)}">`;

  const defs =
    emettreDegrades(scene.degrades) +
    emettreFiltres(scene.filtres) +
    emettreDecoupes(scene.decoupes);

  return (
    ouverture +
    style +
    (defs ? `<defs>${defs}</defs>` : '') +
    scene.noeuds.map(emettreNoeud).join('') +
    `</svg>`
  );
}
