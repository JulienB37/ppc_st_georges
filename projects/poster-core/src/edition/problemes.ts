import { JourneeSchema, type Journee } from '../model/journee';

/**
 * Traduction des problemes du document en phrases lisibles.
 *
 * Le schema zod reste l'unique reference de validite — recopier ses regles
 * dans le formulaire laisserait passer un document que l'export refuserait
 * ensuite. Mais ses messages designent un chemin technique :
 * `affiches.0.groupes.0.creneau.debutIso`. Un benevole ne sait pas ou regarder.
 *
 * Cette fonction retourne donc, pour chaque probleme, une phrase situee — « 1er
 * creneau de l'affiche adultes » — et conserve le chemin brut, dont
 * l'interface se sert pour porter le regard sur le bon champ.
 */

export interface Probleme {
  /** Chemin zod d'origine, pour cibler le champ fautif. */
  chemin: (string | number)[];
  /** Ou se situe le probleme, en clair. Vide si le document entier est vise. */
  ou: string;
  /** Ce qu'il faut faire. */
  quoi: string;
}

export function problemesDe(journee: Journee): Probleme[] {
  const verdict = JourneeSchema.safeParse(journee);
  if (verdict.success) return [];

  // Deux problemes peuvent viser le meme champ — un creneau incomplet fait
  // echouer `debutIso` ET `saison`. On ne garde qu'une phrase par endroit.
  const vus = new Set<string>();
  const problemes: Probleme[] = [];
  for (const issue of verdict.error.issues) {
    const probleme = traduire(journee, issue.path as (string | number)[], issue.message);
    const cle = `${probleme.ou}|${probleme.quoi}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    problemes.push(probleme);
  }
  return problemes;
}

function traduire(journee: Journee, chemin: (string | number)[], message: string): Probleme {
  const ou = situer(journee, chemin);
  const feuille = chemin[chemin.length - 1];

  if (chemin[0] === 'numero') {
    return { chemin, ou: '', quoi: 'Le numero de journee doit etre au moins 1.' };
  }
  if (chemin[0] === 'saison') {
    return {
      chemin,
      ou: '',
      quoi: 'La saison se deduit des dates : renseignez au moins un creneau.',
    };
  }
  if (chemin.length === 1 && chemin[0] === 'affiches') {
    return { chemin, ou: '', quoi: 'Il faut au moins une affiche.' };
  }
  if (feuille === 'debutIso') {
    return { chemin, ou, quoi: 'La date ou l’heure manque.' };
  }
  if (feuille === 'libelle') {
    return { chemin, ou, quoi: 'L’equipe adverse n’est pas nommee.' };
  }
  if (feuille === 'clubId') {
    return { chemin, ou, quoi: 'Le club adverse n’est pas choisi.' };
  }
  if (feuille === 'numero') {
    return { chemin, ou, quoi: 'Le numero d’equipe doit etre au moins 1.' };
  }

  // Repli : la phrase reste situee, et le message du schema est repris tel
  // quel plutot que masque — mieux vaut un message technique qu'aucun.
  return { chemin, ou, quoi: message };
}

/** Situe un chemin zod dans le document, en termes que l'utilisateur reconnait. */
function situer(journee: Journee, chemin: (string | number)[]): string {
  const morceaux: string[] = [];

  if (chemin[0] === 'affiches' && typeof chemin[1] === 'number') {
    const affiche = journee.affiches[chemin[1]];
    morceaux.push(`affiche ${affiche?.categorie ?? chemin[1] + 1}`);

    if (chemin[2] === 'groupes' && typeof chemin[3] === 'number') {
      morceaux.push(`creneau ${chemin[3] + 1}`);

      if (chemin[4] === 'rencontres' && typeof chemin[5] === 'number') {
        morceaux.push(`rencontre ${chemin[5] + 1}`);
      }
    }
  }

  return morceaux.join(' · ');
}
