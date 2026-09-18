/**
 * Genere les icones de l'application installable depuis le blason du club.
 *
 * Deux contraintes rendent la generation necessaire, plutot qu'une copie :
 *
 * 1. Le blason fait 256 x 198 et une icone d'application est CARREE. Etire, il
 *    serait deforme ; centre sans fond, il flotterait dans un carre vide.
 * 2. Le dessin est noir et rouge sur fond transparent. Pose sur la tuile
 *    sombre d'un lanceur, le dragon disparait — exactement le defaut corrige
 *    dans le bandeau de l'application.
 *
 * On pose donc le blason sur un fond clair, centre, avec une marge. La sortie
 * est COMMITEE : cela evite d'imposer le binaire natif de sharp a la CI et au
 * build de deploiement.
 *
 * Deux familles, et il en faut deux :
 *
 *   - les icones ordinaires gardent une marge fine, le lanceur affichant
 *     l'image telle quelle ;
 *   - les icones `maskable` gardent une marge LARGE, Android rognant jusqu'a
 *     20 % de chaque bord pour appliquer sa forme. Sans cette marge, le
 *     blason serait ampute.
 *
 * Usage : npm run assets:icones
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const RACINE = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(RACINE, 'projects/app/public/assets/clubs/pp-st-georgescher.png');
const DEST = path.join(RACINE, 'projects/app/public/assets/icones');

/** Fond des icones : la craie de l'interface, ou le blason se detache. */
const FOND = { r: 0xe8, g: 0xee, b: 0xf6, alpha: 1 };

const TAILLES = [192, 512] as const;

/**
 * Part du cote laissee au dessin.
 *
 * 0,78 pour une icone ordinaire — une marge fine, qui evite que le trace
 * touche le bord. 0,58 pour une maskable : Android garantit seulement le
 * disque central de 80 % du cote, et le blason etant large, il faut redescendre
 * nettement sous cette garantie pour que son texte survive au rognage.
 */
const OCCUPATION = { ordinaire: 0.78, maskable: 0.58 } as const;

async function icone(cote: number, occupation: number, sortie: string): Promise<void> {
  const largeurDessin = Math.round(cote * occupation);
  const dessin = await sharp(SOURCE)
    .resize({ width: largeurDessin, height: largeurDessin, fit: 'contain', background: FOND })
    .png()
    .toBuffer();

  await sharp({ create: { width: cote, height: cote, channels: 4, background: FOND } })
    .composite([{ input: dessin, gravity: 'center' }])
    .png({ palette: true })
    .toFile(sortie);
}

async function main(): Promise<void> {
  await mkdir(DEST, { recursive: true });

  const produites: string[] = [];
  for (const cote of TAILLES) {
    for (const [genre, occupation] of Object.entries(OCCUPATION)) {
      const nom = genre === 'ordinaire' ? `icone-${cote}.png` : `icone-${cote}-maskable.png`;
      await icone(cote, occupation, path.join(DEST, nom));
      produites.push(nom);
    }
  }

  // Verification : une icone vide ou transparente passerait inapercue jusqu'a
  // l'installation sur un telephone.
  for (const nom of produites) {
    const { width, height, channels } = await sharp(path.join(DEST, nom)).metadata();
    const { isOpaque } = await sharp(path.join(DEST, nom)).stats();
    if (!width || !height || width !== height) {
      throw new Error(`${nom} n'est pas carree : ${width} x ${height}.`);
    }
    if (!isOpaque) {
      throw new Error(`${nom} n'est pas opaque : elle laisserait voir la tuile du lanceur.`);
    }
    console.log(`${nom} : ${width} x ${height}, ${channels} canaux, opaque`);
  }

  // La favicon suit le meme dessin, pour que l'onglet et le lanceur
  // s'accordent.
  await icone(48, OCCUPATION.ordinaire, path.join(DEST, 'favicon-48.png'));
  await writeFile(
    path.join(DEST, 'LISEZ-MOI.txt'),
    'Genere par tools/build-icones.mts depuis le blason du club. Ne pas modifier a la main.\n',
  );
}

await main();
