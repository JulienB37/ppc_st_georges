import { describe, expect, it } from 'vitest';

import { AfficheSchema } from '../model/journee';
import { migrerDepuisV1 } from '../migrate/v1';
import { CONFIG_V1_REELLE } from '../migrate/v1.fixture';
import { formatCreneau } from '../format/creneau';
import { dupliquerAffiche } from './duplication';

const MAINTENANT = '2026-09-17T10:00:00.000Z';
const ADULTES = migrerDepuisV1(CONFIG_V1_REELLE, { anneeSaison: 2026 }).affiches[0]!;

describe('dupliquerAffiche', () => {
  const copie = dupliquerAffiche(ADULTES, MAINTENANT);

  it('avance d une journee', () => {
    expect(ADULTES.numero).toBe(1);
    expect(copie.numero).toBe(2);
  });

  it('decale chaque creneau d une semaine, a la meme heure', () => {
    expect(ADULTES.groupes.map((g) => g.creneau.debutIso)).toEqual([
      '2026-09-19T18:00',
      '2026-09-19T18:00',
      '2026-09-20T09:30',
    ]);
    expect(copie.groupes.map((g) => g.creneau.debutIso)).toEqual([
      '2026-09-26T18:00',
      '2026-09-26T18:00',
      '2026-09-27T09:30',
    ]);
  });

  it('garde l heure de part et d autre d un changement d heure', () => {
    // Le 25 octobre 2026, la France repasse a l'heure d'hiver. Une journee du
    // 24 dupliquee doit rester a 18h00 le 31, et non glisser d'une heure.
    const veille = {
      ...ADULTES,
      groupes: [
        {
          ...ADULTES.groupes[0]!,
          creneau: { debutIso: '2026-10-24T18:00' },
        },
      ],
    };
    expect(dupliquerAffiche(veille, MAINTENANT).groupes[0]!.creneau.debutIso).toBe(
      '2026-10-31T18:00',
    );
  });

  it('EFFACE le libelle impose, qui porte la date de la semaine passee', () => {
    // Le piege de cette fonction. La configuration du club porte des libelles
    // saisis a la main — « Samedi 19 Septembre à 18h00 » — que la migration a
    // conserves. Les garder ici ferait imprimer l'ancienne date sur la nouvelle
    // affiche, alors meme que le creneau a ete decale.
    expect(ADULTES.groupes[0]!.creneau.libelleOverride).toBe('Samedi 19 Septembre à 18h00');
    expect(copie.groupes[0]!.creneau.libelleOverride).toBeUndefined();
    // Et le libelle calcule tombe bien sur la nouvelle date.
    expect(formatCreneau(copie.groupes[0]!.creneau.debutIso)).toBe('Samedi 26 septembre à 18h00');
  });

  it('regenere tous les identifiants', () => {
    const anciens = new Set([
      ADULTES.id,
      ...ADULTES.groupes.map((g) => g.id),
      ...ADULTES.groupes.flatMap((g) => g.rencontres.map((r) => r.id)),
    ]);
    const nouveaux = [
      copie.id,
      ...copie.groupes.map((g) => g.id),
      ...copie.groupes.flatMap((g) => g.rencontres.map((r) => r.id)),
    ];
    for (const id of nouveaux) expect(anciens.has(id)).toBe(false);
    // Et ils sont distincts entre eux.
    expect(new Set(nouveaux).size).toBe(nouveaux.length);
  });

  it('conserve equipes, adversaires et lieux, qui se repetent d une semaine a l autre', () => {
    const sans = (a: typeof ADULTES) =>
      a.groupes.map((g) => ({
        domicile: g.domicile,
        rencontres: g.rencontres.map((r) => ({
          equipeLocale: r.equipeLocale,
          adversaire: r.adversaire,
        })),
      }));
    expect(sans(copie)).toEqual(sans(ADULTES));
  });

  it('fait avancer la rotation des sponsors', () => {
    // Meme graine resservirait les memes partenaires deux semaines de suite.
    expect(copie.sponsors.graine).not.toBe(ADULTES.sponsors.graine);
    expect(copie.sponsors.graine).toBe('j2-adultes');
  });

  it('conserve les emplacements verrouilles, qui sont des choix explicites', () => {
    const avecVerrou = {
      ...ADULTES,
      sponsors: {
        ...ADULTES.sponsors,
        emplacements: [
          { sponsorId: 'carrefour', verrouille: true },
          { sponsorId: null, verrouille: false },
          { sponsorId: null, verrouille: false },
        ] as typeof ADULTES.sponsors.emplacements,
      },
    };
    expect(dupliquerAffiche(avecVerrou, MAINTENANT).sponsors.emplacements[0]).toEqual({
      sponsorId: 'carrefour',
      verrouille: true,
    });
  });

  it('rend un document valide, date de maintenant', () => {
    expect(() => AfficheSchema.parse(copie)).not.toThrow();
    expect(copie.creeLe).toBe(MAINTENANT);
    expect(copie.majLe).toBe(MAINTENANT);
  });

  it('accepte un numero et un decalage imposes', () => {
    const saut = dupliquerAffiche(ADULTES, MAINTENANT, { numero: 12, decalageJours: 77 });
    expect(saut.numero).toBe(12);
    expect(saut.groupes[0]!.creneau.debutIso).toBe('2026-12-05T18:00');
  });
});
