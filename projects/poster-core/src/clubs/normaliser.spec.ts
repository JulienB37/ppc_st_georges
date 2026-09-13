import { describe, expect, it } from 'vitest';

import {
  clubIdDepuisFichier,
  clubIdDepuisLibelle,
  normaliserNomClub,
  separerNumeroEquipe,
} from './normaliser';

describe('normaliserNomClub', () => {
  it('supprime accents et ponctuation sans inserer de separateur', () => {
    // Comportement historique : la barre oblique disparait sans laisser d'espace,
    // et c'est ainsi que le fichier existant est nomme.
    expect(normaliserNomClub('PP St Georges/Cher')).toBe('pp-st-georgescher');
    expect(normaliserNomClub('Villefranche/Cher TT')).toBe('villefranchecher-tt');
    expect(normaliserNomClub("L'aigle Sellois TT")).toBe('laigle-sellois-tt');
    expect(normaliserNomClub('Azé TT')).toBe('aze-tt');
    expect(normaliserNomClub('CMP JM Ingré TT')).toBe('cmp-jm-ingre-tt');
    expect(normaliserNomClub('ASJ La Chaussée St Victor')).toBe('asj-la-chaussee-st-victor');
  });

  it('tolere espaces multiples et bords', () => {
    expect(normaliserNomClub('  Gien   AS  TT  ')).toBe('gien-as-tt');
  });
});

describe('separerNumeroEquipe', () => {
  it('isole le numero d equipe final', () => {
    expect(separerNumeroEquipe('Gien AS TT 1')).toEqual({ nom: 'Gien AS TT', numero: 1 });
    expect(separerNumeroEquipe('Blois Ping 41 6')).toEqual({ nom: 'Blois Ping 41', numero: 6 });
    expect(separerNumeroEquipe('AMO Mer TT 8')).toEqual({ nom: 'AMO Mer TT', numero: 8 });
  });

  it('rend numero nul quand le libelle n en porte pas', () => {
    expect(separerNumeroEquipe('Gien AS TT')).toEqual({ nom: 'Gien AS TT', numero: null });
  });
});

describe('clubIdDepuisLibelle', () => {
  it('resout les adversaires reels des journees passees', () => {
    const cas: [string, string][] = [
      ['St Sulpice TT 1', 'st-sulpice-tt'],
      ['ASJ La Chaussée St Victor 1', 'asj-la-chaussee-st-victor'],
      ['Pong Vendomois 5', 'pong-vendomois'],
      ['US Chouzy TT 2', 'us-chouzy-tt'],
      ['Gien AS TT 1', 'gien-as-tt'],
      ['ESC Cour Cheverny TT 2', 'esc-cour-cheverny-tt'],
      ['AMO Mer TT 8', 'amo-mer-tt'],
      ["L'aigle Sellois TT 3", 'laigle-sellois-tt'],
      ['CMP JM Ingré TT 4', 'cmp-jm-ingre-tt'],
      ['Azé TT 2', 'aze-tt'],
      ['Villefranche/Cher TT 2', 'villefranchecher-tt'],
    ];
    for (const [libelle, attendu] of cas) {
      expect(clubIdDepuisLibelle(libelle), libelle).toBe(attendu);
    }
  });

  it('conserve un numero qui fait partie du nom du club', () => {
    // « 41 » est le departement, pas une equipe : il doit survivre au decoupage
    // parce que le numero d'equipe le suit.
    expect(clubIdDepuisLibelle('Blois Ping 41 6')).toBe('blois-ping-41');
    expect(clubIdDepuisLibelle('Sud Loire TT 45 1')).toBe('sud-loire-tt-45');
  });

  it('ampute le nom quand le numero d equipe est absent — limite connue', () => {
    // Sans numero d'equipe, rien ne distingue « 41 » d'un numero, et le nom est
    // tronque. C'est la faiblesse structurelle de l'ancien algorithme : elle
    // justifie le registre explicite et ses alias, plutot qu'une devinette.
    expect(clubIdDepuisLibelle('Blois Ping 41')).toBe('blois-ping');
  });
});

describe('clubIdDepuisFichier', () => {
  it('ramene les conventions de nommage melangees a une forme unique', () => {
    const cas: [string, string][] = [
      ['aze_tt.png', 'aze-tt'],
      ['pp_st_georgescher.png', 'pp-st-georgescher'],
      ['asj_la_chaussee_st_victor.jpg', 'asj-la-chaussee-st-victor'],
      ['gien_as_tt.jpeg', 'gien-as-tt'],
      ['St Avertin.png', 'st-avertin'],
      ['St Laurent.jpg', 'st-laurent'],
      ['orléans.png', 'orleans'],
      ['Bourges.png', 'bourges'],
      ['blois_ping_41.jpg', 'blois-ping-41'],
      ['sud_loire_tt_45.png', 'sud-loire-tt-45'],
      ['laigle_sellois_tt.jpg', 'laigle-sellois-tt'],
      ['cmp_jm_ingre_tt.jpg', 'cmp-jm-ingre-tt'],
    ];
    for (const [fichier, attendu] of cas) {
      expect(clubIdDepuisFichier(fichier), fichier).toBe(attendu);
    }
  });

  it('fait coincider le fichier livre et le libelle saisi', () => {
    // C'est l'invariant qui fait tenir toute la resolution de logo.
    const paires: [string, string][] = [
      ['aze_tt.png', 'Azé TT 2'],
      ['asj_la_chaussee_st_victor.jpg', 'ASJ La Chaussée St Victor 1'],
      ['gien_as_tt.jpeg', 'Gien AS TT 1'],
      ['blois_ping_41.jpg', 'Blois Ping 41 6'],
      ['laigle_sellois_tt.jpg', "L'aigle Sellois TT 3"],
      ['pp_st_georgescher.png', 'PP St Georges/Cher'],
    ];
    for (const [fichier, libelle] of paires) {
      expect(clubIdDepuisFichier(fichier), `${fichier} vs ${libelle}`).toBe(
        clubIdDepuisLibelle(libelle),
      );
    }
  });
});
