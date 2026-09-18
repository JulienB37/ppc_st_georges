import { describe, expect, it } from 'vitest';

import { formatCreneau } from '../format/creneau';
import { AfficheSchema, compterRencontres } from '../model/journee';
import { CONFIG_V1_REELLE } from './v1.fixture';
import { lireDateFrancaise, lireEquipeLocale, migrerDepuisV1 } from './v1';

const OPTIONS = { anneeSaison: 2025 };

describe('lireDateFrancaise', () => {
  it('relit les libelles reellement saisis dans les anciens fichiers', () => {
    expect(lireDateFrancaise('Samedi 19 Septembre à 18h00', 2025)).toBe('2025-09-19T18:00');
    expect(lireDateFrancaise('Dimanche 20 Septembre à 9h30', 2025)).toBe('2025-09-20T09:30');
    expect(lireDateFrancaise('Samedi 11 Avril à 10h00', 2025)).toBe('2026-04-11T10:00');
  });

  it('rattache les mois de janvier a aout a la seconde annee de la saison', () => {
    expect(lireDateFrancaise('Samedi 21 Mars à 18h00', 2025)).toBe('2026-03-21T18:00');
    expect(lireDateFrancaise('Samedi 6 Septembre à 18h00', 2025)).toBe('2025-09-06T18:00');
  });

  it('tolere les variantes de saisie', () => {
    expect(lireDateFrancaise('samedi 5 fevrier a 14h', 2025)).toBe('2026-02-05T14:00');
    expect(lireDateFrancaise('Dimanche 1 Décembre à 9h00', 2025)).toBe('2025-12-01T09:00');
  });

  it('renonce plutot que de deviner', () => {
    expect(lireDateFrancaise('le week-end prochain', 2025)).toBeNull();
    expect(lireDateFrancaise('Samedi 19 Brumaire à 18h00', 2025)).toBeNull();
  });
});

describe('lireEquipeLocale', () => {
  it('separe la division du numero d equipe', () => {
    expect(lireEquipeLocale('R2 (1)')).toEqual({ division: 'R2', numero: 1 });
    expect(lireEquipeLocale('D3 (8)')).toEqual({ division: 'D3', numero: 8 });
    expect(lireEquipeLocale('PR (3)')).toEqual({ division: 'PR', numero: 3 });
  });

  it('accepte les libelles jeunes, sans division', () => {
    expect(lireEquipeLocale('PPC St Georges 1')).toEqual({ division: null, numero: 1 });
    expect(lireEquipeLocale('PPC St Georges 2')).toEqual({ division: null, numero: 2 });
  });

  it('prend un libelle sans chiffre pour une division seule', () => {
    expect(lireEquipeLocale('R2')).toEqual({ division: 'R2', numero: 1 });
  });
});

describe('migrerDepuisV1', () => {
  const resultat = migrerDepuisV1(CONFIG_V1_REELLE, OPTIONS);

  it('produit des documents conformes au schema v3', () => {
    for (const affiche of resultat.affiches) {
      expect(() => AfficheSchema.parse(affiche)).not.toThrow();
      expect(affiche.versionSchema).toBe(3);
    }
  });

  it('rend UNE AFFICHE PAR CHAMPIONNAT, chacune a son numero de journee', () => {
    // La v2 enveloppait les deux dans une journee unique et devait donc choisir
    // un numero : elle jetait l'autre en l'annoncant. La configuration reelle
    // du club rendait la perte visible — adultes en journee 1, jeunes en 8.
    expect(resultat.affiches.map((a) => [a.categorie, a.numero])).toEqual([
      ['adultes', 1],
      ['jeunes', 8],
    ]);
  });

  it("n'avertit plus d'un numero jete, puisque rien n'est jete", () => {
    expect(resultat.avertissements.join(' ')).not.toMatch(/divergent/i);
  });

  it('deduit la saison de la premiere date, sans la demander', () => {
    expect(resultat.affiches[0]!.saison).toBe('2025-2026');
  });

  it('convertit les deux sections en deux affiches', () => {
    expect(resultat.affiches.map((a) => a.categorie)).toEqual(['adultes', 'jeunes']);
  });

  it('ne perd aucune rencontre', () => {
    const [adultes, jeunes] = resultat.affiches;
    expect(compterRencontres(adultes!)).toBe(8);
    expect(compterRencontres(jeunes!)).toBe(2);
    expect(adultes!.groupes).toHaveLength(3);
  });

  it('porte le lieu sur le creneau et non plus sur chaque rencontre', () => {
    const adultes = resultat.affiches[0]!;
    expect(adultes.groupes.map((g) => g.domicile)).toEqual([false, true, true]);
    // Les deux rencontres jeunes se jouent au meme endroit : un seul groupe.
    expect(resultat.affiches[1]!.groupes).toHaveLength(1);
  });

  it('separe club et numero d equipe chez l adversaire', () => {
    // Le libelle ne nomme QUE le club : le numero vit dans son propre champ, et
    // l'affiche recompose les deux a l'impression. Les garder tous les deux
    // dans le libelle faisait imprimer « St Sulpice TT 1 1 ».
    const premiere = resultat.affiches[0]!.groupes[0]!.rencontres[0]!;
    expect(premiere.adversaire).toEqual({
      clubId: 'st-sulpice-tt',
      numero: 1,
      libelle: 'St Sulpice TT',
    });
    expect(premiere.equipeLocale).toEqual({ division: 'D2', numero: 6 });
  });

  it('conserve le libelle de date d origine, au caractere pres', () => {
    // Garantie forte : l'affiche migree imprime exactement le meme texte que
    // l'ancienne, quelle que soit la qualite de la relecture de la date.
    const libelles = resultat.affiches
      .flatMap((a) => a.groupes)
      .map((g) => g.creneau.libelleOverride);
    expect(libelles).toEqual([
      'Samedi 19 Septembre à 18h00',
      'Samedi 19 Septembre à 18h00',
      'Dimanche 20 Septembre à 9h30',
      'Samedi 11 Avril à 10h00',
    ]);
  });

  it('relit toutes les dates du fichier reel', () => {
    expect(resultat.datesNonLues).toEqual([]);
    const premier = resultat.affiches[0]!.groupes[0]!.creneau;
    expect(premier.debutIso).toBe('2025-09-19T18:00');
  });

  it('detecte un jour de semaine qui ne colle pas a la date', () => {
    // Le fichier du club annonce « Samedi 19 Septembre » : rattache a la saison
    // 2025-2026, c'est un vendredi. Le jour etait saisi a la main, donc rien ne
    // le verifiait. C'est exactement ce que le nouveau modele supprime, la date
    // etant desormais un instant dont le libelle est calcule.
    const incoherences = resultat.avertissements.filter((a) => a.includes('est un'));
    expect(incoherences.length).toBeGreaterThan(0);
    expect(incoherences[0]).toContain('vendredi');
  });

  it('ne signale plus la section adultes une fois la bonne saison choisie', () => {
    // Rattaches a 2026-2027, les libelles adultes tombent juste : le 19
    // septembre 2026 est bien un samedi, et le 20 un dimanche.
    const bonneSaison = migrerDepuisV1({ adulte: CONFIG_V1_REELLE.adulte }, { anneeSaison: 2026 });
    expect(bonneSaison.avertissements).toEqual([]);

    const premier = bonneSaison.affiches[0]!.groupes[0]!.creneau;
    expect(premier.debutIso).toBe('2026-09-19T18:00');
    // Ce que le nouveau formatage imprimerait, une fois l'override retire.
    expect(formatCreneau(premier.debutIso)).toBe('Samedi 19 septembre à 18h00');
  });

  it('demasque les deux sections rattachees a des saisons differentes', () => {
    // Aucune saison ne rend le fichier coherent : les dates adultes tombent
    // juste en 2026-2027, la date jeunes en 2025-2026. Ajoute a l'ecart de
    // numero de journee (1 contre 8), la section jeunes est un reliquat jamais
    // nettoye — que rien ne signalait jusqu'ici, le jour de semaine etant
    // saisi a la main.
    const adultesSeules = (annee: number) =>
      migrerDepuisV1({ adulte: CONFIG_V1_REELLE.adulte }, { anneeSaison: annee }).avertissements;
    const jeunesSeuls = (annee: number) =>
      migrerDepuisV1({ enfant: CONFIG_V1_REELLE.enfant }, { anneeSaison: annee }).avertissements;

    expect(adultesSeules(2025).length).toBeGreaterThan(0);
    expect(adultesSeules(2026)).toEqual([]);

    expect(jeunesSeuls(2025)).toEqual([]);
    expect(jeunesSeuls(2026).length).toBeGreaterThan(0);

    // Donc, quelle que soit la saison retenue, le fichier complet proteste.
    for (const annee of [2025, 2026]) {
      expect(
        migrerDepuisV1(CONFIG_V1_REELLE, { anneeSaison: annee }).avertissements.length,
      ).toBeGreaterThan(0);
    }
  });

  it('donne a chaque affiche une graine de sponsors stable', () => {
    const [adultes, jeunes] = resultat.affiches;
    expect(adultes!.sponsors.graine).toBe('j1-adultes');
    expect(jeunes!.sponsors.graine).toBe('j8-jeunes');
    expect(adultes!.sponsors.emplacements).toHaveLength(3);
  });

  it('refuse une configuration vide', () => {
    expect(() => migrerDepuisV1({}, OPTIONS)).toThrow(/vide/);
  });

  it('accepte une configuration adultes seule', () => {
    const seul = migrerDepuisV1({ adulte: CONFIG_V1_REELLE.adulte }, OPTIONS);
    expect(seul.affiches).toHaveLength(1);
    expect(seul.avertissements.filter((a) => a.includes('Numeros de journee'))).toEqual([]);
  });
});
