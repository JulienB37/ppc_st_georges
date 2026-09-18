import { describe, expect, it } from 'vitest';

import { formatCreneau, formatHeure, parseCreneau, saisonDe } from './creneau';

describe('formatCreneau', () => {
  it('produit le libelle attendu sur les creneaux reels du club', () => {
    // Les trois creneaux de la journee 1 (cf. legacy/journee_config.json).
    expect(formatCreneau('2026-09-19T18:00')).toBe('Samedi 19 septembre à 18h00');
    expect(formatCreneau('2026-09-20T09:30')).toBe('Dimanche 20 septembre à 9h30');
  });

  it('ecrit le premier du mois en ordinal', () => {
    expect(formatCreneau('2026-03-01T14:00')).toBe('Dimanche 1er mars à 14h00');
  });

  it('supprime le zero initial du quantieme, faute des anciennes affiches', () => {
    // L'affiche 12 portait « Samedi 09 Mai » : zero parasite et mois capitalise.
    expect(formatCreneau('2026-05-09T18:00')).toBe('Samedi 9 mai à 18h00');
  });

  it('laisse les mois en minuscules et accentues', () => {
    expect(formatCreneau('2026-02-07T10:00')).toBe('Samedi 7 février à 10h00');
    expect(formatCreneau('2026-08-15T10:00')).toBe('Samedi 15 août à 10h00');
  });

  it('ne depend pas du fuseau horaire de la machine', () => {
    // Un creneau a minuit est le piege classique : interprete en UTC puis
    // reaffiche en local, il reculerait d'un jour.
    expect(formatCreneau('2026-09-19T00:00')).toBe('Samedi 19 septembre à 0h00');
    expect(formatCreneau('2026-09-19T23:59')).toBe('Samedi 19 septembre à 23h59');
  });
});

describe('formatHeure', () => {
  it('omet le zero des heures et garde deux chiffres aux minutes', () => {
    expect(formatHeure(parseCreneau('2026-09-19T09:30'))).toBe('9h30');
    expect(formatHeure(parseCreneau('2026-09-19T18:00'))).toBe('18h00');
    expect(formatHeure(parseCreneau('2026-09-19T14:05'))).toBe('14h05');
  });
});

describe('parseCreneau', () => {
  it('rejette une chaine mal formee', () => {
    expect(() => parseCreneau('Samedi 19 Septembre à 18h00')).toThrow(RangeError);
    expect(() => parseCreneau('2026-09-19')).toThrow(RangeError);
    expect(() => parseCreneau('2026-09-19T18:00:00Z')).toThrow(RangeError);
  });

  it('rejette une date inexistante', () => {
    expect(() => parseCreneau('2026-02-30T10:00')).toThrow(RangeError);
    expect(() => parseCreneau('2026-04-31T10:00')).toThrow(RangeError);
    expect(() => parseCreneau('2026-13-01T10:00')).toThrow(RangeError);
  });

  it('accepte le 29 fevrier des annees bissextiles', () => {
    expect(parseCreneau('2028-02-29T10:00').jour).toBe(29);
    expect(() => parseCreneau('2027-02-29T10:00')).toThrow(RangeError);
  });
});

describe('saisonDe', () => {
  it('fait courir la saison de septembre a aout', () => {
    expect(saisonDe('2025-09-01T18:00')).toBe('2025-2026');
    expect(saisonDe('2025-12-31T18:00')).toBe('2025-2026');
    expect(saisonDe('2026-05-09T18:00')).toBe('2025-2026');
    expect(saisonDe('2026-08-31T18:00')).toBe('2025-2026');
    expect(saisonDe('2026-09-01T18:00')).toBe('2026-2027');
  });
});
