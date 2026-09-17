import { describe, expect, it } from 'vitest';

import { CONFIG_V1_REELLE } from '../migrate/v1.fixture';
import { migrerDepuisV1 } from '../migrate/v1';
import { JourneeSchema } from '../model/journee';
import {
  joindreCreneau,
  scinderCreneau,
  versDomaine,
  versEditable,
  SAISON_INDETERMINEE,
} from './modele';

/** La vraie configuration du club : le meilleur echantillon disponible. */
const JOURNEE = migrerDepuisV1(CONFIG_V1_REELLE, { anneeSaison: 2026 }).journee;

describe('creneau scinde et rejoint', () => {
  it('separe la date de l heure sans passer par une Date', () => {
    expect(scinderCreneau('2026-09-19T18:00')).toEqual({ date: '2026-09-19', heure: '18:00' });
  });

  it('recompose a l identique', () => {
    expect(joindreCreneau('2026-09-19', '18:00')).toBe('2026-09-19T18:00');
  });

  it('traverse un changement d heure sans decaler le creneau', () => {
    // Le 25 octobre 2026 est un changement d'heure en France. Un aller-retour
    // par `new Date` ferait bouger ce creneau ; le format etant local et sans
    // fuseau, celui-ci ne doit pas bouger d'une minute.
    const iso = '2026-10-25T02:30';
    const { date, heure } = scinderCreneau(iso);
    expect(joindreCreneau(date, heure)).toBe(iso);
  });
});

describe('aller-retour domaine <-> editable', () => {
  it('ne perd rien sur la configuration reelle du club', () => {
    const retour = versDomaine(versEditable(JOURNEE), JOURNEE.majLe);
    expect(retour).toEqual(JOURNEE);
    // Et le resultat reste un document valide, pas seulement un objet egal.
    expect(() => JourneeSchema.parse(retour)).not.toThrow();
  });

  it('aplatit les trois champs que les Signal Forms interdisent', () => {
    const editable = versEditable(JOURNEE);
    for (const affiche of editable.affiches) {
      for (const groupe of affiche.groupes) {
        expect(typeof groupe.libelleOverride).toBe('string');
        for (const rencontre of groupe.rencontres) {
          expect(typeof rencontre.division).toBe('string');
          expect(typeof rencontre.adversaireNumero).toBe('number');
        }
      }
    }
  });

  it('retablit null et l absence au retour', () => {
    const editable = versEditable(JOURNEE);
    const groupe = editable.affiches[0]!.groupes[0]!;
    groupe.libelleOverride = '';
    groupe.rencontres[0]!.division = '';
    groupe.rencontres[0]!.adversaireNumero = 0;

    const domaine = versDomaine(editable);
    const rencontre = domaine.affiches[0]!.groupes[0]!.rencontres[0]!;
    expect(domaine.affiches[0]!.groupes[0]!.creneau.libelleOverride).toBeUndefined();
    expect(rencontre.equipeLocale.division).toBeNull();
    expect(rencontre.adversaire.numero).toBeNull();
  });

  it('conserve un libelle impose plutot que de le recalculer', () => {
    // C'est l'echappatoire ou la migration depose les chaines saisies a la
    // main : la perdre ferait reapparaitre du francais analyse.
    const editable = versEditable(JOURNEE);
    editable.affiches[0]!.groupes[0]!.libelleOverride = 'Samedi 21 Mars à 18h00';
    expect(versDomaine(editable).affiches[0]!.groupes[0]!.creneau.libelleOverride).toBe(
      'Samedi 21 Mars à 18h00',
    );
  });
});

describe('saison', () => {
  it('se recalcule depuis la date saisie au lieu d etre reportee', () => {
    // L'utilisateur ne saisit pas la saison : corriger une date doit corriger
    // la saison, ce qu'un report silencieux de l'ancienne valeur ne ferait pas.
    const editable = versEditable(JOURNEE);
    for (const affiche of editable.affiches) {
      for (const groupe of affiche.groupes) groupe.date = '2030-10-04';
    }
    expect(versDomaine(editable).saison).toBe('2030-2031');
  });

  it('bascule d une saison a l autre au 1er septembre', () => {
    const editable = versEditable(JOURNEE);
    const poser = (date: string) => {
      const copie = structuredClone(editable);
      for (const affiche of copie.affiches) {
        for (const groupe of affiche.groupes) groupe.date = date;
      }
      return versDomaine(copie).saison;
    };
    expect(poser('2026-08-31')).toBe('2025-2026');
    expect(poser('2026-09-01')).toBe('2026-2027');
  });

  it('rend une saison remarquable tant qu aucune date n est saisie', () => {
    const vide = { ...versEditable(JOURNEE), affiches: [] };
    expect(versDomaine(vide).saison).toBe(SAISON_INDETERMINEE);
  });
});

describe('horodatage', () => {
  it("laisse l'appelant dater la modification, la librairie ne lisant pas l'horloge", () => {
    const editable = versEditable(JOURNEE);
    expect(versDomaine(editable, '2026-09-17T10:00:00.000Z').majLe).toBe(
      '2026-09-17T10:00:00.000Z',
    );
    // Sans argument, la valeur portee par le modele est conservee.
    expect(versDomaine(editable).majLe).toBe(JOURNEE.majLe);
  });
});
