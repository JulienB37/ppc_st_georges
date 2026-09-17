import { describe, expect, it } from 'vitest';

import { ordinalJournee, quantiemeMois, rangJourneeParties } from './ordinal';

describe('ordinalJournee', () => {
  it('abrege correctement le rang feminin', () => {
    // L'ancien script produisait « 1ere » et « 12eme ».
    expect(ordinalJournee(1)).toBe('1re');
    expect(ordinalJournee(2)).toBe('2e');
    expect(ordinalJournee(12)).toBe('12e');
    expect(ordinalJournee(21)).toBe('21e');
  });

  it('reste regulier au-dela du premier rang', () => {
    // Une saison compte une vingtaine de journees : tous les rangs d'une
    // saison reelle sont donc couverts, pas seulement quelques echantillons.
    const attendu = ['1re', ...Array.from({ length: 21 }, (_, i) => `${i + 2}e`)];
    expect(Array.from({ length: 22 }, (_, i) => ordinalJournee(i + 1))).toEqual(attendu);
  });

  it('refuse un rang qui ne peut pas exister', () => {
    expect(() => ordinalJournee(0)).toThrow(RangeError);
    expect(() => ordinalJournee(-1)).toThrow(RangeError);
    expect(() => ordinalJournee(1.5)).toThrow(RangeError);
  });
});

describe('quantiemeMois', () => {
  it("n'ordinalise que le premier du mois", () => {
    expect(quantiemeMois(1)).toBe('1er');
    expect(quantiemeMois(2)).toBe('2');
    expect(quantiemeMois(31)).toBe('31');
  });

  it('refuse un quantieme hors bornes', () => {
    expect(() => quantiemeMois(0)).toThrow(RangeError);
    expect(() => quantiemeMois(32)).toThrow(RangeError);
  });
});

describe('rangJourneeParties', () => {
  it("rend la forme longue du club, decoupee pour l'exposant", () => {
    expect(rangJourneeParties(1)).toEqual({ chiffre: '1', suffixe: 'ère' });
    expect(rangJourneeParties(2)).toEqual({ chiffre: '2', suffixe: 'ème' });
    expect(rangJourneeParties(5)).toEqual({ chiffre: '5', suffixe: 'ème' });
    expect(rangJourneeParties(11)).toEqual({ chiffre: '11', suffixe: 'ème' });
  });

  it('accorde les deux formes sur toute une saison', () => {
    // La forme longue de l'affiche et la forme abregee de l'interface doivent
    // designer le meme rang : la liste des affiches enregistrees et l'affiche
    // elle-meme ne peuvent pas annoncer des journees differentes.
    for (let rang = 1; rang <= 22; rang++) {
      const { chiffre, suffixe } = rangJourneeParties(rang);
      expect(chiffre).toBe(String(rang));
      expect(suffixe).toBe(rang === 1 ? 'ère' : 'ème');
      // Meme cas particulier de part et d'autre.
      expect(ordinalJournee(rang).startsWith(String(rang))).toBe(true);
    }
  });

  it('refuse un rang invalide, comme la forme abregee', () => {
    expect(() => rangJourneeParties(0)).toThrow(RangeError);
    expect(() => rangJourneeParties(2.5)).toThrow(RangeError);
  });
});
