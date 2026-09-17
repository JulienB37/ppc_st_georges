import { describe, expect, it } from 'vitest';

import { CONFIG_V1_REELLE } from '../migrate/v1.fixture';
import { migrerDepuisV1 } from '../migrate/v1';
import {
  EQUIPES_CLUB,
  equipeLibreSuivante,
  equipeParDivision,
  equipeParNumero,
  optionsDivision,
} from './equipes';

describe('table des equipes', () => {
  it('donne huit equipes dans l ordre fourni par le club', () => {
    expect(EQUIPES_CLUB.map((e) => e.division)).toEqual([
      'R2',
      'R3',
      'PR1',
      'PR2',
      'D1',
      'D2',
      'D3',
      'D4',
    ]);
    expect(EQUIPES_CLUB.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('concorde avec les rangs de la configuration historique', () => {
    // La configuration du club porte « R2 (1) », « D1 (5) », « D3 (7) »... Le
    // RANG est l'identite stable de l'equipe : si la table le contredisait, les
    // journees archivees changeraient d'equipe en etant reouvertes.
    const journee = migrerDepuisV1(CONFIG_V1_REELLE, { anneeSaison: 2026 }).journee;
    const paires = journee.affiches
      .flatMap((a) => a.groupes)
      .flatMap((g) => g.rencontres)
      .map((r) => r.equipeLocale)
      .filter((e): e is { division: string; numero: number } => e.division !== null);

    for (const { division, numero } of paires) {
      const attendue = equipeParNumero(numero);
      expect(attendue, `equipe ${numero}`).toBeDefined();
      // Trois etiquettes ont ete precisees depuis : « PR » devient PR1 et PR2,
      // le second « D3 » devient D4. Le rang, lui, ne bouge pas.
      const precisee = ['PR', 'D3'].includes(division) && attendue!.division !== division;
      expect(precisee || attendue!.division === division, `${division} (${numero})`).toBe(true);
    }
  });

  it('retrouve une equipe par sa division et par son rang', () => {
    expect(equipeParDivision('PR1')).toEqual({ numero: 3, division: 'PR1' });
    expect(equipeParNumero(8)).toEqual({ numero: 8, division: 'D4' });
    expect(equipeParDivision('N1')).toBeUndefined();
  });
});

describe('equipeLibreSuivante', () => {
  it('saute les equipes deja engagees', () => {
    expect(equipeLibreSuivante([1, 2, 3]).division).toBe('PR2');
  });

  it('reprend une equipe liberee, sans suivre un compteur croissant', () => {
    expect(equipeLibreSuivante([2, 3]).numero).toBe(1);
  });

  it('rend la derniere plutot que rien quand tout est pris', () => {
    expect(equipeLibreSuivante([1, 2, 3, 4, 5, 6, 7, 8]).numero).toBe(8);
  });
});

describe('optionsDivision', () => {
  it('propose les huit equipes pour une valeur connue', () => {
    expect(optionsDivision('D1')).toHaveLength(8);
    expect(optionsDivision('')).toHaveLength(8);
  });

  it('conserve une etiquette inconnue plutot que de l effacer', () => {
    // Un document importe porte « PR » : l'effacer en silence perdrait une
    // donnee que l'utilisateur n'a pas demande a changer.
    const options = optionsDivision('PR');
    expect(options).toHaveLength(9);
    expect(options.at(-1)).toEqual({ numero: 0, division: 'PR' });
  });
});
