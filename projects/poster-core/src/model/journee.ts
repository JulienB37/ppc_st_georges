import { z } from 'zod';

import { parseCreneau, saisonDe } from '../format/creneau';

/**
 * Modele de document v2.
 *
 * Trois ruptures assumees avec le format historique (`legacy/journee_config.json`),
 * chacune corrigeant un defaut de conception :
 *
 * 1. Les affiches adultes et jeunes partagent la meme forme. L'ancienne
 *    section `enfant` etait figee a exactement deux rencontres
 *    (`matche_1` / `matche_2`), ce qui rendait toute troisieme rencontre
 *    impossible a saisir et dupliquait le code de dessin.
 * 2. L'adversaire porte un identifiant de club et un numero d'equipe separes,
 *    la ou une chaine libre obligeait le moteur de rendu a deviner le club par
 *    expression reguliere au moment de dessiner.
 * 3. La date est un instant, plus une chaine saisie a la main. Le libelle
 *    imprime en est calcule, ce qui supprime « Samedi 09 Mai » et consorts.
 */
export const VERSION_SCHEMA = 2;

/** Un instant local, sans fuseau : `2026-09-19T18:00`. */
export const CreneauSchema = z.object({
  debutIso: z.string().refine(
    (v) => {
      try {
        parseCreneau(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Creneau attendu au format AAAA-MM-JJThh:mm' },
  ),
  /**
   * Echappatoire : remplace le libelle calcule. C'est la que la migration
   * depose les chaines saisies a la main (« Samedi 21 Mars à 18h00 »), pour
   * qu'aucune donnee ne soit perdue et qu'aucun francais ne soit analyse.
   */
  libelleOverride: z.string().min(1).optional(),
});

/**
 * Une equipe du club.
 *
 * `division` est la pastille affichee (« R2 », « D1 », « PR ») ; `numero` est
 * le rang de l'equipe au sein du club, celui des parentheses de « R2 (1) ».
 * Les equipes jeunes n'ont pas de division renseignee.
 */
export const EquipeLocaleSchema = z.object({
  division: z.string().min(1).nullable(),
  numero: z.number().int().positive(),
});

export const AdversaireSchema = z.object({
  /** Identifiant canonique du club, cle de resolution du logo. */
  clubId: z.string().min(1),
  /** Numero d'equipe adverse, absent sur certaines rencontres jeunes. */
  numero: z.number().int().positive().nullable(),
  /**
   * Libelle tel qu'il doit s'imprimer. Redondant avec le registre des clubs,
   * mais volontairement stocke : un document exporte puis rouvert sur un autre
   * poste doit rester lisible meme si la bibliotheque de logos differe.
   */
  libelle: z.string().min(1),
});

export const RencontreSchema = z.object({
  id: z.string().min(1),
  equipeLocale: EquipeLocaleSchema,
  adversaire: AdversaireSchema,
});

/** Un creneau et un lieu, donc un bloc de l'affiche. */
export const GroupeSchema = z.object({
  id: z.string().min(1),
  creneau: CreneauSchema,
  domicile: z.boolean(),
  rencontres: z.array(RencontreSchema),
});

export const EmplacementSponsorSchema = z.object({
  sponsorId: z.string().min(1).nullable(),
  /** Un emplacement verrouille echappe au tirage et reste tel quel. */
  verrouille: z.boolean(),
});

/**
 * Selection des trois sponsors.
 *
 * L'ancien script tirait au hasard a chaque execution, a partir d'un parcours
 * de dossier dont l'ordre depend du systeme de fichiers : deux rendus de la
 * meme journee ne donnaient jamais la meme affiche. La graine rend le tirage
 * reproductible, condition necessaire a un apercu stable et a des tests.
 */
export const SelectionSponsorsSchema = z.object({
  graine: z.string().min(1),
  emplacements: z.tuple([
    EmplacementSponsorSchema,
    EmplacementSponsorSchema,
    EmplacementSponsorSchema,
  ]),
});

export const CategorieSchema = z.enum(['adultes', 'jeunes']);

export const AfficheSchema = z.object({
  id: z.string().min(1),
  categorie: CategorieSchema,
  groupes: z.array(GroupeSchema),
  sponsors: SelectionSponsorsSchema,
});

export const JourneeSchema = z.object({
  versionSchema: z.literal(VERSION_SCHEMA),
  id: z.string().min(1),
  numero: z.number().int().positive(),
  /** Saison sportive, « 2025-2026 ». Deduite de la date, jamais saisie. */
  saison: z.string().regex(/^\d{4}-\d{4}$/),
  affiches: z.array(AfficheSchema).min(1),
  creeLe: z.string(),
  majLe: z.string(),
});

export type Creneau = z.infer<typeof CreneauSchema>;
export type EquipeLocale = z.infer<typeof EquipeLocaleSchema>;
export type Adversaire = z.infer<typeof AdversaireSchema>;
export type Rencontre = z.infer<typeof RencontreSchema>;
export type Groupe = z.infer<typeof GroupeSchema>;
export type EmplacementSponsor = z.infer<typeof EmplacementSponsorSchema>;
export type SelectionSponsors = z.infer<typeof SelectionSponsorsSchema>;
export type Categorie = z.infer<typeof CategorieSchema>;
export type Affiche = z.infer<typeof AfficheSchema>;
export type Journee = z.infer<typeof JourneeSchema>;

/** Identifiants opaques. `crypto.randomUUID` est disponible partout ou tourne cette librairie. */
export function nouvelId(): string {
  return crypto.randomUUID();
}

export function emplacementsVides(): SelectionSponsors['emplacements'] {
  return [
    { sponsorId: null, verrouille: false },
    { sponsorId: null, verrouille: false },
    { sponsorId: null, verrouille: false },
  ];
}

/**
 * Graine par defaut d'une affiche : stable pour une journee donnee, donc deux
 * generations successives sortent les memes sponsors.
 */
export function graineParDefaut(numero: number, categorie: Categorie): string {
  return `j${numero}-${categorie}`;
}

export function creerAffiche(
  categorie: Categorie,
  numero: number,
  groupes: Groupe[] = [],
): Affiche {
  return {
    id: nouvelId(),
    categorie,
    groupes,
    sponsors: { graine: graineParDefaut(numero, categorie), emplacements: emplacementsVides() },
  };
}

/** Nombre total de rencontres d'une affiche, dont depend la variante de mise en page. */
export function compterRencontres(affiche: Affiche): number {
  return affiche.groupes.reduce((total, groupe) => total + groupe.rencontres.length, 0);
}

/**
 * Date du premier creneau d'une affiche, utilisee pour deduire la saison et
 * pour ordonner l'historique.
 */
export function premierCreneau(affiches: Affiche[]): string | null {
  const debuts = affiches
    .flatMap((a) => a.groupes)
    .map((g) => g.creneau.debutIso)
    .sort();
  return debuts[0] ?? null;
}

export function saisonDeJournee(affiches: Affiche[]): string | null {
  const premier = premierCreneau(affiches);
  return premier ? saisonDe(premier) : null;
}
