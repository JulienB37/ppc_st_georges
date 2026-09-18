import { creneauValide } from '../format/creneau';
import {
  SAISON_INDETERMINEE,
  VERSION_SCHEMA,
  saisonDesGroupes,
  type Affiche,
  type Categorie,
  type Groupe,
  type Rencontre,
  type SelectionSponsors,
} from '../model/journee';

/**
 * Modele EDITABLE d'une affiche, et sa conversion vers le domaine.
 *
 * Les Signal Forms derivent la structure du formulaire du modele lui-meme et
 * lient chaque champ a un `<input>`. Or un `<input>` n'accepte ni `null` ni
 * `undefined`, et le domaine en porte trois :
 *
 *   - `equipeLocale.division` est `string | null` (les jeunes n'en ont pas) ;
 *   - `adversaire.numero` est `number | null` ;
 *   - `creneau.libelleOverride` est optionnel.
 *
 * Le modele editable les aplatit en chaine vide et en zero, puis la conversion
 * retablit `null` et l'absence. C'est la SEULE couche d'adaptation entre la
 * saisie et le domaine, et elle vit ici — TypeScript pur, testable dans Node —
 * plutot que dans l'application, ou elle aurait demande un banc de test
 * Angular pour la meme verification.
 *
 * Le creneau y est en outre scinde : le domaine stocke `2026-09-19T18:00`, la
 * saisie veut une date et une heure separees, pour deux champs natifs. La
 * recomposition ne passe JAMAIS par `new Date` — le format est local et sans
 * fuseau, et l'y faire entrer decalerait les creneaux d'un pays a l'autre.
 *
 * Tout ce qui n'est pas saisi — identifiants, sponsors, horodatages — traverse
 * le modele editable inchange, pour qu'un aller-retour ne perde rien.
 */

export interface RencontreEditable {
  id: string;
  /** Pastille de division. Vide = aucune, ce que le domaine note `null`. */
  division: string;
  /** Rang de l'equipe au sein du club. */
  numero: number;
  adversaireClubId: string;
  /** Numero de l'equipe adverse. Zero = aucun, ce que le domaine note `null`. */
  adversaireNumero: number;
  adversaireLibelle: string;
}

export interface GroupeEditable {
  id: string;
  /** `AAAA-MM-JJ`, pour un champ de date natif. */
  date: string;
  /** `hh:mm`, pour un champ d'heure natif. */
  heure: string;
  /** Libelle impose. Vide = libelle calcule depuis la date. */
  libelleOverride: string;
  domicile: boolean;
  rencontres: RencontreEditable[];
}

export interface AfficheEditable {
  id: string;
  /** Choisie a la creation et non modifiable ensuite : elle decide du document. */
  categorie: Categorie;
  /** Numero de journee, propre a cette affiche. */
  numero: number;
  groupes: GroupeEditable[];
  /** Non saisis : conserves pour l'aller-retour. */
  sponsors: SelectionSponsors;
  creeLe: string;
  majLe: string;
}

/** `2026-09-19T18:00` -> `{ date: '2026-09-19', heure: '18:00' }`. */
export function scinderCreneau(debutIso: string): { date: string; heure: string } {
  const [date = '', heure = ''] = debutIso.split('T');
  return { date, heure };
}

/** Recompose l'instant local. Aucune conversion de fuseau, par construction. */
export function joindreCreneau(date: string, heure: string): string {
  return `${date}T${heure}`;
}

export function versEditable(affiche: Affiche): AfficheEditable {
  return {
    id: affiche.id,
    categorie: affiche.categorie,
    numero: affiche.numero,
    sponsors: affiche.sponsors,
    creeLe: affiche.creeLe,
    majLe: affiche.majLe,
    groupes: affiche.groupes.map((groupe) => ({
      id: groupe.id,
      ...scinderCreneau(groupe.creneau.debutIso),
      libelleOverride: groupe.creneau.libelleOverride ?? '',
      domicile: groupe.domicile,
      rencontres: groupe.rencontres.map((rencontre) => ({
        id: rencontre.id,
        division: rencontre.equipeLocale.division ?? '',
        numero: rencontre.equipeLocale.numero,
        adversaireClubId: rencontre.adversaire.clubId,
        adversaireNumero: rencontre.adversaire.numero ?? 0,
        adversaireLibelle: rencontre.adversaire.libelle,
      })),
    })),
  };
}

/**
 * Convertit vers le domaine.
 *
 * La saison est RECALCULEE depuis le premier creneau plutot que reportee : elle
 * en decoule, et l'utilisateur ne la saisit pas. Une date corrigee doit donc
 * corriger la saison, ce qu'un report silencieux n'aurait pas fait.
 *
 * `majLe` est horodate par l'appelant et non ici : la librairie ne lit pas
 * l'horloge, pour que la conversion reste une fonction pure et donc testable
 * sans geler le temps.
 *
 * La conversion ne LEVE JAMAIS, meme sur une saisie incomplete. C'est la
 * validation du schema qui signale ce qui manque, et l'interface qui le
 * montre ; une exception ici empecherait d'afficher le formulaire a corriger.
 */
export function versDomaine(editable: AfficheEditable, majLe = editable.majLe): Affiche {
  const groupes: Groupe[] = editable.groupes.map((groupe) => ({
    id: groupe.id,
    creneau: {
      debutIso: joindreCreneau(groupe.date, groupe.heure),
      ...(groupe.libelleOverride ? { libelleOverride: groupe.libelleOverride } : {}),
    },
    domicile: groupe.domicile,
    rencontres: groupe.rencontres.map((rencontre): Rencontre => ({
      id: rencontre.id,
      equipeLocale: {
        division: rencontre.division || null,
        numero: rencontre.numero,
      },
      adversaire: {
        clubId: rencontre.adversaireClubId,
        numero: rencontre.adversaireNumero || null,
        libelle: rencontre.adversaireLibelle,
      },
    })),
  }));

  return {
    versionSchema: VERSION_SCHEMA,
    id: editable.id,
    categorie: editable.categorie,
    numero: editable.numero,
    // Seuls les creneaux COMPLETS servent a deduire la saison. Un formulaire en
    // cours de saisie porte des dates vides, et la conversion ne doit jamais
    // lever : sinon l'editeur ne peut pas afficher une affiche neuve, dont
    // aucune date n'est encore renseignee.
    saison: saisonDesGroupes(groupes) ?? SAISON_INDETERMINEE,
    groupes,
    sponsors: editable.sponsors,
    creeLe: editable.creeLe,
    majLe,
  };
}

/** Vrai si tous les creneaux portent une date et une heure exploitables. */
export function creneauxComplets(editable: AfficheEditable): boolean {
  return editable.groupes.every((g) => creneauValide(joindreCreneau(g.date, g.heure)));
}
