import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { Bitmap } from '../rasterize/moteur';

/**
 * Outillage des images de reference, pour les tests uniquement.
 *
 * Deux verifications complementaires, et il en faut deux :
 *
 * - Le SVG normalise attrape toute derive de GEOMETRIE ou de typographie, avec
 *   un diff lisible ligne a ligne. C'est la verification forte.
 * - Le condense de pixels attrape ce que le SVG ne peut pas voir : si resvg
 *   remplacait une police par une autre, le SVG resterait identique au
 *   caractere pres et seuls les pixels changeraient. C'est precisement le
 *   defaut que ce depot combat, et le SVG seul y serait aveugle.
 */

const DOSSIER = path.resolve(process.cwd(), 'projects/poster-core/src/render/goldens');

/**
 * Remplace chaque data URL par l'empreinte de son contenu.
 *
 * Sans cela la reference peserait des centaines de kilo-octets d'images
 * encodees en base64, illisibles dans un diff, alors que ce qui compte est la
 * geometrie autour. L'empreinte conserve la detection d'un asset change.
 */
export function normaliserSvg(svg: string): string {
  return (
    svg
      .replace(
        /data:[^"')]+/g,
        (url) => `data:sha256/${createHash('sha256').update(url).digest('hex').slice(0, 16)}`,
      )
      // Une ligne par element : un diff de reference doit se lire.
      .replace(/></g, '>\n<')
  );
}

/** Taille du condense. Assez fin pour voir un deplacement, assez court pour etre versionne. */
const COLONNES = 60;
const LIGNES = 90;

/**
 * Condense une image en une grille de luminances moyennes.
 *
 * Comparer les pixels un a un demanderait de versionner 1,7 Mo par reference.
 * La moyenne par cellule garde ce qui nous interesse — un texte substitue ou un
 * bloc deplace change la luminance de plusieurs cellules — pour 5 Ko de texte.
 */
export function condenser(image: Bitmap): string {
  const lignes: string[] = [];
  for (let l = 0; l < LIGNES; l++) {
    let ligne = '';
    for (let c = 0; c < COLONNES; c++) {
      const x0 = Math.floor((c * image.largeur) / COLONNES);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * image.largeur) / COLONNES));
      const y0 = Math.floor((l * image.hauteur) / LIGNES);
      const y1 = Math.max(y0 + 1, Math.floor(((l + 1) * image.hauteur) / LIGNES));
      let somme = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * image.largeur + x) * 4;
          // Luminance perceptuelle, ponderee par l'alpha.
          const a = image.pixels[i + 3]! / 255;
          somme +=
            a *
            (0.2126 * image.pixels[i]! +
              0.7152 * image.pixels[i + 1]! +
              0.0722 * image.pixels[i + 2]!);
          n++;
        }
      }
      ligne += Math.round(somme / n)
        .toString(16)
        .padStart(2, '0');
    }
    lignes.push(ligne);
  }
  return lignes.join('\n');
}

export interface EcartGolden {
  /** Cellules dont la luminance differe au-dela de la tolerance. */
  cellules: number;
  /** Ecart maximal observe, sur 255. */
  ecartMax: number;
  total: number;
}

/** Tolerance par cellule : absorbe l'antialiasing sans laisser passer un texte deplace. */
const TOLERANCE_CELLULE = 6;

export function comparerCondenses(attendu: string, obtenu: string): EcartGolden {
  const a = attendu.replace(/\n/g, '');
  const b = obtenu.replace(/\n/g, '');
  if (a.length !== b.length) {
    return { cellules: Math.max(a.length, b.length) / 2, ecartMax: 255, total: a.length / 2 };
  }
  let cellules = 0;
  let ecartMax = 0;
  for (let i = 0; i < a.length; i += 2) {
    const ecart = Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16));
    if (ecart > ecartMax) ecartMax = ecart;
    if (ecart > TOLERANCE_CELLULE) cellules++;
  }
  return { cellules, ecartMax, total: a.length / 2 };
}

/**
 * Lit une reference, ou l'ecrit si `BENIR_GOLDENS` est pose.
 *
 * L'ecriture est derriere une variable d'environnement, et non automatique sur
 * fichier absent : une reference creee en silence ferait passer le test en CI
 * sans que personne n'ait regarde le rendu — ce qui est exactement le contraire
 * de ce qu'une image de reference sert a faire.
 */
export function referenceOuBenir(nom: string, contenu: string): string {
  const chemin = path.join(DOSSIER, nom);
  if (process.env['BENIR_GOLDENS']) {
    mkdirSync(DOSSIER, { recursive: true });
    writeFileSync(chemin, contenu.endsWith('\n') ? contenu : `${contenu}\n`, 'utf8');
    return contenu;
  }
  try {
    return readFileSync(chemin, 'utf8').replace(/\n$/, '');
  } catch {
    throw new Error(
      `Reference absente : ${path.relative(process.cwd(), chemin)}. ` +
        `Rendre l'affiche, la REGARDER, puis relancer avec BENIR_GOLDENS=1 pour l'enregistrer.`,
    );
  }
}
