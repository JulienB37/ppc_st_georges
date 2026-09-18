import { describe, expect, it } from 'vitest';

import { ECHELLE, PLANCHERS } from '../render/tokens';
import { calculerDensite, choisirVariante, hauteurDisponible, repartirEnColonnes } from './densite';

describe('calculerDensite', () => {
  it('tient la journee type du club sans descendre sous les planchers', () => {
    // 8 rencontres en 3 creneaux : la journee 12 telle qu'elle a ete publiee.
    const d = calculerDensite(8, 3, 'portrait');
    expect(d.variante).toBe('liste');
    // Le facteur exact depend de la hauteur offerte au contenu, qui bouge avec
    // la maquette : ce qui compte est qu'aucun plancher ne soit franchi.
    expect(d.facteur).toBeGreaterThan(0.62);
    expect(d.facteur).toBeLessThan(1);
    expect(d.tailleNom).toBeGreaterThanOrEqual(PLANCHERS.tailleNom);
    expect(d.diametreLogo).toBeGreaterThanOrEqual(PLANCHERS.diametreLogo);
    expect(d.hauteurRangee).toBeGreaterThanOrEqual(PLANCHERS.hauteurRangee);
  });

  it('ne gonfle pas une journee creuse au-dela du plafond', () => {
    const d = calculerDensite(4, 1, 'portrait');
    expect(d.facteur).toBeLessThanOrEqual(ECHELLE.max);
    expect(d.strategie).toBe('naturel');
  });

  it('signale la reduction au lieu de la subir', () => {
    expect(calculerDensite(4, 1, 'portrait').strategie).toBe('naturel');
    expect(calculerDensite(8, 3, 'portrait').strategie).toBe('reduit');
    expect(calculerDensite(12, 3, 'portrait').strategie).toBe('colonnes');
  });

  it('borne le facteur des deux cotes', () => {
    const enorme = calculerDensite(40, 8, 'portrait');
    expect(enorme.facteur).toBeGreaterThanOrEqual(ECHELLE.min);
    const minuscule = calculerDensite(1, 1, 'portrait');
    expect(minuscule.facteur).toBeLessThanOrEqual(ECHELLE.max);
  });

  it('ne sort jamais du cadre, quel que soit le nombre de rencontres', () => {
    // L'ancien moteur accumulait `y` sans borne : au-dela de huit rencontres,
    // le contenu etait rogne sans prevenir. C'est le test qui l'aurait attrape.
    for (let n = 1; n <= 24; n++) {
      for (const groupes of [1, 2, 3, 4]) {
        const d = calculerDensite(n, groupes, 'portrait');
        const hauteur =
          (n * d.pasRangee + groupes * (d.hauteurEnteteGroupe + d.ecartGroupe)) / d.colonnes;
        expect(hauteur, `${n} rencontres en ${groupes} groupes`).toBeLessThanOrEqual(
          hauteurDisponible('portrait') + 1,
        );
      }
    }
  });
});

describe('choisirVariante', () => {
  it('passe en duel sur une journee tres legere', () => {
    expect(choisirVariante(1, 'portrait')).toBe('duel');
    expect(choisirVariante(3, 'portrait')).toBe('duel');
    expect(choisirVariante(4, 'portrait')).toBe('liste');
  });

  it('bascule en double colonne plus tot en carre qu en portrait', () => {
    // C'est la justification chiffree du portrait par defaut : la journee type
    // du club compte huit rencontres, que le carre ne tient deja plus en une
    // colonne.
    expect(choisirVariante(8, 'portrait')).toBe('liste');
    expect(choisirVariante(8, 'carre')).toBe('doubleColonne');
    expect(choisirVariante(10, 'portrait')).toBe('liste');
    expect(choisirVariante(11, 'portrait')).toBe('doubleColonne');
  });
});

describe('repartirEnColonnes', () => {
  it('equilibre les hauteurs sans couper un groupe', () => {
    const groupes = [5, 1, 3, 2, 4];
    const [gauche, droite] = repartirEnColonnes(groupes, (g) => g);
    const somme = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

    expect([...gauche, ...droite].sort()).toEqual([...groupes].sort());
    expect(Math.abs(somme(gauche) - somme(droite))).toBeLessThanOrEqual(3);
  });

  it('accepte une liste vide', () => {
    expect(repartirEnColonnes([], () => 0)).toEqual([[], []]);
  });
});
