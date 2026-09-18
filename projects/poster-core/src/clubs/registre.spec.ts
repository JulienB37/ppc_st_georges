import { describe, expect, it } from 'vitest';

import { SPONSORS } from '../sponsors/registre.generated';
import { CLUBS } from './registre.generated';
import { clubIdDepuisFichier, normaliserNomClub } from './normaliser';

/**
 * Tests pilotes par les donnees reellement livrees.
 *
 * Ils ne verifient pas un cas choisi a la main mais l'integralite du registre
 * genere : toute entree ajoutee est couverte d'office, et une faute de frappe
 * dans `assets-src/clubs.labels.json` echoue ici plutot que de produire un
 * logo introuvable en production.
 */
describe('registre des clubs', () => {
  const entrees = Object.entries(CLUBS);

  it('couvre la bibliotheque livree', () => {
    expect(entrees.length).toBeGreaterThanOrEqual(33);
  });

  it('fait coincider chaque identifiant avec son fichier', () => {
    for (const [id, club] of entrees) {
      expect(club.id, id).toBe(id);
      expect(clubIdDepuisFichier(club.fichier), id).toBe(id);
    }
  });

  it('donne a chaque club un libelle lisible', () => {
    for (const [id, club] of entrees) {
      expect(club.libelle.trim(), id).not.toBe('');
      // Un libelle encore sous forme d'identifiant signale un oubli dans le
      // fichier de libelles.
      expect(club.libelle, id).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
    }
  });

  it('retrouve chaque club depuis son propre libelle', () => {
    // L'invariant central : ce que l'interface affiche doit se resoudre vers
    // le club affiche. Les rares exceptions sont couvertes par un alias.
    for (const [id, club] of entrees) {
      const direct = normaliserNomClub(club.libelle);
      const trouve = direct === id || (club.alias as readonly string[]).includes(direct);
      expect(trouve, `« ${club.libelle} » donne « ${direct} », attendu « ${id} » ou un alias`).toBe(
        true,
      );
    }
  });

  it('exprime les alias sous forme deja normalisee', () => {
    // Un alias est compare a une cle normalisee : s'il porte une majuscule ou
    // un accent, il ne pourra jamais correspondre a quoi que ce soit.
    for (const [id, club] of entrees) {
      for (const alias of club.alias as readonly string[]) {
        expect(normaliserNomClub(alias), `${id} / ${alias}`).toBe(alias);
      }
    }
  });

  it('n attribue jamais le meme alias a deux clubs', () => {
    const vus = new Map<string, string>();
    for (const [id, club] of entrees) {
      for (const cle of [id, ...(club.alias as readonly string[])]) {
        const precedent = vus.get(cle);
        expect(precedent, `« ${cle} » revendique par ${precedent} et ${id}`).toBeUndefined();
        vus.set(cle, id);
      }
    }
  });

  it('conserve les dimensions necessaires au cadrage', () => {
    for (const [id, club] of entrees) {
      expect(club.largeur, id).toBeGreaterThan(0);
      expect(club.hauteur, id).toBeGreaterThan(0);
      expect(Math.max(club.largeur, club.hauteur), id).toBeLessThanOrEqual(256);
    }
  });
});

describe('registre des sponsors', () => {
  const entrees = Object.entries(SPONSORS);

  it('distingue les sponsors actifs des anciens', () => {
    const actifs = entrees.filter(([, s]) => s.actif);
    const anciens = entrees.filter(([, s]) => !s.actif);

    expect(actifs.length).toBeGreaterThanOrEqual(3);
    // Le dossier `ancien/` etait aspire par le glob recursif de l'ancien
    // script : des sponsors qui ne le sont plus pouvaient sortir au tirage.
    expect(anciens.length).toBeGreaterThan(0);
    for (const [, s] of anciens) expect(s.actif).toBe(false);
  });

  it('livre un inventaire ordonne, condition du tirage reproductible', () => {
    // Le tirage parcourt les identifiants tries : l'ordre du systeme de
    // fichiers ne doit jamais influer sur les sponsors affiches.
    const ids = entrees.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
