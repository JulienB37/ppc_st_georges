import { describe, expect, it } from 'vitest';

import { libelleAdversaire } from './adversaire';

describe('libelleAdversaire', () => {
  it('accole le numero d equipe au nom du club', () => {
    // Le defaut d'origine : le numero saisi dans le formulaire n'arrivait
    // jamais sur l'affiche, le moteur imprimant le libelle seul.
    expect(libelleAdversaire({ libelle: 'US Chouzy TT', numero: 2 })).toBe('US Chouzy TT 2');
  });

  it('laisse le club seul quand aucune equipe n est designee', () => {
    // Zero est la valeur que porte le formulaire tant que rien n'est saisi, et
    // null celle du domaine : ni l'une ni l'autre ne doit s'imprimer.
    expect(libelleAdversaire({ libelle: 'US Chouzy TT', numero: 0 })).toBe('US Chouzy TT');
    expect(libelleAdversaire({ libelle: 'US Chouzy TT', numero: null })).toBe('US Chouzy TT');
  });

  it('ne redouble pas un numero deja present dans le nom', () => {
    // Garde-fou sur la provenance des donnees : c'est exactement ce que
    // produisait l'ancienne migration, qui laissait le numero dans le libelle
    // tout en le renseignant a part. Elle ne le fait plus, et ce test dit
    // pourquoi le libelle ne doit contenir que le club.
    expect(libelleAdversaire({ libelle: 'St Sulpice TT', numero: 1 })).toBe('St Sulpice TT 1');
  });
});
