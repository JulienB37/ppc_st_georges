import { describe, expect, it } from 'vitest';

import { versDomaine } from './modele';
import { EQUIPES_CLUB } from '../clubs/equipes';
import { afficheVide, nouvelleRencontre } from './mutations';
import { problemesDe } from './problemes';
import { CONFIG_V1_REELLE } from '../migrate/v1.fixture';
import { migrerDepuisV1 } from '../migrate/v1';

const MAINTENANT = '2026-09-17T10:00:00.000Z';

describe('problemesDe', () => {
  it('ne signale rien sur la configuration reelle du club', () => {
    expect(
      problemesDe(migrerDepuisV1(CONFIG_V1_REELLE, { anneeSaison: 2026 }).affiches[0]!),
    ).toEqual([]);
  });

  it('situe le probleme au lieu de rendre un chemin technique', () => {
    const editable = afficheVide('adultes', 1, MAINTENANT);
    const problemes = problemesDe(versDomaine(editable));

    // Le message brut du schema serait « affiches.0.groupes.0.creneau.debutIso ».
    expect(problemes[0]!.ou).toBe('créneau 1');
    expect(problemes[0]!.quoi).toMatch(/date/i);
    // Et le chemin d'origine reste disponible, pour cibler le champ fautif.
    expect(problemes[0]!.chemin).toEqual(['groupes', 0, 'creneau', 'debutIso']);
  });

  it('situe jusqu a la rencontre', () => {
    const editable = afficheVide('adultes', 1, MAINTENANT);
    const groupe = editable.groupes[0]!;
    groupe.date = '2026-09-19';
    groupe.heure = '18:00';
    groupe.rencontres = [nouvelleRencontre(EQUIPES_CLUB[0]!)];

    const problemes = problemesDe(versDomaine(editable));
    expect(problemes.map((p) => p.ou)).toContain('créneau 1 · rencontre 1');
    expect(problemes.map((p) => p.quoi).join(' ')).toMatch(/adverse/i);
  });

  it('refuse un creneau sans aucune rencontre', () => {
    // Une date complete mais aucune rencontre : rien ne l'interdisait, et
    // l'affiche se laissait donc enregistrer puis exporter — un panneau vide
    // sous une bande de date. Le defaut n'etait visible que depuis que la
    // composition tolere un document incomplet.
    const editable = afficheVide('adultes', 1, MAINTENANT);
    const groupe = editable.groupes[0]!;
    groupe.date = '2026-09-19';
    groupe.heure = '18:00';
    groupe.rencontres = [];

    const problemes = problemesDe(versDomaine(editable));
    expect(problemes.map((p) => `${p.ou} : ${p.quoi}`)).toEqual([
      'créneau 1 : Ce créneau n’a aucune rencontre.',
    ]);
  });

  it('ne repete pas le meme probleme deux fois', () => {
    // Un creneau incomplet fait echouer `debutIso` ET `saison` : l'utilisateur
    // n'a pas besoin de lire deux lignes pour une seule date manquante.
    const problemes = problemesDe(versDomaine(afficheVide('adultes', 1, MAINTENANT)));
    const cles = problemes.map((p) => `${p.ou}|${p.quoi}`);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it('parle du document entier quand le probleme ne vise aucun creneau', () => {
    const affiche = { ...versDomaine(afficheVide('adultes', 1, MAINTENANT)), numero: 0 };
    const problemes = problemesDe(affiche);
    expect(problemes.some((p) => p.ou === '' && /numéro de journée/i.test(p.quoi))).toBe(true);
  });

  it('reprend le message du schema plutot que de le masquer', () => {
    // Repli : un champ qu'on n'a pas traduit doit rester signale.
    const abime = { ...versDomaine(afficheVide('adultes', 1, MAINTENANT)), id: '' };
    const problemes = problemesDe(abime);
    expect(problemes.some((p) => p.chemin.includes('id'))).toBe(true);
  });
});
