import { describe, expect, it } from 'vitest';

import { emplacementsVides, type SelectionSponsors } from '../model/journee';
import { SPONSORS } from './registre.generated';
import { relancerGraine, SPONSORS_EPINGLES, tirerSponsors } from './tirage';

function selection(graine: string, emplacements = emplacementsVides()): SelectionSponsors {
  return { graine, emplacements };
}

describe('tirerSponsors', () => {
  it('place les partenaires epingles en tete, dans l ordre', () => {
    // Engagement du club, pas une preference d'affichage : le partenaire et le
    // sponsor principal ne peuvent ni etre retires ni etre deplaces.
    const tires = tirerSponsors(selection('j1-adultes'));
    expect(tires.slice(0, 2).map((s) => s.id)).toEqual([...SPONSORS_EPINGLES]);
  });

  it('garde les epingles en tete quelle que soit la graine', () => {
    for (const graine of ['j1-adultes', 'j12-jeunes', 'j1-adultes-9', 'autre']) {
      expect(
        tirerSponsors(selection(graine))
          .slice(0, 2)
          .map((s) => s.id),
      ).toEqual([...SPONSORS_EPINGLES]);
    }
  });

  it('rend cinq partenaires : deux epingles et trois en rotation', () => {
    expect(tirerSponsors(selection('j1-adultes'))).toHaveLength(5);
  });

  it('ne fait jamais figurer un partenaire deux fois', () => {
    for (const graine of ['j1-adultes', 'j2-adultes', 'j3-jeunes']) {
      const ids = tirerSponsors(selection(graine)).map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('est reproductible : meme graine, meme tirage', () => {
    // L'ancien script appelait `Math.random()` sur un parcours de dossier :
    // deux generations de la meme journee ne donnaient jamais la meme affiche,
    // et un apercu en direct aurait papillote a chaque frappe.
    const a = tirerSponsors(selection('j7-adultes')).map((s) => s.id);
    const b = tirerSponsors(selection('j7-adultes')).map((s) => s.id);
    expect(a).toEqual(b);
  });

  it('change de rotation quand la graine change', () => {
    const a = tirerSponsors(selection('j1-adultes'))
      .slice(2)
      .map((s) => s.id);
    const b = tirerSponsors(selection('j1-adultes-2'))
      .slice(2)
      .map((s) => s.id);
    expect(a).not.toEqual(b);
  });

  it('respecte un emplacement verrouille', () => {
    const cible = Object.values(SPONSORS).find(
      (s) => s.actif && !SPONSORS_EPINGLES.includes(s.id as never),
    )!;
    const tires = tirerSponsors(
      selection('j1-adultes', [
        { sponsorId: cible.id, verrouille: true },
        { sponsorId: null, verrouille: false },
        { sponsorId: null, verrouille: false },
      ]),
    );
    // Troisieme position : juste apres les deux epingles.
    expect(tires[2]!.id).toBe(cible.id);
  });

  it('privilegie les partenaires les moins affiches', () => {
    // Rotation equitable : un partenaire deja vu dix fois passe apres ceux qui
    // ne l'ont jamais ete.
    const actifs = Object.values(SPONSORS).filter((s) => s.actif);
    const surexpose = actifs.find((s) => !SPONSORS_EPINGLES.includes(s.id as never))!;
    const compteurs = Object.fromEntries(actifs.map((s) => [s.id, 0]));
    compteurs[surexpose.id] = 10;

    const tires = tirerSponsors(selection('j1-adultes'), { compteurs });
    expect(tires.slice(2).map((s) => s.id)).not.toContain(surexpose.id);
  });

  it('echoue franchement si un partenaire epingle manque', () => {
    // Une affiche publiee sans le sponsor principal est un probleme avec le
    // club, pas un detail graphique.
    const sansEpingles = Object.fromEntries(
      Object.entries(SPONSORS).filter(([id]) => !SPONSORS_EPINGLES.includes(id as never)),
    );
    expect(() => tirerSponsors(selection('j1-adultes'), { inventaire: sansEpingles })).toThrow(
      /epingle/i,
    );
  });
});

describe('relancerGraine', () => {
  it('incremente un suffixe plutot que de tirer au hasard', () => {
    expect(relancerGraine('j1-adultes')).toBe('j1-adultes-2');
    expect(relancerGraine('j1-adultes-2')).toBe('j1-adultes-3');
    expect(relancerGraine('j12-jeunes-9')).toBe('j12-jeunes-10');
  });

  it('reste donc reproductible apres n relances', () => {
    let graine = 'j1-adultes';
    for (let i = 0; i < 3; i++) graine = relancerGraine(graine);
    expect(graine).toBe('j1-adultes-4');
    expect(tirerSponsors(selection(graine)).map((s) => s.id)).toEqual(
      tirerSponsors(selection('j1-adultes-4')).map((s) => s.id),
    );
  });
});
