import { describe, expect, it } from 'vitest';

import { EQUIPES_CLUB } from '../clubs/equipes';
import { AfficheSchema, SAISON_INDETERMINEE, type SelectionSponsors } from '../model/journee';
import { versDomaine } from './modele';
import {
  afficheVide,
  deplacer,
  equipeLibreDe,
  fixerSponsor,
  inserer,
  nouveauGroupe,
  nouvelleRencontre,
  remplacer,
  retirer,
} from './mutations';

const MAINTENANT = '2026-09-17T10:00:00.000Z';

describe('deplacer', () => {
  it('deplace vers le haut et vers le bas', () => {
    expect(deplacer(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(deplacer(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('borne la cible au lieu de laisser un trou', () => {
    // Le bouton « descendre » du dernier element envoie un index hors liste :
    // il ne doit rien casser, et surtout pas inserer `undefined`.
    expect(deplacer(['a', 'b'], 1, 9)).toEqual(['a', 'b']);
    expect(deplacer(['a', 'b'], 0, -3)).toEqual(['a', 'b']);
  });

  it('ignore une source hors liste', () => {
    expect(deplacer(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('ne modifie pas la liste recue', () => {
    // Les Signal Forms lisent le modele depuis un signal : muter en place ne
    // changerait pas la reference, et rien ne se redessinerait.
    const origine = ['a', 'b', 'c'];
    deplacer(origine, 0, 2);
    expect(origine).toEqual(['a', 'b', 'c']);
  });
});

describe('retirer, inserer, remplacer', () => {
  it('retire par index sans toucher a l origine', () => {
    const origine = ['a', 'b', 'c'];
    expect(retirer(origine, 1)).toEqual(['a', 'c']);
    expect(origine).toHaveLength(3);
  });

  it('insere en fin par defaut, et borne un index absurde', () => {
    expect(inserer(['a'], 'b')).toEqual(['a', 'b']);
    expect(inserer(['a'], 'b', 0)).toEqual(['b', 'a']);
    expect(inserer(['a'], 'b', 99)).toEqual(['a', 'b']);
  });

  it('remplace un seul element, en conservant les autres references', () => {
    const a = { n: 1 };
    const b = { n: 2 };
    const sortie = remplacer([a, b], 1, (e) => ({ n: e.n * 10 }));
    expect(sortie[0]).toBe(a);
    expect(sortie[1]).toEqual({ n: 20 });
  });
});

describe('fabriques', () => {
  it('reprend la date du creneau precedent', () => {
    // Une journee se joue sur un ou deux jours : resaisir la date a chaque
    // creneau serait la premiere corvee que cet outil doit supprimer.
    const premier = { ...nouveauGroupe(), date: '2026-09-19', heure: '18:00' };
    expect(nouveauGroupe(premier).date).toBe('2026-09-19');
    expect(nouveauGroupe(premier).heure).toBe('18:00');
  });

  it('ne pose aucun null ni undefined, que les Signal Forms refusent', () => {
    const affiche = afficheVide('adultes', 12, MAINTENANT);
    const valeurs = [
      ...Object.values(nouvelleRencontre(EQUIPES_CLUB[0]!)),
      ...Object.values(nouveauGroupe()).filter((v) => !Array.isArray(v)),
      affiche.numero,
      affiche.id,
    ];
    for (const valeur of valeurs) expect(valeur).not.toBe(null);
    for (const valeur of valeurs) expect(valeur).toBeDefined();
  });

  it('donne a chaque element un identifiant distinct', () => {
    const ids = [
      nouvelleRencontre(EQUIPES_CLUB[0]!).id,
      nouvelleRencontre(EQUIPES_CLUB[0]!).id,
      nouveauGroupe().id,
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it('cree une affiche vierge que la conversion accepte sans lever', () => {
    // Une affiche neuve n'a aucune date. La conversion doit malgre tout rendre
    // un document — sinon l'editeur ne peut pas afficher le formulaire a
    // remplir — et c'est la VALIDATION qui signale ce qui manque.
    const domaine = versDomaine(afficheVide('adultes', 1, MAINTENANT));
    expect(domaine.saison).toBe(SAISON_INDETERMINEE);

    const verdict = AfficheSchema.safeParse(domaine);
    expect(verdict.success).toBe(false);
    // Et l'erreur designe le creneau, ce que l'interface pourra montrer.
    expect(JSON.stringify(verdict.error?.issues)).toMatch(/debutIso|Creneau/);
  });

  it('graine les sponsors par journee et categorie', () => {
    expect(afficheVide('jeunes', 8, MAINTENANT).sponsors.graine).toBe('j8-jeunes');
  });
});

describe('equipeLibreDe', () => {
  it('propose la premiere equipe que la journee n engage pas encore', () => {
    const affiche = afficheVide('adultes', 1, MAINTENANT);
    affiche.groupes[0]!.rencontres = [nouvelleRencontre(EQUIPES_CLUB[0]!)];
    affiche.groupes.push({ ...nouveauGroupe(), rencontres: [nouvelleRencontre(EQUIPES_CLUB[1]!)] });
    expect(equipeLibreDe(affiche)).toEqual({ numero: 3, division: 'PR1' });
  });

  it('rend une equipe liberee par une suppression', () => {
    // Les equipes se choisissent dans une table fixe : retirer l'equipe 1 d'un
    // creneau la rend de nouveau disponible, la ou un compteur croissant
    // l'aurait definitivement sautee.
    const affiche = afficheVide('adultes', 1, MAINTENANT);
    affiche.groupes[0]!.rencontres = [
      nouvelleRencontre(EQUIPES_CLUB[0]!),
      nouvelleRencontre(EQUIPES_CLUB[1]!),
    ];
    affiche.groupes[0]!.rencontres = retirer(affiche.groupes[0]!.rencontres, 0);
    expect(equipeLibreDe(affiche).numero).toBe(1);
  });

  it('commence par l equipe 1 sur une affiche neuve', () => {
    expect(equipeLibreDe(afficheVide('adultes', 1, MAINTENANT))).toEqual({
      numero: 1,
      division: 'R2',
    });
  });

  it('rend la derniere equipe plutot que rien quand les huit sont prises', () => {
    const affiche = afficheVide('adultes', 1, MAINTENANT);
    affiche.groupes[0]!.rencontres = EQUIPES_CLUB.map((e) => nouvelleRencontre(e));
    expect(equipeLibreDe(affiche).numero).toBe(8);
  });
});

describe('fixerSponsor', () => {
  const selection: SelectionSponsors = {
    graine: 'j1-adultes',
    emplacements: [
      { sponsorId: null, verrouille: false },
      { sponsorId: null, verrouille: false },
      { sponsorId: null, verrouille: false },
    ],
  };

  it('verrouille l emplacement choisi a la main', () => {
    // Choisir SANS verrouiller ne servirait a rien : le tirage ne regarde le
    // sponsorId d'un emplacement que s'il est verrouille, et la relance
    // suivante effacerait le choix.
    const apres = fixerSponsor(selection, 1, 'carrefour');
    expect(apres.emplacements[1]).toEqual({ sponsorId: 'carrefour', verrouille: true });
  });

  it('rend l emplacement au tirage automatique', () => {
    const fixe = fixerSponsor(selection, 0, 'carrefour');
    expect(fixerSponsor(fixe, 0, null).emplacements[0]).toEqual({
      sponsorId: null,
      verrouille: false,
    });
  });

  it('ne touche ni aux autres emplacements ni a la graine', () => {
    const apres = fixerSponsor(fixerSponsor(selection, 2, 'u'), 0, 'carrefour');
    expect(apres.emplacements[1]).toEqual({ sponsorId: null, verrouille: false });
    expect(apres.emplacements[2]).toEqual({ sponsorId: 'u', verrouille: true });
    expect(apres.graine).toBe('j1-adultes');
  });

  it('ne modifie pas la selection recue', () => {
    fixerSponsor(selection, 0, 'carrefour');
    expect(selection.emplacements[0]).toEqual({ sponsorId: null, verrouille: false });
  });
});
