/**
 * Genere le module du coup de pinceau depuis assets-src/pinceau-bande.svg.
 *
 * Le trace livre est une vectorisation automatique : sa partie PLEINE n'occupe
 * qu'une fraction de la hauteur de son viewBox, le reste etant du vide. Poser
 * le viewBox entier dans une bande revient donc a etirer du vide, et la bande
 * parait quatre fois plus fine qu'elle ne devrait.
 *
 * Ce script rasterise le trace et MESURE sa bande pleine, pour que la
 * transformation cible ne place que celle-ci.
 *
 * Usage : npm run assets:pinceau
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { initWasm, Resvg } from '@resvg/resvg-wasm';

const RACINE = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RACINE, 'assets-src/pinceau-bande.svg');
const DEST = path.join(RACINE, 'projects/poster-core/src/render/pinceau.generated.ts');

/** Une ligne est « pleine » si elle couvre au moins cette part de la largeur. */
const SEUIL_COUVERTURE = 0.2;

async function main(): Promise<void> {
  const brut = await readFile(SRC, 'utf8');
  const vb = /viewBox="([\d.\s]+)"/.exec(brut)![1]!.trim().split(/\s+/).map(Number);
  const [, , largeurSource, hauteurSource] = vb as [number, number, number, number];
  const transformInterne = /<g transform="([^"]+)"/.exec(brut)![1]!;
  const chemins = [...brut.matchAll(/<path d="([^"]+)"/g)].map((m) =>
    m[1]!.replace(/\s+/g, ' ').trim(),
  );
  // Les eclats satellites ne seraient que du bruit a la taille d'une bande.
  const chemin = chemins.reduce((a, b) => (a.length >= b.length ? a : b));

  await initWasm(await readFile(path.join(RACINE, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')));
  const image = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeurSource} ${hauteurSource}">` +
      `<g transform="${transformInterne}"><path d="${chemin}" fill="#ffffff"/></g></svg>`,
    { fitTo: { mode: 'width', value: 900 } },
  ).render();

  const { pixels, width: L, height: H } = image;
  let premiere = -1;
  let derniere = -1;
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < L; x++) if (pixels[(y * L + x) * 4 + 3]! > 128) n++;
    if (n / L >= SEUIL_COUVERTURE) {
      if (premiere < 0) premiere = y;
      derniere = y;
    }
  }
  if (premiere < 0) throw new Error('Aucune ligne pleine detectee dans le trace.');

  const haut = (premiere / H) * hauteurSource;
  const hauteurPleine = ((derniere - premiere + 1) / H) * hauteurSource;
  console.log(
    `bande pleine : y ${haut.toFixed(0)} a ${(haut + hauteurPleine).toFixed(0)} sur ` +
      `${hauteurSource} (${((100 * hauteurPleine) / hauteurSource).toFixed(0)} % de la hauteur)`,
  );

  await writeFile(
    DEST,
    `/* Genere par tools/build-pinceau.mts depuis assets-src/pinceau-bande.svg. Ne pas modifier a la main. */

/**
 * Coup de pinceau vectoriel, fourni par le club.
 *
 * Conserve en vectoriel plutot que rasterise : il reste net a toute echelle et
 * se recolore par simple changement de remplissage, ce qui lui permet de suivre
 * la teinte cyclee de chaque creneau.
 *
 * \`bandePleine\` est MESUREE, pas estimee : le trace venant d'une vectorisation
 * automatique, sa partie pleine n'occupe qu'une fraction de son viewBox. Placer
 * le viewBox entier dans une bande reviendrait a etirer du vide.
 */
export const PINCEAU = {
  largeurSource: ${largeurSource},
  hauteurSource: ${hauteurSource},
  /** Bande reellement encree, en unites du viewBox source. */
  bandePleine: { haut: ${haut.toFixed(1)}, hauteur: ${hauteurPleine.toFixed(1)} },
  /** Transformation interne du trace vectorise, a appliquer en premier. */
  transformInterne: '${transformInterne}',
  chemin:
    '${chemin}',
} as const;

/**
 * Transformation menant la BANDE PLEINE du trace dans un rectangle donne.
 *
 * L'etirement horizontal est volontairement non uniforme : un coup de brosse
 * allonge reste credible, et la bande doit suivre la longueur de la date.
 */
export function transformPinceau(x: number, y: number, largeur: number, hauteur: number): string {
  const sx = largeur / PINCEAU.largeurSource;
  const sy = hauteur / PINCEAU.bandePleine.hauteur;
  return (
    \`translate(\${x} \${y}) scale(\${sx} \${sy}) \` +
    \`translate(0 \${-PINCEAU.bandePleine.haut}) \${PINCEAU.transformInterne}\`
  );
}
`,
  );
}

await main();
