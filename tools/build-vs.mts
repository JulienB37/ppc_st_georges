/**
 * Genere le module du logo VS depuis assets-src/vs-eclaboussure.svg.
 *
 * Le trace livre est une vectorisation automatique, et il pose deux problemes
 * qu'on ne peut pas resoudre a l'oeil :
 *
 * 1. L'encre n'occupe pas tout son viewBox, et ses marges sont inegales :
 *    centrer le viewBox decalerait visiblement la marque.
 * 2. Les lettres « VS » sont AJOUREES — ce sont des trous. Les rendre blanches
 *    demande un aplat pose dessous, mais cet aplat doit rester DANS la
 *    silhouette de l'eclaboussure, sinon il deborde de la tache.
 *
 * Ce script rasterise le trace et mesure les deux : la boite d'encre, puis une
 * union de disques couvrant les lettres sans sortir de la silhouette. Meme
 * raison que pour le coup de pinceau, ou l'estimation a l'oeil s'etait trompee
 * de 72 %.
 *
 * Usage : npm run assets:vs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { initWasm, Resvg } from '@resvg/resvg-wasm';

const RACINE = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RACINE, 'assets-src/vs-eclaboussure.svg');
const DEST = path.join(RACINE, 'projects/poster-core/src/render/vs.generated.ts');

/** Largeur de rasterisation. Assez fine pour mesurer au pixel du viewBox. */
const LARGEUR_MESURE = 1200;

interface Masque {
  /** Vrai si le pixel appartient a la silhouette, trous rebouches. */
  silhouette: Uint8Array;
  /** Vrai si le pixel est un trou interieur : une lettre. */
  trou: Uint8Array;
  L: number;
  H: number;
}

/**
 * Rebouche les trous du trace.
 *
 * Un pixel transparent est « dehors » s'il communique avec le bord de l'image
 * par un chemin transparent. Tout le reste est la silhouette. Ce qui est
 * transparent SANS communiquer avec le bord est donc un trou interieur, c'est
 * a dire une lettre.
 */
function masquer(pixels: Uint8Array, L: number, H: number): Masque {
  const encre = new Uint8Array(L * H);
  for (let i = 0; i < L * H; i++) encre[i] = pixels[i * 4 + 3]! > 128 ? 1 : 0;

  const dehors = new Uint8Array(L * H);
  const pile: number[] = [];
  const pousser = (i: number) => {
    if (!encre[i] && !dehors[i]) {
      dehors[i] = 1;
      pile.push(i);
    }
  };
  for (let x = 0; x < L; x++) {
    pousser(x);
    pousser((H - 1) * L + x);
  }
  for (let y = 0; y < H; y++) {
    pousser(y * L);
    pousser(y * L + L - 1);
  }
  while (pile.length) {
    const i = pile.pop()!;
    const x = i % L;
    const y = (i - x) / L;
    if (x > 0) pousser(i - 1);
    if (x < L - 1) pousser(i + 1);
    if (y > 0) pousser(i - L);
    if (y < H - 1) pousser(i + L);
  }

  const silhouette = new Uint8Array(L * H);
  const trou = new Uint8Array(L * H);
  for (let i = 0; i < L * H; i++) {
    silhouette[i] = encre[i] || !dehors[i] ? 1 : 0;
    trou[i] = !encre[i] && !dehors[i] ? 1 : 0;
  }
  return { silhouette, trou, L, H };
}

/**
 * Transformee de distance euclidienne exacte, algorithme separable de
 * Felzenszwalb : distance de chaque pixel de silhouette au fond le plus proche.
 *
 * Elle donne, pour tout centre, le rayon du plus grand disque qui y tient sans
 * sortir de la silhouette. C'est ce qui permet de garantir la contrainte plutot
 * que de l'esperer.
 */
function transformeeDistance(masque: Uint8Array, L: number, H: number): Float64Array {
  const INF = 1e12;
  const carre = new Float64Array(L * H);
  for (let i = 0; i < L * H; i++) carre[i] = masque[i] ? INF : 0;

  const passe = (
    n: number,
    lire: (i: number) => number,
    ecrire: (i: number, v: number) => void,
  ) => {
    const v = new Int32Array(n);
    const z = new Float64Array(n + 1);
    const f = new Float64Array(n);
    for (let i = 0; i < n; i++) f[i] = lire(i);
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = 0;
      for (;;) {
        const p = v[k]!;
        s = (f[q]! + q * q - (f[p]! + p * p)) / (2 * q - 2 * p);
        if (s <= z[k]!) k--;
        else break;
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1]! < q) k++;
      const p = v[k]!;
      ecrire(q, (q - p) * (q - p) + f[p]!);
    }
  };

  const tmp = new Float64Array(L * H);
  for (let y = 0; y < H; y++) {
    passe(
      L,
      (x) => carre[y * L + x]!,
      (x, val) => {
        tmp[y * L + x] = val;
      },
    );
  }
  for (let x = 0; x < L; x++) {
    passe(
      H,
      (y) => tmp[y * L + x]!,
      (y, val) => {
        carre[y * L + x] = val;
      },
    );
  }
  for (let i = 0; i < L * H; i++) carre[i] = Math.sqrt(carre[i]!);
  return carre;
}

/**
 * Recouvre les lettres par une union de disques tenant dans la silhouette.
 *
 * Aucun disque unique n'y suffit : le plus grand inscrit ne couvre que 96,7 %
 * des lettres, et la meilleure ellipse inscrite 99,2 %. On place donc
 * iterativement le plus grand disque possible sur le pixel de lettre le plus
 * eloigne du bord, jusqu'a tout couvrir.
 */
function recouvrirLettres(
  m: Masque,
  maxDisques = 12,
): { disques: { cx: number; cy: number; r: number }[]; couverture: number } {
  const { silhouette, trou, L, H } = m;
  const distance = transformeeDistance(silhouette, L, H);

  const lettres: number[] = [];
  for (let i = 0; i < L * H; i++) if (trou[i]) lettres.push(i);
  if (!lettres.length) {
    throw new Error('Aucun trou interieur : le trace ne porte pas de lettres ajourees.');
  }

  const couvert = new Uint8Array(L * H);
  const disques: { cx: number; cy: number; r: number }[] = [];
  let restants = lettres.length;

  while (restants > 0 && disques.length < maxDisques) {
    // Le pixel non couvert le plus loin du bord : c'est lui qui autorise le
    // plus grand disque, donc le meilleur progres a chaque tour.
    let meilleur = -1;
    let meilleureD = 0;
    for (const i of lettres) {
      if (couvert[i]) continue;
      if (distance[i]! > meilleureD) {
        meilleureD = distance[i]!;
        meilleur = i;
      }
    }
    if (meilleur < 0) break;
    // Un pixel de marge : le disque doit rester strictement dans la silhouette.
    const r = Math.max(1, meilleureD - 1);
    const cx = meilleur % L;
    const cy = (meilleur - cx) / L;
    disques.push({ cx, cy, r });

    const r2 = r * r;
    for (const i of lettres) {
      if (couvert[i]) continue;
      const x = i % L;
      const y = (i - x) / L;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
        couvert[i] = 1;
        restants--;
      }
    }
  }

  return { disques, couverture: (lettres.length - restants) / lettres.length };
}

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
  const masque = masquer(pixels, L, H);

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
  if (xMax < 0) throw new Error('Aucune encre detectee dans le trace.');

  const versVbX = (px: number) => (px / L) * largeurSource;
  const versVbY = (px: number) => (px / H) * hauteurSource;

  const boite = {
    x: versVbX(xMin),
    y: versVbY(yMin),
    largeur: versVbX(xMax - xMin + 1),
    hauteur: versVbY(yMax - yMin + 1),
  };

  const couverture = recouvrirLettres(masque);
  const disques = couverture.disques.map((d) => ({
    cx: versVbX(d.cx),
    cy: versVbY(d.cy),
    r: versVbX(d.r),
  }));

  console.log(
    `encre : x ${boite.x.toFixed(0)}-${(boite.x + boite.largeur).toFixed(0)}, ` +
      `y ${boite.y.toFixed(0)}-${(boite.y + boite.hauteur).toFixed(0)} ` +
      `sur ${largeurSource} x ${hauteurSource}, rapport ${(boite.largeur / boite.hauteur).toFixed(3)}`,
  );
  console.log(
    `aplat blanc : ${disques.length} disque(s), couvre ` +
      `${(couverture.couverture * 100).toFixed(2)} % des pixels de lettre`,
  );
  if (couverture.couverture < 0.999) {
    throw new Error(
      `L'aplat ne couvre que ${(couverture.couverture * 100).toFixed(2)} % des lettres : ` +
        `une part resterait a la couleur du fond. Revoir la forme de l'aplat.`,
    );
  }

  await writeFile(
    DEST,
    `/* Genere par tools/build-vs.mts depuis assets-src/vs-eclaboussure.svg. Ne pas modifier a la main. */

/**
 * Logo « VS » en eclaboussure, fourni par le club.
 *
 * Les lettres sont AJOUREES : le trace ne dessine que l'eclaboussure, les
 * lettres etant des trous. Le remplissage donne la couleur de la tache, et les
 * lettres prennent celle de l'aplat pose dessous.
 *
 * Conserve en vectoriel plutot que rasterise : net a toute echelle, et
 * recolorable par simple changement de remplissage.
 *
 * Les deux geometries sont MESUREES, pas estimees.
 */
export const VS = {
  largeurSource: ${largeurSource},
  hauteurSource: ${hauteurSource},
  /**
   * Etendue reellement encree, en unites du viewBox.
   *
   * Le trace vient d'une vectorisation automatique : ses marges sont inegales,
   * et centrer le viewBox decalerait la marque.
   */
  boiteEncre: {
    x: ${boite.x.toFixed(1)},
    y: ${boite.y.toFixed(1)},
    largeur: ${boite.largeur.toFixed(1)},
    hauteur: ${boite.hauteur.toFixed(1)},
  },
  /** Rapport largeur / hauteur de l'encre, pour cadrer sans deformer. */
  rapport: ${(boite.largeur / boite.hauteur).toFixed(4)},
  /**
   * Aplat blanc des lettres, en unites du viewBox : une union de disques qui
   * couvre les lettres SANS sortir de la silhouette, donc sans deborder de la
   * tache. Chaque rayon vient de la transformee de distance de la silhouette,
   * ce qui garantit la contrainte au lieu de l'esperer.
   *
   * Un disque unique ne suffit pas — le plus grand inscrit ne couvre que 96,7 %
   * des lettres, et la meilleure ellipse inscrite 99,2 %.
   *
   * Verifie a la generation : couverture de ${(couverture.couverture * 100).toFixed(2)} %.
   */
  disques: [
${disques.map((d) => `    { cx: ${d.cx.toFixed(1)}, cy: ${d.cy.toFixed(1)}, r: ${d.r.toFixed(1)} },`).join('\n')}
  ],
  /** Transformation interne du trace vectorise, propre aux chemins. */
  transformInterne: '${transformInterne}',
  chemins: [
${chemins.map((d2) => `    '${d2}',`).join('\n')}
  ],
} as const;

/**
 * Transformation menant le viewBox source dans une boite cible, encre centree
 * sur un point.
 *
 * L'echelle est uniforme : une eclaboussure etiree se voit immediatement, a la
 * difference d'un coup de brosse allonge.
 *
 * Elle s'arrete au repere du viewBox, sans appliquer \`transformInterne\` : le
 * disque s'exprime en unites de viewBox, les chemins dans leur propre repere.
 */
export function transformVs(cx: number, cy: number, hauteur: number): string {
  const k = hauteur / VS.boiteEncre.hauteur;
  const largeur = VS.boiteEncre.largeur * k;
  return (
    \`translate(\${cx - largeur / 2} \${cy - hauteur / 2}) scale(\${k}) \` +
    \`translate(\${-VS.boiteEncre.x} \${-VS.boiteEncre.y})\`
  );
}
`,
  );
}

await main();
