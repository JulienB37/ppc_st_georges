import { describe, expect, it } from 'vitest';

import { migrerDepuisV1 } from '../migrate/v1';
import { CONFIG_V1_REELLE } from '../migrate/v1.fixture';
import { relireDocument } from './relecture';

const AFFICHE = migrerDepuisV1(CONFIG_V1_REELLE, { anneeSaison: 2026 }).affiches[0]!;

describe('relireDocument', () => {
  it('relit un document de la version courante', () => {
    const relecture = relireDocument(JSON.parse(JSON.stringify(AFFICHE)));
    expect(relecture).toEqual({ type: 'ok', affiche: AFFICHE });
  });

  it('refuse un document trop ancien en le nommant', () => {
    // La v2 n'a jamais ete persistee, mais un fichier bricole peut l'annoncer :
    // mieux vaut le dire que de lui appliquer un schema qui n'est pas le sien.
    const relecture = relireDocument({ ...AFFICHE, versionSchema: 2 });
    expect(relecture.type).toBe('illisible');
    expect(relecture.type === 'illisible' && relecture.raison).toMatch(/version 2.*trop ancien/s);
  });

  it('refuse un document plus recent en disant quoi faire', () => {
    const relecture = relireDocument({ ...AFFICHE, versionSchema: 99 });
    expect(relecture.type === 'illisible' && relecture.raison).toMatch(
      /mettez l.application a jour/i,
    );
  });

  it('refuse un document sans version', () => {
    const sansVersion: Record<string, unknown> = { ...AFFICHE };
    delete sansVersion['versionSchema'];
    expect(relireDocument(sansVersion).type).toBe('illisible');
  });

  it('refuse ce qui n est pas un document', () => {
    for (const brut of [null, 42, 'texte', undefined]) {
      expect(relireDocument(brut).type).toBe('illisible');
    }
  });

  it('refuse un document de la bonne version mais abime, en disant ou', () => {
    const relecture = relireDocument({ ...AFFICHE, saison: 'pas-une-saison' });
    expect(relecture.type).toBe('illisible');
    expect(relecture.type === 'illisible' && relecture.raison).toMatch(/invalide/i);
  });
});
