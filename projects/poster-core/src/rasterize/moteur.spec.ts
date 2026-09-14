import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { chargerPolicesLivrees } from '../layout/polices.fixture';
import { creerMoteurRendu, type MoteurRendu } from './moteur';

const WASM = path.resolve(process.cwd(), 'node_modules/@resvg/resvg-wasm/index_bg.wasm');

/** SVG minimal mais representatif : un texte dans la police d'affichage livree. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
<rect width="200" height="100" fill="#04070E"/>
<text x="10" y="60" font-family="Anton" font-size="40" fill="#FFFFFF">1ère</text>
</svg>`;

let moteur: MoteurRendu;
let tampons: Uint8Array[];

beforeAll(async () => {
  tampons = chargerPolicesLivrees().map((f) => f.donnees);
  moteur = await creerMoteurRendu({ wasm: readFileSync(WASM), tampons });
});

describe('creerMoteurRendu', () => {
  it('refuse de rendre sans police plutot que de substituer en silence', async () => {
    await expect(creerMoteurRendu({ wasm: readFileSync(WASM), tampons: [] })).rejects.toThrow(
      /Aucune police/,
    );
  });

  it('accepte plusieurs creations, le wasm ne s initialisant qu une fois', async () => {
    // `initWasm` leve au second appel : la memoisation doit rendre l'appelant
    // insouciant, l'application pouvant recreer un moteur apres une erreur.
    const second = await creerMoteurRendu({ wasm: readFileSync(WASM), tampons });
    expect(second.pixels(SVG, 100).largeur).toBe(100);
  });
});

describe('rendu', () => {
  it('respecte la largeur demandee et deduit la hauteur du viewBox', () => {
    const image = moteur.pixels(SVG, 400);
    expect(image.largeur).toBe(400);
    expect(image.hauteur).toBe(200);
    // RGBA : quatre octets par pixel, sans marge.
    expect(image.pixels.length).toBe(400 * 200 * 4);
  });

  it('dessine reellement le texte, et pas un aplat', () => {
    const image = moteur.pixels(SVG, 400);
    // Le fond est tres sombre, le texte blanc : si la police n'avait pas ete
    // appliquee, aucun pixel clair n'apparaitrait.
    let clairs = 0;
    for (let i = 0; i < image.pixels.length; i += 4) {
      if (image.pixels[i]! > 200 && image.pixels[i + 1]! > 200) clairs++;
    }
    expect(clairs).toBeGreaterThan(200);
  });

  it('rend un PNG valide', () => {
    const png = moteur.png(SVG, 200);
    // Signature PNG.
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(png.length).toBeGreaterThan(200);
  });

  it('refuse une largeur absurde', () => {
    expect(() => moteur.pixels(SVG, 0)).toThrow(RangeError);
    expect(() => moteur.pixels(SVG, Number.NaN)).toThrow(RangeError);
  });

  it('remonte un SVG invalide au lieu de rendre du vide', () => {
    expect(() => moteur.pixels('<svg', 100)).toThrow();
  });
});
