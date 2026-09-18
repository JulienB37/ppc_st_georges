import { decalerCreneau } from '../format/creneau';
import { graineParDefaut, nouvelId, saisonDesGroupes, type Affiche } from '../model/journee';
import { SAISON_INDETERMINEE } from '../model/journee';

/** Une journee de championnat se rejoue chaque semaine. */
const JOURS_PAR_JOURNEE = 7;

export interface OptionsDuplication {
  /** Rang de la nouvelle journee. Par defaut, le suivant. */
  numero?: number;
  /** Jours a ajouter a chaque creneau. Par defaut une semaine. */
  decalageJours?: number;
}

/**
 * Duplique une affiche pour la journee suivante.
 *
 * C'est le geste hebdomadaire du club : reprendre l'affiche precedente, avancer
 * d'une journee, corriger les adversaires. Tout le reste — equipes engagees,
 * horaires, lieux — se repete d'une semaine sur l'autre.
 *
 * Trois choses sont volontairement REMISES A ZERO :
 *
 * 1. Les identifiants, tous regeneres. Deux documents qui partageraient les
 *    memes rendraient toute recherche par identifiant ambigue.
 * 2. Le LIBELLE IMPOSE de chaque creneau. Il contient la date saisie a la main
 *    de la semaine passee — « Samedi 19 Septembre à 18h00 » — et la conserver
 *    ferait imprimer l'ancienne date sur la nouvelle affiche, alors meme que le
 *    creneau a ete decale. C'est le piege de cette fonction.
 * 3. La graine des sponsors, recalculee sur le nouveau numero, pour que la
 *    rotation avance au lieu de resservir les memes partenaires.
 *
 * Les emplacements VERROUILLES sont en revanche conserves : ce sont des choix
 * explicites de l'utilisateur, pas un effet du tirage.
 */
export function dupliquerAffiche(
  affiche: Affiche,
  maintenant: string,
  options: OptionsDuplication = {},
): Affiche {
  const numero = options.numero ?? affiche.numero + 1;
  const decalage = options.decalageJours ?? JOURS_PAR_JOURNEE;

  const groupes = affiche.groupes.map((groupe) => ({
    id: nouvelId(),
    creneau: { debutIso: decalerCreneau(groupe.creneau.debutIso, decalage) },
    domicile: groupe.domicile,
    rencontres: groupe.rencontres.map((rencontre) => ({
      ...rencontre,
      id: nouvelId(),
    })),
  }));

  return {
    versionSchema: affiche.versionSchema,
    id: nouvelId(),
    categorie: affiche.categorie,
    numero,
    saison: saisonDesGroupes(groupes) ?? SAISON_INDETERMINEE,
    groupes,
    sponsors: {
      graine: graineParDefaut(numero, affiche.categorie),
      emplacements: affiche.sponsors.emplacements,
    },
    creeLe: maintenant,
    majLe: maintenant,
  };
}
