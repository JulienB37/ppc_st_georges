/**
 * Genere le module de l'anneau au pinceau depuis assets-src/anneau-pinceau.svg.
 *
 * Le trace est un cercle brosse, volontairement discontinu et d'epaisseur
 * inegale. Il n'a donc pas de rayon : il en a deux, et aucun des deux n'est
 * lisible dans le fichier.
 *
 * Ce script mesure, depuis le centre de l'encre :
 *   - le rayon INTERIEUR, distance au premier pixel encre, qui borne le disque
 *     libre au milieu et donc la taille du logo qu'on peut y poser ;
 *   - le rayon EXTERIEUR, distance au dernier, qui donne l'encombrement.
 *
 * Sans cette mesure, caler le logo reviendrait a deviner, et l'anneau le
 * mordrait ou flotterait autour — c'est exactement ce qui est arrive au coup de
 * pinceau des dates, ou l'estimation a l'oeil s'etait trompee de 72 %.
 *
 * Usage : npm run assets:anneau
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { initWasm, Resvg } from '@resvg/resvg-wasm';

const RACINE = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RACINE, 'assets-src/anneau-pinceau.svg');
const DEST = path.join(RACINE, 'projects/poster-core/src/render/anneau.generated.ts');

const LARGEUR_MESURE = 1200;

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
    { fitTo: { mode: 'width', value: LARGEUR_MESURE } },
  ).render();

  const { pixels, width: L, height: H } = image;
  const encre: number[] = [];
  let xMin = L;
  let xMax = -1;
  let yMin = H;
  let yMax = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      if (pixels[(y * L + x) * 4 + 3]! <= 128) continue;
      encre.push(y * L + x);
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  if (!encre.length) throw new Error("Aucune encre detectee dans le trace.");

  // Centre de la boite d'encre, et non centroide : sur un anneau discontinu, le
  // centroide derive vers l'arc le plus epais.
  const cxPx = (xMin + xMax + 1) / 2;
  const cyPx = (yMin + yMax + 1) / 2;

  let rInterne = Infinity;
  let rExterne = 0;
  for (const i of encre) {
    const x = i % L;
    const y = (i - x) / L;
    const dist = Math.hypot(x + 0.5 - cxPx, y + 0.5 - cyPx);
    if (dist < rInterne) rInterne = dist;
    if (dist > rExterne) rExterne = dist;
  }

  const enVb = (px: number) => (px / L) * largeurSource;
  const centre = { x: enVb(cxPx), y: (cyPx / H) * hauteurSource };
  const interne = enVb(rInterne);
  const externe = enVb(rExterne);

  console.log(
    `encre : x ${xMin}-${xMax}, y ${yMin}-${yMax} sur ${L} x ${H} px\n` +
      `centre (${centre.x.toFixed(1)}, ${centre.y.toFixed(1)}) en unites viewBox ` +
      `${largeurSource} x ${hauteurSource}\n` +
      `rayon interieur ${interne.toFixed(1)}, exterieur ${externe.toFixed(1)} ` +
      `(epaisseur ${(((externe - interne) / externe) * 100).toFixed(0)} % du rayon)`,
  );

  await writeFile(
    DEST,
    `/* Genere par tools/build-anneau.mts depuis assets-src/anneau-pinceau.svg. Ne pas modifier a la main. */

/**
 * Anneau au pinceau, fourni par le club, pose autour des logos de rencontre.
 *
 * Le trace est un cercle brosse : discontinu, d'epaisseur inegale, et sans
 * rayon unique. Les deux rayons sont donc MESURES a la generation depuis le
 * centre de la boite d'encre — le centroide deriverait vers l'arc le plus
 * epais.
 *
 * Conserve en vectoriel : net a toute echelle, et recolorable par simple
 * changement de remplissage, ce qui permet a l'anneau du club de suivre la
 * teinte du creneau quand celui de l'adversaire reste blanc.
 */
export const ANNEAU = {
  largeurSource: ${largeurSource},
  hauteurSource: ${hauteurSource},
  /** Centre de la boite d'encre, en unites du viewBox. */
  centre: { x: ${centre.x.toFixed(1)}, y: ${centre.y.toFixed(1)} },
  /**
   * Rayon du disque libre au milieu : c'est lui qui borne le contenu, et non
   * le viewBox, dont l'anneau n'occupe pas tout.
   */
  rayonInterieur: ${interne.toFixed(1)},
  /** Rayon du plus lointain pixel encre : l'encombrement reel. */
  rayonExterieur: ${externe.toFixed(1)},
  /** Transformation interne du trace vectorise, propre aux chemins. */
  transformInterne: '${transformInterne}',
  chemins: [
${chemins.map((d) => `    '${d}',`).join('\n')}
  ],
} as const;

/** Encombrement de l'anneau pour un diametre interieur donne. */
export function diametreExterieurAnneau(diametreInterieur: number): number {
  return (diametreInterieur * ANNEAU.rayonExterieur) / ANNEAU.rayonInterieur;
}

/**
 * Transformation placant l'anneau autour d'un point, son disque libre ayant le
 * diametre demande.
 *
 * Elle s'arrete au repere du viewBox : \`transformInterne\` s'applique a un
 * sous-groupe portant les chemins.
 */
export function transformAnneau(cx: number, cy: number, diametreInterieur: number): string {
  const k = diametreInterieur / 2 / ANNEAU.rayonInterieur;
  return \`translate(\${cx} \${cy}) scale(\${k}) translate(\${-ANNEAU.centre.x} \${-ANNEAU.centre.y})\`;
}
`,
  );
}

await main();
