import { z } from 'zod';

import { clubIdDepuisLibelle, separerNumeroEquipe } from '../clubs/normaliser';
import { saisonDe } from '../format/creneau';
import {
  VERSION_SCHEMA,
  creerAffiche,
  nouvelId,
  type Affiche,
  type EquipeLocale,
  type Groupe,
  type Journee,
  type Rencontre,
} from '../model/journee';

/**
 * Import du format historique (`legacy/journee_config.json`) vers le modele v2.
 *
 * Premier maillon de la chaine de migrations. Il est aussi le plus expose :
 * il tourne sur des documents rediges a la main pendant plusieurs saisons,
 * dont on ne peut rien presumer d'autre que ce que l'ancien schema imposait.
 */

const MatcheV1 = z.object({
  equipe_st_georges: z.string(),
  equipe_adverse: z.string(),
});

const GroupeV1 = z.object({
  domicile: z.boolean(),
  date: z.string(),
  matches: z.array(MatcheV1),
});

const MatcheEnfantV1 = MatcheV1.extend({ domicile: z.boolean() });

export const ConfigV1Schema = z.object({
  adulte: z
    .object({
      journee: z.number().int(),
      groupes: z.array(GroupeV1),
    })
    .optional(),
  enfant: z
    .object({
      journee: z.number().int(),
      date: z.string(),
      matche_1: MatcheEnfantV1,
      matche_2: MatcheEnfantV1,
    })
    .optional(),
});

export type ConfigV1 = z.infer<typeof ConfigV1Schema>;

const MOIS = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
];

function sansAccents(texte: string): string {
  return texte
    .normalize('NFD')
    .toLowerCase()
    .replace(/\p{Diacritic}/gu, '');
}

/** `Septembre` -> 9, insensible a la casse et aux accents. */
function numeroDeMois(nom: string): number | null {
  const index = MOIS.indexOf(sansAccents(nom));
  return index === -1 ? null : index + 1;
}

/**
 * Compare le jour de semaine ecrit a la main avec celui que la date implique.
 *
 * Les libelles v1 etaient saisis entierement a la main : rien ne garantissait
 * que « Samedi » corresponde au quantieme qui suit. Le fichier reel du club en
 * porte d'ailleurs la trace. Signaler l'ecart aide surtout a reperer une
 * saison de rattachement mal choisie a l'import.
 */
export function jourSemaineIncoherent(texte: string, debutIso: string): string | null {
  const ecrit = /^\s*([A-Za-zÀ-ÿ]+)/u.exec(texte)?.[1];
  if (!ecrit) return null;

  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const canon = sansAccents(ecrit);
  if (!jours.includes(canon)) return null;

  const [a = '', mo = '', j = ''] = debutIso.slice(0, 10).split('-');
  const reel = jours[new Date(Date.UTC(Number(a), Number(mo) - 1, Number(j))).getUTCDay()]!;
  return canon === reel ? null : reel;
}

/**
 * Tente de lire « Samedi 19 Septembre à 18h00 ».
 *
 * Ces chaines etaient saisies a la main et ne portent pas d'annee : celle-ci
 * est deduite de la saison de reference (septembre a aout). L'analyse reste
 * volontairement au « meilleur effort » — le libelle d'origine est de toute
 * facon conserve tel quel dans `libelleOverride`, donc l'affiche imprimera
 * exactement le meme texte qu'avant, meme si la lecture echoue. La date ne
 * sert qu'a classer l'historique et a deduire la saison.
 */
export function lireDateFrancaise(texte: string, anneeSaison: number): string | null {
  const m = /(\d{1,2})\s+([A-Za-zÀ-ÿ]+)(?:.*?(\d{1,2})\s*h\s*(\d{0,2}))?/u.exec(texte);
  if (!m) return null;
  const [, jourBrut = '', moisBrut = '', heureBrut, minuteBrut] = m;

  const mois = numeroDeMois(moisBrut);
  if (mois === null) return null;

  const jour = Number(jourBrut);
  if (jour < 1 || jour > 31) return null;

  // Saison sportive : septembre a decembre sur l'annee d'ouverture, janvier a
  // aout sur la suivante.
  const annee = mois >= 9 ? anneeSaison : anneeSaison + 1;
  const heures = heureBrut ? Number(heureBrut) : 0;
  const minutes = minuteBrut ? Number(minuteBrut.padEnd(2, '0')) : 0;
  if (heures > 23 || minutes > 59) return null;

  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${annee}-${p2(mois)}-${p2(jour)}T${p2(heures)}:${p2(minutes)}`;
}

/**
 * `R2 (1)` -> division R2, equipe 1. `PPC St Georges 1` -> pas de division,
 * equipe 1. Un libelle sans aucun chiffre est pris pour une division seule.
 */
export function lireEquipeLocale(libelle: string): EquipeLocale {
  const avecParentheses = /^(.+?)\s*\((\d+)\)\s*$/.exec(libelle.trim());
  if (avecParentheses) {
    const [, division = '', numero = '1'] = avecParentheses;
    return { division: division.trim(), numero: Number(numero) };
  }

  const { numero } = separerNumeroEquipe(libelle);
  if (numero !== null) return { division: null, numero };

  return { division: libelle.trim() || null, numero: 1 };
}

function rencontreDepuis(equipeStGeorges: string, equipeAdverse: string): Rencontre {
  const libelle = equipeAdverse.trim();
  return {
    id: nouvelId(),
    equipeLocale: lireEquipeLocale(equipeStGeorges),
    adversaire: {
      clubId: clubIdDepuisLibelle(libelle),
      numero: separerNumeroEquipe(libelle).numero,
      libelle,
    },
  };
}

function groupeDepuis(
  date: string,
  domicile: boolean,
  matches: { equipe_st_georges: string; equipe_adverse: string }[],
  anneeSaison: number,
  repli: string,
): Groupe {
  const debutIso = lireDateFrancaise(date, anneeSaison) ?? repli;
  return {
    id: nouvelId(),
    creneau: {
      debutIso,
      // Toujours conserve : c'est ce qui garantit que l'affiche migree porte
      // exactement le meme texte que l'ancienne.
      libelleOverride: date,
    },
    domicile,
    rencontres: matches.map((m) => rencontreDepuis(m.equipe_st_georges, m.equipe_adverse)),
  };
}

export interface OptionsMigrationV1 {
  /**
   * Annee d'ouverture de la saison a laquelle rattacher ces journees : 2025
   * pour la saison 2025-2026. Les anciens fichiers ne portent pas d'annee.
   */
  anneeSaison: number;
}

export interface ResultatMigrationV1 {
  journee: Journee;
  /** Creneaux dont la date n'a pas pu etre relue et qui ont pris la date de repli. */
  datesNonLues: string[];
  /**
   * Incoherences rencontrees dans le document d'origine. Elles ne bloquent pas
   * l'import — l'utilisateur corrigera dans l'interface — mais elles ne doivent
   * pas passer sous silence.
   */
  avertissements: string[];
}

/**
 * Convertit une configuration v1 en document v2.
 *
 * Les deux sections `adulte` et `enfant` deviennent deux affiches d'une meme
 * journee. Les rencontres jeunes, figees a deux dans l'ancien format, sont
 * regroupees par lieu : le modele en accepte desormais un nombre quelconque.
 */
export function migrerDepuisV1(brut: unknown, options: OptionsMigrationV1): ResultatMigrationV1 {
  const config = ConfigV1Schema.parse(brut);
  if (!config.adulte && !config.enfant) {
    throw new Error('Configuration v1 vide : ni section adulte, ni section enfant.');
  }

  const datesNonLues: string[] = [];
  const avertissements: string[] = [];
  const repli = `${options.anneeSaison}-09-01T18:00`;
  const affiches: Affiche[] = [];

  const numero = config.adulte?.journee ?? config.enfant?.journee ?? 1;

  // Le format v1 portait un numero de journee par section, sans rien pour les
  // maintenir d'accord. Les fichiers reels finissent par diverger a force
  // d'etre edites a la main.
  if (config.adulte && config.enfant && config.adulte.journee !== config.enfant.journee) {
    avertissements.push(
      `Numeros de journee divergents : adultes ${config.adulte.journee}, ` +
        `jeunes ${config.enfant.journee}. La journee ${numero} a ete retenue.`,
    );
  }

  // Une meme date apparait sur plusieurs groupes : on ne signale qu'une fois.
  const dejaExaminees = new Set<string>();
  const examinerDate = (date: string): void => {
    if (dejaExaminees.has(date)) return;
    dejaExaminees.add(date);

    const iso = lireDateFrancaise(date, options.anneeSaison);
    if (iso === null) {
      datesNonLues.push(date);
      return;
    }
    const reel = jourSemaineIncoherent(date, iso);
    if (reel) {
      avertissements.push(
        `« ${date} » : le ${iso.slice(0, 10)} est un ${reel}. ` +
          `Verifiez la saison de rattachement ou corrigez la date.`,
      );
    }
  };

  if (config.adulte) {
    const groupes = config.adulte.groupes.map((g) => {
      examinerDate(g.date);
      return groupeDepuis(g.date, g.domicile, g.matches, options.anneeSaison, repli);
    });
    affiches.push({ ...creerAffiche('adultes', config.adulte.journee), groupes });
  }

  if (config.enfant) {
    const enfant = config.enfant;
    examinerDate(enfant.date);

    // Un groupe par lieu : l'ancien format portait `domicile` sur chaque
    // rencontre, le nouveau le porte sur le creneau.
    const parLieu = new Map<boolean, (typeof enfant.matche_1)[]>();
    for (const m of [enfant.matche_1, enfant.matche_2]) {
      const liste = parLieu.get(m.domicile) ?? [];
      liste.push(m);
      parLieu.set(m.domicile, liste);
    }

    const groupes = [...parLieu.entries()]
      // Domicile d'abord, comme sur les affiches existantes.
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([domicile, matches]) =>
        groupeDepuis(enfant.date, domicile, matches, options.anneeSaison, repli),
      );

    affiches.push({ ...creerAffiche('jeunes', enfant.journee), groupes });
  }

  const debuts = affiches.flatMap((a) => a.groupes.map((g) => g.creneau.debutIso)).sort();
  const maintenant = new Date().toISOString();

  return {
    journee: {
      versionSchema: VERSION_SCHEMA,
      id: nouvelId(),
      numero,
      saison: saisonDe(debuts[0] ?? repli),
      affiches,
      creeLe: maintenant,
      majLe: maintenant,
    },
    datesNonLues,
    avertissements,
  };
}
