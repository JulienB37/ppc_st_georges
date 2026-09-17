import { describe, expect, it } from 'vitest';

import { migrerDepuisV1 } from '../migrate/v1';
import { CONFIG_V1_REELLE } from '../migrate/v1.fixture';
import { nomFichierAffiche } from './nom-fichier';

const [ADULTES, JEUNES] = migrerDepuisV1(CONFIG_V1_REELLE, { anneeSaison: 2026 }).affiches;

describe('nomFichierAffiche', () => {
  it('porte la journee, le championnat et la saison', () => {
    expect(nomFichierAffiche(ADULTES!, 'png')).toBe('journee-01-adultes-2026-2027.png');
    expect(nomFichierAffiche(JEUNES!, 'png')).toBe('journee-08-jeunes-2026-2027.png');
  });

  it('distingue deux affiches de meme rang a un an d intervalle', () => {
    const suivante = { ...ADULTES!, saison: '2027-2028' };
    expect(nomFichierAffiche(ADULTES!, 'png')).not.toBe(nomFichierAffiche(suivante, 'png'));
  });

  it('complete le numero a deux chiffres, pour que le dossier se trie', () => {
    // Sans cela : journee-1, journee-10, journee-11, journee-2.
    const noms = [1, 2, 10, 11].map((numero) => nomFichierAffiche({ ...ADULTES!, numero }, 'png'));
    expect(noms).toEqual([...noms].sort());
  });

  it('ne se limite pas au PNG', () => {
    expect(nomFichierAffiche(ADULTES!, 'svg')).toBe('journee-01-adultes-2026-2027.svg');
  });

  it('ne produit aucun caractere qu un systeme de fichiers refuserait', () => {
    // La categorie est une enumeration et la saison est validee par le schema :
    // il ne peut en sortir ni accent, ni barre oblique, ni espace.
    for (const affiche of [ADULTES!, JEUNES!]) {
      expect(nomFichierAffiche(affiche, 'png')).toMatch(/^[a-z0-9.-]+$/);
    }
  });
});
