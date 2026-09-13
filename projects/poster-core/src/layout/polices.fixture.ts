import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { FacePolice } from './mesure';

/**
 * Charge les polices livrees, pour les tests uniquement.
 *
 * Le code de la librairie ne lit jamais un fichier : les tampons lui sont
 * injectes. Ce chargeur reproduit dans Node ce que l'application fera par
 * `fetch` et ce que le worker recevra par `postMessage`.
 */
const RACINE = path.resolve(import.meta.dirname, '../../../..');
const DOSSIER = path.join(RACINE, 'projects/app/public/assets/fonts');

interface ManifestePolices {
  faces: { fichier: string; famille: string; graisse: number }[];
}

export function chargerPolicesLivrees(): FacePolice[] {
  const manifeste = JSON.parse(
    readFileSync(path.join(DOSSIER, 'fonts.manifest.json'), 'utf8'),
  ) as ManifestePolices;

  return manifeste.faces.map((face) => ({
    famille: face.famille,
    graisse: face.graisse,
    donnees: new Uint8Array(readFileSync(path.join(DOSSIER, face.fichier))),
  }));
}
