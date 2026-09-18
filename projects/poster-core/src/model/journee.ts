import { z } from 'zod';

import { creneauValide, saisonDe } from '../format/creneau';

/**
 * Modele de document v3.
 *
 * Un document EST une affiche : une categorie, un numero de journee, ses
 * creneaux. La v2 enveloppait plusieurs affiches dans une « journee » portant
 * un numero unique, ce qui etait faux — le championnat adultes et le
 * championnat jeunes ne sont pas a la meme journee. La configuration
 * historique du club le montrait deja : adultes en journee 1, jeunes en
 * journee 8. L'importateur v1 devait choisir, et avertissait qu'il jetait
 * l'autre numero.
 *
 * Aucune migration v2 -> v3 n'accompagne ce changement, et c'est verifiable :
 * la v2 n'a jamais ete persistee. Elle n'a existe qu'en memoire, la
 * sauvegarde etant prevue au lot 6. Il n'existe donc aucun document v2 a
 * migrer, et l'importateur v1 rend directement du v3.
 *
 * Quatre ruptures avec le format historique (`legacy/journee_config.json`),
 * chacune corrigeant un defaut de conception :
 *
 * 1. Une affiche par document, avec son propre numero de journee.
 * 2. Les affiches adultes et jeunes partagent la meme forme. L'ancienne
 *    section `enfant` etait figee a exactement deux rencontres
 *    (`matche_1` / `matche_2`), ce qui rendait toute troisieme rencontre
 *    impossible a saisir et dupliquait le code de dessin.
 * 3. L'adversaire porte un identifiant de club et un numero d'equipe separes,
 *    la ou une chaine libre obligeait le moteur de rendu a deviner le club par
 *    expression reguliere au moment de dessiner.
 * 4. La date est un instant, plus une chaine saisie a la main. Le libelle
 *    imprime en est calcule, ce qui supprime « Samedi 09 Mai » et consorts.
 */
export const VERSION_SCHEMA = 3;

/** Un instant local, sans fuseau : `2026-09-19T18:00`. */
export const CreneauSchema = z.object({
  debutIso: z
    .string()
    .refine(creneauValide, { message: 'Creneau attendu au format AAAA-MM-JJThh:mm' }),
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

/**
 * Un creneau et un lieu, donc un bloc de l'affiche.
 *
 * Au moins une rencontre : un creneau vide imprimerait une bande de date sous
 * laquelle il n'y a rien a lire. Rien ne l'interdisait, et une affiche sans
 * aucune rencontre se laissait donc enregistrer et exporter — un panneau noir
 * avec une date.
 */
export const GroupeSchema = z.object({
  id: z.string().min(1),
  creneau: CreneauSchema,
  domicile: z.boolean(),
  rencontres: z.array(RencontreSchema).min(1),
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
  versionSchema: z.literal(VERSION_SCHEMA),
  id: z.string().min(1),
  categorie: CategorieSchema,
  /**
   * Numero de journee, propre a cette affiche.
   *
   * Il vit ici et non au-dessus : les championnats adultes et jeunes
   * n'avancent pas au meme rythme.
   */
  numero: z.number().int().positive(),
  /** Saison sportive, « 2025-2026 ». Deduite de la date, jamais saisie. */
  saison: z.string().regex(/^\d{4}-\d{4}$/),
  groupes: z.array(GroupeSchema),
  sponsors: SelectionSponsorsSchema,
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

/**
 * Cree une affiche vierge.
 *
 * `maintenant` est passe par l'appelant : la librairie ne lit pas l'horloge,
 * pour que ses fonctions restent pures et testables sans geler le temps.
 */
export function creerAffiche(
  categorie: Categorie,
  numero: number,
  maintenant: string,
  groupes: Groupe[] = [],
): Affiche {
  return {
    versionSchema: VERSION_SCHEMA,
    id: nouvelId(),
    categorie,
    numero,
    saison: saisonDesGroupes(groupes) ?? SAISON_INDETERMINEE,
    groupes,
    sponsors: { graine: graineParDefaut(numero, categorie), emplacements: emplacementsVides() },
    creeLe: maintenant,
    majLe: maintenant,
  };
}

/**
 * Saison de repli, le temps qu'une date soit saisie.
 *
 * Volontairement absurde et non « l'annee en cours » : elle doit se remarquer
 * si elle atteignait une affiche, la librairie ne lisant de toute facon pas
 * l'horloge.
 */
export const SAISON_INDETERMINEE = '0000-0000';

/** Nombre total de rencontres, dont depend la variante de mise en page. */
export function compterRencontres(affiche: Affiche): number {
  return affiche.groupes.reduce((total, groupe) => total + groupe.rencontres.length, 0);
}

/**
 * Date du premier creneau, utilisee pour deduire la saison et pour ordonner
 * l'historique.
 *
 * Les creneaux INCOMPLETS sont ignores : un formulaire en cours de saisie porte
 * des dates vides, et il ne faut pas qu'elles empechent d'en deduire la saison.
 */
export function premierCreneau(groupes: readonly Groupe[]): string | null {
  const debuts = groupes
    .map((g) => g.creneau.debutIso)
    .filter(creneauValide)
    .sort();
  return debuts[0] ?? null;
}

export function saisonDesGroupes(groupes: readonly Groupe[]): string | null {
  const premier = premierCreneau(groupes);
  return premier ? saisonDe(premier) : null;
}
