/**
 * Spike : que declarent reellement les faces telechargees ?
 *
 * Enjeu : resvg n'interprete pas `@font-face` et ne synthetise pas le gras.
 * Il apparie `font-family` + `font-weight` via fontdb, qui lit la table `name`.
 * Si une face declare sa graisse DANS son nom de famille (name ID 1), demander
 * `font-family="Barlow Semi Condensed"; font-weight:500` ne la trouvera pas.
 */
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');

const SRC = path.resolve(import.meta.dirname, '../../assets-src/fonts');

const ID = {
  1: 'famille (name 1)',
  2: 'style (name 2)',
  16: 'famille typographique (name 16)',
  17: 'style typographique (name 17)',
};

for (const fichier of (await readdir(SRC)).filter((f) => f.endsWith('.ttf')).sort()) {
  const police = fontkit.create(await readFile(path.join(SRC, fichier)));
  console.log(`\n=== ${fichier}`);
  console.log(`  familyName fontkit : ${police.familyName}`);
  console.log(`  subfamilyName      : ${police.subfamilyName}`);
  console.log(`  unitsPerEm         : ${police.unitsPerEm}`);
  const os2 = police['OS/2'];
  console.log(`  usWeightClass      : ${os2?.usWeightClass}`);
  for (const [id, libelle] of Object.entries(ID)) {
    const rec =
      police.name?.records?.[
        { 1: 'fontFamily', 2: 'fontSubfamily', 16: 'preferredFamily', 17: 'preferredSubfamily' }[id]
      ];
    const valeur = rec ? (rec.en ?? Object.values(rec)[0]) : '(absent)';
    console.log(`  ${libelle.padEnd(32)} ${valeur}`);
  }
}
