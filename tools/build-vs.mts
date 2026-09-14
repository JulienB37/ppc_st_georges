/**
 * Genere le module du logo VS depuis assets-src/vs-eclaboussure.svg.
 *
 * Le trace livre est une vectorisation automatique : l'encre n'occupe pas tout
 * son viewBox, et les marges sont inegales. Centrer le viewBox dans une carte
 * decalerait donc visiblement la marque.
 *
 * Ce script rasterise le trace et MESURE la boite d'encre, pour que la
 * transformation cible ne place que celle-ci. Meme raison que pour le coup de
 * pinceau, ou l'estimation a l'oeil s'etait trompee de 72 %.
 *
 * Usage : npm run assets:vs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { initWasm, Resvg } from '@resvg/resvg-wasm';

const RACINE = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RACINE, 'assets-src/vs-eclaboussure.svg');
const DEST = path.join(RACINE, 'projects/poster-core/src/render/vs.generated.ts');

async function main(): Promise<void> {
  const brut = await readFile(SRC, 'utf8');
  const vb = /viewBox="([\d.\s]+)"/.exec(brut)![1]!.trim().split(/\s+/).map(Number);
  const [, , largeurSource, hauteurSource] = vb as [number, number, number, number];
  const transformInterne = /<g transform="([^"]+)"/.exec(brut)![1]!;
  const chemins = [...brut.matchAll(/<path d="([^"]+)"/g)].map((m) =>
    m[1]!.replace(/\s+/g, ' ').trim(),
  );
  if (!chemins.length) throw new Error('Aucun trace trouve dans le SVG source.');

  await initWasm(await readFile(path.join(RACINE, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')));
  const image = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeurSource} ${hauteurSource}">` +
      `<g transform="${transformInterne}">` +
      chemins.map((d) => `<path d="${d}" fill="#ffffff"/>`).join('') +
      `</g></svg>`,
    { fitTo: { mode: 'width', value: 1200 } },
  ).render();

  const { pixels, width: L, height: H } = image;
  let xMin = L;
  let xMax = -1;
  let yMin = H;
  let yMax = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      if (pixels[(y * L + x) * 4 + 3]! <= 128) continue;
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  if (xMax < 0) throw new Error("Aucune encre detectee dans le trace.");

  const boite = {
    x: (xMin / L) * largeurSource,
    y: (yMin / H) * hauteurSource,
    largeur: ((xMax - xMin + 1) / L) * largeurSource,
    hauteur: ((yMax - yMin + 1) / H) * hauteurSource,
  };
  console.log(
    `encre : x ${boite.x.toFixed(0)}-${(boite.x + boite.largeur).toFixed(0)}, ` +
      `y ${boite.y.toFixed(0)}-${(boite.y + boite.hauteur).toFixed(0)} ` +
      `sur ${largeurSource} x ${hauteurSource} ` +
      `(${((100 * boite.largeur) / largeurSource).toFixed(0)} % x ` +
      `${((100 * boite.hauteur) / hauteurSource).toFixed(0)} %), ` +
      `rapport ${(boite.largeur / boite.hauteur).toFixed(3)}`,
  );

  await writeFile(
    DEST,
    `/* Genere par tools/build-vs.mts depuis assets-src/vs-eclaboussure.svg. Ne pas modifier a la main. */

/**
 * Logo « VS » en eclaboussure, fourni par le club.
 *
 * Les lettres sont AJOUREES : le trace ne dessine que l'eclaboussure, les
 * lettres etant des trous. Le remplissage donne donc la couleur de la tache, et
 * les lettres prennent celle du fond qu'on lui pose derriere.
 *
 * Conserve en vectoriel plutot que rasterise : net a toute echelle, et
 * recolorable par simple changement de remplissage.
 *
 * \`boiteEncre\` est MESUREE, pas estimee : le trace vient d'une vectorisation
 * automatique, ses marges sont inegales, et centrer le viewBox decalerait la
 * marque.
 */
export const VS = {
  largeurSource: ${largeurSource},
  hauteurSource: ${hauteurSource},
  /** Etendue reellement encree, en unites du viewBox source. */
  boiteEncre: {
    x: ${boite.x.toFixed(1)},
    y: ${boite.y.toFixed(1)},
    largeur: ${boite.largeur.toFixed(1)},
    hauteur: ${boite.hauteur.toFixed(1)},
  },
  /** Rapport largeur / hauteur de l'encre, pour cadrer sans deformer. */
  rapport: ${(boite.largeur / boite.hauteur).toFixed(4)},
  /** Transformation interne du trace vectorise, a appliquer en premier. */
  transformInterne: '${transformInterne}',
  chemins: [
${chemins.map((d) => `    '${d}',`).join('\n')}
  ],
} as const;

/**
 * Transformation centrant l'ENCRE du trace sur un point, a une hauteur donnee.
 *
 * L'echelle est uniforme : une eclaboussure etiree se voit immediatement, a la
 * difference d'un coup de brosse allonge.
 */
export function transformVs(cx: number, cy: number, hauteur: number): string {
  const k = hauteur / VS.boiteEncre.hauteur;
  const largeur = VS.boiteEncre.largeur * k;
  return (
    \`translate(\${cx - largeur / 2} \${cy - hauteur / 2}) scale(\${k}) \` +
    \`translate(\${-VS.boiteEncre.x} \${-VS.boiteEncre.y}) \${VS.transformInterne}\`
  );
}
`,
  );
}

await main();
