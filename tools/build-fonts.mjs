/**
 * Sous-ensemble les polices de l'affiche en WOFF2.
 *
 * Entree  : assets-src/fonts/*.ttf  (telecharges depuis github.com/google/fonts)
 * Sortie  : projects/app/public/assets/fonts/*.woff2 + fonts.manifest.json
 *
 * Le meme fichier .woff2 alimente ensuite deux consommateurs :
 *   - `FontFace` pour l'interface Angular ;
 *   - `fontBuffers` de resvg-wasm pour le rendu de l'affiche.
 * Une seule source de verite par graisse, donc aucun risque de divergence
 * entre ce qu'on voit a l'ecran et ce qui part sur Facebook.
 *
 * Usage : node tools/build-fonts.mjs
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');

const RACINE = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RACINE, 'assets-src/fonts');
const DEST = path.join(RACINE, 'projects/app/public/assets/fonts');

/**
 * Les graisses reellement utilisees par l'affiche, et elles seules.
 *
 * resvg ne synthetise ni le gras ni l'oblique : demander `font-weight: 700`
 * sans livrer une vraie face Bold ferait rendre la Regular en silence. Chaque
 * graisse employee dans le moteur de rendu doit donc figurer ici.
 */
const FACES = [
  { fichier: 'Anton-Regular.ttf', famille: 'Anton', graisse: 400, role: 'display' },
  {
    fichier: 'BarlowSemiCondensed-Regular.ttf',
    famille: 'Barlow Semi Condensed',
    graisse: 400,
    role: 'texte',
  },
  {
    fichier: 'BarlowSemiCondensed-Medium.ttf',
    famille: 'Barlow Semi Condensed',
    graisse: 500,
    role: 'texte',
  },
  {
    fichier: 'BarlowSemiCondensed-SemiBold.ttf',
    famille: 'Barlow Semi Condensed',
    graisse: 600,
    role: 'texte',
  },
  {
    fichier: 'BarlowSemiCondensed-Bold.ttf',
    famille: 'Barlow Semi Condensed',
    graisse: 700,
    role: 'texte',
  },
  {
    // Caveat n'existe qu'en police variable chez Google Fonts. resvg rendrait
    // silencieusement l'instance par defaut : on fige donc la graisse au
    // sous-ensemblage, ce qui produit une face statique ordinaire.
    fichier: 'Caveat[wght].ttf',
    famille: 'Caveat',
    graisse: 700,
    role: 'manuscrit',
    axes: { wght: 700 },
  },
];

/** Nom de famille typographique (name ID 16), absent des faces Regular/Bold. */
function nomTypographique(police) {
  const rec = police.name?.records?.preferredFamily;
  if (!rec) return undefined;
  return rec.en ?? Object.values(rec)[0];
}

/** Jeu de caracteres conserve : francais complet, plus la ponctuation typographique. */
function jeuDeCaracteres() {
  const plages = [
    [0x20, 0x7e], // ASCII imprimable
    [0xa0, 0xff], // Latin-1 : accents francais, «, », °, €uro exclu (ailleurs)
  ];
  const isoles = [
    0x152,
    0x153, // Œ œ
    0x178, // Ÿ
    0x2013,
    0x2014, // – —
    0x2018,
    0x2019,
    0x201a, // ' ' ‚  (l'apostrophe typographique U+2019 est indispensable)
    0x201c,
    0x201d,
    0x201e, // " " „
    0x2026, // …
    0x20ac, // €
    0x2192, // → (diagnostics d'interface)
  ];

  let sortie = '';
  for (const [debut, fin] of plages) {
    for (let cp = debut; cp <= fin; cp++) sortie += String.fromCodePoint(cp);
  }
  for (const cp of isoles) sortie += String.fromCodePoint(cp);
  return sortie;
}

async function main() {
  const texte = jeuDeCaracteres();
  await mkdir(DEST, { recursive: true });

  const manifeste = [];
  let totalAvant = 0;
  let totalApres = 0;

  for (const face of FACES) {
    const source = await readFile(path.join(SRC, face.fichier));

    const sousEnsemble = await subsetFont(source, texte, {
      targetFormat: 'woff2',
      ...(face.axes ? { variationAxes: face.axes } : {}),
      // Sans cela l'outil peut tronquer la table `name`. Une famille vide et
      // resvg ne retrouverait jamais `font-family="Barlow Semi Condensed"` :
      // il rendrait avec une police de repli, en silence.
      preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 16, 17],
    });

    // Garde n.1 du plan : verifier que la face sous-ensemblee declare toujours
    // la famille et la graisse attendues. Une regeneration d'asset qui
    // renommerait la famille casserait le rendu sans rien afficher d'anormal.
    //
    // Subtilite : au-dela de Regular/Bold, une face Google Fonts encode sa
    // graisse dans le nom de famille herite (name 1 = "Barlow Semi Condensed
    // Medium") et ne publie la vraie famille que dans le nom typographique
    // (name 16). C'est ce dernier que lit fontdb, donc celui que resvg
    // apparie. On accepte donc l'un ou l'autre.
    const controle = fontkit.create(sousEnsemble);
    const familleTypo = nomTypographique(controle) ?? controle.familyName;
    if (controle.familyName !== face.famille && familleTypo !== face.famille) {
      throw new Error(
        `${face.fichier} : familles "${controle.familyName}" / "${familleTypo}" apres ` +
          `sous-ensemblage, attendu "${face.famille}".`,
      );
    }
    const graisseDeclaree = controle['OS/2']?.usWeightClass;
    if (graisseDeclaree !== face.graisse) {
      throw new Error(
        `${face.fichier} : usWeightClass ${graisseDeclaree}, attendu ${face.graisse}. ` +
          `resvg ne synthetise pas le gras : il rendrait une autre face en silence.`,
      );
    }

    const nomSortie = `${face.famille.replace(/\s+/g, '')}-${face.graisse}.woff2`;
    await writeFile(path.join(DEST, nomSortie), sousEnsemble);

    totalAvant += source.length;
    totalApres += sousEnsemble.length;

    manifeste.push({
      fichier: nomSortie,
      famille: face.famille,
      graisse: face.graisse,
      role: face.role,
      octets: sousEnsemble.length,
      unitsPerEm: controle.unitsPerEm,
      source: face.fichier,
    });

    const gain = (100 * (1 - sousEnsemble.length / source.length)).toFixed(1);
    console.log(
      `${nomSortie.padEnd(32)} ${String(sousEnsemble.length).padStart(7)} o  ` +
        `(${controle.familyName} / ${controle.subfamilyName}, -${gain} %)`,
    );
  }

  await writeFile(
    path.join(DEST, 'fonts.manifest.json'),
    JSON.stringify({ genere: 'tools/build-fonts.mjs', faces: manifeste }, null, 2) + '\n',
  );

  console.log(
    `\nTotal : ${totalAvant} o -> ${totalApres} o ` +
      `(-${(100 * (1 - totalApres / totalAvant)).toFixed(1)} %)`,
  );
}

await main();
