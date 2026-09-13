/**
 * Spike : resvg-wasm est-il un socle de rendu viable ?
 *
 * Trois questions, toutes bloquantes pour le moteur d'affiche :
 *
 *  1. resvg-wasm avale-t-il des WOFF2 sous-ensembles via `fontBuffers`, et
 *     apparie-t-il correctement `font-family` + `font-weight` ? (Les faces 500
 *     et 600 de Barlow encodent leur graisse dans le nom de famille herite.)
 *  2. La largeur d'avance calculee par fontkit predit-elle ce que resvg
 *     rasterise ? C'est l'hypothese fondatrice du moteur de mise en page :
 *     on mesure en Node, on positionne, et resvg doit tomber d'accord.
 *  3. Poids du .wasm et temps de rendu a la taille reelle de l'affiche.
 *
 * Usage : node tools/spikes/resvg-fontkit.mjs
 */
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { initWasm, Resvg } from '@resvg/resvg-wasm';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');

const RACINE = path.resolve(import.meta.dirname, '../..');
const FONTS = path.join(RACINE, 'projects/app/public/assets/fonts');
const WASM = path.join(RACINE, 'node_modules/@resvg/resvg-wasm/index_bg.wasm');

const TEXTE_LONG = 'ASJ La Chaussée St Victor 1';

/** Scanne le tampon RGBA et renvoie les colonnes extremes contenant de l'encre. */
function etendueEncre(pixels, largeur, hauteur) {
  let gauche = Infinity;
  let droite = -Infinity;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const i = (y * largeur + x) * 4;
      // Fond blanc opaque : toute valeur nettement plus sombre est de l'encre.
      if (pixels[i] < 128) {
        if (x < gauche) gauche = x;
        if (x > droite) droite = x;
      }
    }
  }
  return gauche === Infinity ? null : { gauche, droite, largeur: droite - gauche + 1 };
}

function svgTexte({ texte, famille, graisse, taille, x, y, largeur, hauteur, ancre = 'start' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" height="${hauteur}">
  <rect width="${largeur}" height="${hauteur}" fill="#ffffff"/>
  <text x="${x}" y="${y}" text-anchor="${ancre}"
        font-family="${famille}" font-weight="${graisse}" font-size="${taille}"
        fill="#000000">${texte}</text>
</svg>`;
}

function rendre(svg, fontBuffers, largeur) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: largeur },
    font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'Barlow Semi Condensed' },
  });
  const image = resvg.render();
  return { pixels: image.pixels, largeur: image.width, hauteur: image.height, image };
}

async function main() {
  const octetsWasm = (await stat(WASM)).size;
  await initWasm(await readFile(WASM));

  const manifeste = JSON.parse(await readFile(path.join(FONTS, 'fonts.manifest.json'), 'utf8'));
  const buffers = [];
  const parGraisse = new Map();
  for (const face of manifeste.faces) {
    const buf = await readFile(path.join(FONTS, face.fichier));
    buffers.push(buf);
    parGraisse.set(`${face.famille}|${face.graisse}`, { face, buf });
  }

  console.log(`wasm : ${(octetsWasm / 1024).toFixed(0)} Ko brut`);
  console.log(
    `polices chargees : ${buffers.length} faces, ${(buffers.reduce((a, b) => a + b.length, 0) / 1024).toFixed(0)} Ko\n`,
  );

  // ---------------------------------------------------------------- question 1
  console.log('1. Appariement famille + graisse');
  const L = 1400;
  const H = 200;
  const TAILLE = 100;
  const X = 50;
  const signatures = new Map();

  for (const graisse of [400, 500, 600, 700]) {
    const svg = svgTexte({
      texte: TEXTE_LONG,
      famille: 'Barlow Semi Condensed',
      graisse,
      taille: TAILLE,
      x: X,
      y: 140,
      largeur: L,
      hauteur: H,
    });
    const { pixels, largeur, hauteur } = rendre(svg, buffers, L);
    const encre = etendueEncre(pixels, largeur, hauteur);

    // Nombre de pixels encres : signature simple mais suffisante pour
    // distinguer deux graisses (une Bold noircit plus qu'une Regular).
    let sombres = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 128) sombres++;

    const entree = parGraisse.get(`Barlow Semi Condensed|${graisse}`);
    const police = fontkit.create(entree.buf);
    const avance = (police.layout(TEXTE_LONG).advanceWidth / police.unitsPerEm) * TAILLE;

    signatures.set(graisse, sombres);
    console.log(
      `   ${graisse} : encre ${String(sombres).padStart(6)} px, ` +
        `ink ${String(encre.largeur).padStart(4)} px, avance fontkit ${avance.toFixed(1)} px`,
    );
  }

  const distinctes = new Set(signatures.values()).size;
  console.log(
    distinctes === signatures.size
      ? `   => OK : les ${distinctes} graisses rendent differemment, aucun repli silencieux.\n`
      : `   => ECHEC : seulement ${distinctes} rendus distincts sur ${signatures.size}. ` +
          `resvg retombe sur une face unique.\n`,
  );

  // ---------------------------------------------------------------- question 2
  console.log('2. Accord fontkit <-> resvg sur les largeurs');
  const CHAINES = [
    'ASJ La Chaussée St Victor 1',
    'PPC St Georges 1',
    'Dimanche 20 septembre à 9h30',
    'Blois Ping 41 6',
    'VS',
  ];
  let pireEcart = 0;
  for (const texte of CHAINES) {
    const entree = parGraisse.get('Barlow Semi Condensed|600');
    const police = fontkit.create(entree.buf);
    const avance = (police.layout(texte).advanceWidth / police.unitsPerEm) * TAILLE;

    const svg = svgTexte({
      texte,
      famille: 'Barlow Semi Condensed',
      graisse: 600,
      taille: TAILLE,
      x: X,
      y: 140,
      largeur: L,
      hauteur: H,
    });
    const { pixels, largeur, hauteur } = rendre(svg, buffers, L);
    const encre = etendueEncre(pixels, largeur, hauteur);

    // L'encre est toujours un peu plus etroite que l'avance : elle exclut les
    // approches laterales du premier et du dernier glyphe. Ce qui compte pour
    // le moteur, c'est que l'avance soit un majorant fiable.
    const droiteEncre = encre.droite + 1 - X;
    const ecart = ((avance - droiteEncre) / avance) * 100;
    pireEcart = Math.max(pireEcart, Math.abs(ecart));
    const verdict = droiteEncre <= avance ? 'ok' : 'DEBORDE';
    console.log(
      `   ${texte.padEnd(30)} avance ${avance.toFixed(1).padStart(7)}  ` +
        `encre ${String(droiteEncre).padStart(5)}  marge ${ecart.toFixed(2).padStart(6)} %  ${verdict}`,
    );
  }
  console.log(`   => ecart maximal avance/encre : ${pireEcart.toFixed(2)} %\n`);

  // -------------------------------------------------------- centrage (anchor)
  console.log('3. Centrage text-anchor="middle"');
  const centreVoulu = L / 2;
  const svgCentre = svgTexte({
    texte: TEXTE_LONG,
    famille: 'Barlow Semi Condensed',
    graisse: 600,
    taille: TAILLE,
    x: centreVoulu,
    y: 140,
    largeur: L,
    hauteur: H,
    ancre: 'middle',
  });
  const rc = rendre(svgCentre, buffers, L);
  const encreC = etendueEncre(rc.pixels, rc.largeur, rc.hauteur);
  const centreMesure = (encreC.gauche + encreC.droite) / 2;
  console.log(
    `   centre voulu ${centreVoulu}, centre de l'encre ${centreMesure.toFixed(1)}, ` +
      `derive ${(centreMesure - centreVoulu).toFixed(1)} px sur ${TAILLE} px de corps\n`,
  );

  // ---------------------------------------------------------------- question 3
  console.log('4. Temps de rendu a la taille de l affiche (1080 x 1350)');
  const svgAffiche = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#12497A"/>
  ${Array.from({ length: 8 }, (_, i) => {
    const y = 200 + i * 100;
    return `<rect x="48" y="${y}" width="984" height="72" rx="16" fill="#fff"/>
    <text x="140" y="${y + 48}" font-family="Barlow Semi Condensed" font-weight="700" font-size="34" fill="#101820">PPC St Georges ${i + 1}</text>
    <text x="1012" y="${y + 48}" text-anchor="end" font-family="Barlow Semi Condensed" font-weight="500" font-size="34" fill="#101820">ASJ La Chaussée St Victor 1</text>`;
  }).join('\n  ')}
  <text x="48" y="120" font-family="Anton" font-size="62" fill="#fff">Les rencontres du week-end</text>
</svg>`;

  for (const [libelle, largeurCible] of [
    ['apercu  540 px', 540],
    ['export 1080 px', 1080],
    ['export 2160 px', 2160],
  ]) {
    rendre(svgAffiche, buffers, largeurCible); // chauffe
    const t0 = performance.now();
    const N = 5;
    for (let i = 0; i < N; i++) rendre(svgAffiche, buffers, largeurCible);
    const ms = (performance.now() - t0) / N;
    console.log(`   ${libelle} : ${ms.toFixed(1)} ms / rendu`);
  }

  const t0 = performance.now();
  const png = rendre(svgAffiche, buffers, 1080).image.asPng();
  console.log(
    `   encodage PNG 1080 px : ${(performance.now() - t0).toFixed(1)} ms, ` +
      `${(png.length / 1024).toFixed(0)} Ko`,
  );
}

await main();
