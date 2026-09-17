import { describe, expect, it } from 'vitest';

import { JourneeSchema } from '../model/journee';
import { SAISON_INDETERMINEE, versDomaine } from './modele';
import {
  deplacer,
  inserer,
  journeeVide,
  nouveauGroupe,
  nouvelleAffiche,
  nouvelleRencontre,
  prochainNumeroEquipe,
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
    const journee = journeeVide(12, MAINTENANT);
    const valeurs = [
      ...Object.values(nouvelleRencontre(1)),
      ...Object.values(nouveauGroupe()).filter((v) => !Array.isArray(v)),
      journee.numero,
      journee.id,
    ];
    for (const valeur of valeurs) expect(valeur).not.toBe(null);
    for (const valeur of valeurs) expect(valeur).toBeDefined();
  });

  it('donne a chaque element un identifiant distinct', () => {
    const ids = [nouvelleRencontre(1).id, nouvelleRencontre(1).id, nouveauGroupe().id];
    expect(new Set(ids).size).toBe(3);
  });

  it('cree une journee vide que la conversion accepte sans lever', () => {
    // Une journee neuve n'a aucune date. La conversion doit malgre tout rendre
    // un document — sinon l'editeur ne peut pas afficher le formulaire a
    // remplir — et c'est la VALIDATION qui signale ce qui manque.
    const domaine = versDomaine(journeeVide(1, MAINTENANT));
    expect(domaine.saison).toBe(SAISON_INDETERMINEE);

    const verdict = JourneeSchema.safeParse(domaine);
    expect(verdict.success).toBe(false);
    // Et l'erreur designe le creneau, ce que l'interface pourra montrer.
    expect(JSON.stringify(verdict.error?.issues)).toMatch(/debutIso|Creneau/);
  });

  it('graine les sponsors par journee et categorie', () => {
    expect(nouvelleAffiche('jeunes', 8).sponsors.graine).toBe('j8-jeunes');
  });
});

describe('prochainNumeroEquipe', () => {
  it('suit le plus grand numero pose, tous creneaux confondus', () => {
    const affiche = nouvelleAffiche('adultes', 1);
    affiche.groupes[0]!.rencontres = [nouvelleRencontre(1), nouvelleRencontre(2)];
    affiche.groupes.push({ ...nouveauGroupe(), rencontres: [nouvelleRencontre(5)] });
    expect(prochainNumeroEquipe(affiche)).toBe(6);
  });

  it('ne recycle pas un numero libere par une suppression', () => {
    // Prendre la taille de la liste redonnerait 2 apres suppression de la
    // deuxieme equipe, alors que le numero 2 vient d'etre retire : deux equipes
    // porteraient le meme rang.
    const affiche = nouvelleAffiche('adultes', 1);
    affiche.groupes[0]!.rencontres = [nouvelleRencontre(1), nouvelleRencontre(2)];
    affiche.groupes[0]!.rencontres = retirer(affiche.groupes[0]!.rencontres, 0);
    expect(prochainNumeroEquipe(affiche)).toBe(3);
  });

  it('commence a 1 sur une affiche neuve', () => {
    expect(prochainNumeroEquipe(nouvelleAffiche('adultes', 1))).toBe(1);
  });
});
