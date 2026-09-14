/**
 * Spike : resvg sait-il produire une texture de peinture ?
 *
 * L'effet « pinceau » de l'affiche de reference repose sur des bords
 * dechires et de la matiere. En SVG, cela s'obtient par `feTurbulence`
 * (bruit) combine a `feDisplacementMap` (deformation du contour).
 *
 * Si resvg ne les implemente pas, le rendu serait silencieusement lisse — ou
 * l'element disparaitrait. On mesure donc l'ecart pixel entre une forme nue et
 * la meme forme filtree : nul, le filtre est ignore.
 *
 * Usage : node tools/spikes/resvg-filtres.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { initWasm, Resvg } from '@resvg/resvg-wasm';

const RACINE = path.resolve(import.meta.dirname, '../..');
const WASM = path.join(RACINE, 'node_modules/@resvg/resvg-wasm/index_bg.wasm');

const L = 400;
const H = 200;

/** Une bande rouge unie, avec ou sans filtre applique. */
function svg(filtre, definition = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${H}" width="${L}" height="${H}">
  <defs>${definition}</defs>
  <rect width="${L}" height="${H}" fill="#ffffff"/>
  <rect x="40" y="60" width="320" height="80" fill="#E4032E"${filtre ? ` filter="url(#${filtre})"` : ''}/>
</svg>`;
}

function rendre(source) {
  const r = new Resvg(source, {
    fitTo: { mode: 'width', value: L },
    font: { loadSystemFonts: false },
  });
  const img = r.render();
  return { pixels: img.pixels, largeur: img.width, hauteur: img.height };
}

/** Nombre de pixels differant entre deux rendus, et pixels encres de chacun. */
function comparer(a, b) {
  let differents = 0;
  let encreA = 0;
  let encreB = 0;
  for (let i = 0; i < a.pixels.length; i += 4) {
    const rougeA = a.pixels[i] > 120 && a.pixels[i + 1] < 120;
    const rougeB = b.pixels[i] > 120 && b.pixels[i + 1] < 120;
    if (rougeA) encreA++;
    if (rougeB) encreB++;
    if (
      Math.abs(a.pixels[i] - b.pixels[i]) > 8 ||
      Math.abs(a.pixels[i + 1] - b.pixels[i + 1]) > 8 ||
      Math.abs(a.pixels[i + 2] - b.pixels[i + 2]) > 8
    ) {
      differents++;
    }
  }
  return { differents, encreA, encreB };
}

const CAS = [
  {
    nom: 'feGaussianBlur',
    id: 'f-flou',
    def: `<filter id="f-flou"><feGaussianBlur stdDeviation="6"/></filter>`,
  },
  {
    nom: 'feTurbulence seul',
    id: 'f-bruit',
    def: `<filter id="f-bruit"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4"/></filter>`,
  },
  {
    nom: 'feTurbulence + feDisplacementMap',
    id: 'f-peinture',
    def:
      `<filter id="f-peinture" x="-20%" y="-40%" width="140%" height="180%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="5" seed="7" result="bruit"/>` +
      `<feDisplacementMap in="SourceGraphic" in2="bruit" scale="26" xChannelSelector="R" yChannelSelector="G"/>` +
      `</filter>`,
  },
  {
    nom: 'feTurbulence + feComposite (grain)',
    id: 'f-grain',
    def:
      `<filter id="f-grain">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="grain"/>` +
      `<feComposite in="grain" in2="SourceGraphic" operator="in" result="masque"/>` +
      `<feBlend in="SourceGraphic" in2="masque" mode="multiply"/>` +
      `</filter>`,
  },
  {
    nom: 'feMorphology (erosion)',
    id: 'f-erode',
    def: `<filter id="f-erode"><feMorphology operator="erode" radius="4"/></filter>`,
  },
];

async function main() {
  await initWasm(await readFile(WASM));
  const nu = rendre(svg(null));
  console.log(`reference : ${nu.largeur}x${nu.hauteur}\n`);

  for (const cas of CAS) {
    try {
      const filtre = rendre(svg(cas.id, cas.def));
      const { differents, encreA, encreB } = comparer(nu, filtre);
      const total = nu.largeur * nu.hauteur;
      const verdict =
        differents === 0
          ? 'IGNORE (rendu identique)'
          : encreB === 0
            ? 'DETRUIT (plus rien de visible)'
            : 'APPLIQUE';
      console.log(
        `${cas.nom.padEnd(34)} ${verdict.padEnd(30)} ` +
          `${((100 * differents) / total).toFixed(1)} % de pixels changes, ` +
          `encre ${encreA} -> ${encreB}`,
      );
    } catch (e) {
      console.log(`${cas.nom.padEnd(34)} ECHEC : ${String(e).slice(0, 70)}`);
    }
  }
}

await main();
