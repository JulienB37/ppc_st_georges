import { describe, expect, it } from 'vitest';

import { CLUBS, type EntreeClub } from './registre.generated';
import { chercherClubs, construireIndex, resoudreClub, similarite } from './resoudre';

const index = construireIndex(Object.values(CLUBS));

function exige(libelle: string): EntreeClub {
  const r = resoudreClub(libelle, index);
  if (r.type === 'absent') throw new Error(`« ${libelle} » non resolu`);
  return r.club;
}

describe('resoudreClub', () => {
  it('resout tous les adversaires des journees reelles', () => {
    const attendus: [string, string][] = [
      ['St Sulpice TT 1', 'st-sulpice-tt'],
      ['ASJ La Chaussée St Victor 1', 'asj-la-chaussee-st-victor'],
      ['Pong Vendomois 5', 'pong-vendomois'],
      ['US Chouzy TT 2', 'us-chouzy-tt'],
      ['Blois Ping 41 6', 'blois-ping-41'],
      ['Gien AS TT 1', 'gien-as-tt'],
      ['Villefranche/Cher TT 2', 'villefranchecher-tt'],
      ['ESC Cour Cheverny TT 2', 'esc-cour-cheverny-tt'],
      ['AMO Mer TT 8', 'amo-mer-tt'],
      ["L'aigle Sellois TT 3", 'laigle-sellois-tt'],
      ['CMP JM Ingré TT 4', 'cmp-jm-ingre-tt'],
      ['Azé TT 2', 'aze-tt'],
      ['Vineuil Suevres TT 1', 'vineuil-suevres-tt'],
      ['Vineuil Suevres TT 8', 'vineuil-suevres-tt'],
    ];
    for (const [libelle, id] of attendus) {
      const r = resoudreClub(libelle, index);
      expect(r.type, libelle).toBe('exact');
      expect(exige(libelle).id, libelle).toBe(id);
    }
  });

  it('rattrape par alias une denomination raccourcie', () => {
    // Vu sur l'affiche de la journee 12 : le club y figure sans son sigle.
    const r = resoudreClub('La Chaussée St Victor TT 2', index);
    expect(r.type).toBe('exact');
    expect(exige('La Chaussée St Victor TT 2').id).toBe('asj-la-chaussee-st-victor');
  });

  it('ignore le numero d equipe', () => {
    expect(exige('Gien AS TT 1').id).toBe(exige('Gien AS TT 4').id);
  });

  it('propose sans jamais appliquer d office', () => {
    // Une faute de frappe plausible doit suggerer, pas decider en silence.
    const r = resoudreClub('Gien AS TTT 1', index);
    expect(r.type).toBe('suggestion');
    if (r.type === 'suggestion') {
      expect(r.club.id).toBe('gien-as-tt');
      expect(r.score).toBeGreaterThan(0.82);
    }
  });

  it('avoue l echec plutot que de proposer n importe quoi', () => {
    const r = resoudreClub('Club Inconnu De Nulle Part 3', index);
    expect(r.type).toBe('absent');
    if (r.type === 'absent') expect(r.normalise).toBe('club-inconnu-de-nulle-part');
  });

  it('laisse les clubs de l utilisateur primer sur ceux livres', () => {
    const perso: EntreeClub = {
      id: 'gien-as-tt',
      libelle: 'Gien AS TT (logo corrige)',
      fichier: 'perso.png',
      largeur: 256,
      hauteur: 256,
      alias: [],
    };
    // L'utilisateur doit pouvoir corriger un logo perime sans attendre une
    // mise a jour de l'application.
    const fusionne = construireIndex(Object.values(CLUBS), [perso]);
    const r = resoudreClub('Gien AS TT 1', fusionne);
    expect(r.type).toBe('exact');
    if (r.type !== 'absent') expect(r.club.fichier).toBe('perso.png');
  });
});

describe('chercherClubs', () => {
  it('place en tete le club dont tous les mots commencent par la saisie', () => {
    expect(chercherClubs('bloi 41', index)[0]?.id).toBe('blois-ping-41');
    expect(chercherClubs('chouzy', index)[0]?.id).toBe('us-chouzy-tt');
    expect(chercherClubs('cour chev', index)[0]?.id).toBe('esc-cour-cheverny-tt');
  });

  it('est insensible aux accents et a la casse', () => {
    expect(chercherClubs('AZÉ', index)[0]?.id).toBe('aze-tt');
    expect(chercherClubs('ingré', index)[0]?.id).toBe('cmp-jm-ingre-tt');
  });

  it('rend la liste complete quand rien n est saisi', () => {
    expect(chercherClubs('', index)).toHaveLength(Object.keys(CLUBS).length);
  });

  it('borne le nombre de propositions', () => {
    expect(chercherClubs('tt', index, 5).length).toBeLessThanOrEqual(5);
  });
});

describe('similarite', () => {
  it('vaut 1 pour deux chaines identiques et 0 pour deux etrangeres', () => {
    expect(similarite('gien-as-tt', 'gien-as-tt')).toBe(1);
    expect(similarite('aze-tt', 'xyzw')).toBe(0);
  });

  it('tolere le retrait d un mot entier', () => {
    expect(similarite('la-chaussee-st-victor-tt', 'asj-la-chaussee-st-victor')).toBeGreaterThan(
      0.7,
    );
  });
});
