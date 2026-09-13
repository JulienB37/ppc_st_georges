import { describe, expect, it } from 'vitest';

import { ordinalJournee, quantiemeMois } from './ordinal';

describe('ordinalJournee', () => {
  it('abrege correctement le rang feminin', () => {
    // L'ancien script produisait « 1ere » et « 12eme ».
    expect(ordinalJournee(1)).toBe('1re');
    expect(ordinalJournee(2)).toBe('2e');
    expect(ordinalJournee(12)).toBe('12e');
    expect(ordinalJournee(21)).toBe('21e');
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
