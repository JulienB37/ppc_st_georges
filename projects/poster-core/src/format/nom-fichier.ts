import type { Affiche } from '../model/journee';

/**
 * Nom du fichier exporte.
 *
 * Il porte les trois choses qui distinguent une affiche d'une autre : le rang
 * de la journee, le championnat, et la saison. Sans la saison, deux fichiers de
 * la journee 3 se recouvriraient a un an d'intervalle.
 *
 * Le numero est COMPLETE A DEUX CHIFFRES, et ce n'est pas cosmetique : un
 * dossier trie par nom range sinon « journee-1, journee-10, journee-11,
 * journee-2 ». L'utilisateur telecharge une affiche par semaine dans le meme
 * dossier pendant une saison entiere.
 *
 * La saison vient en dernier, pour respecter l'ordre demande. La mettre en tete
 * grouperait les saisons entre elles ; dites-le si les archives s'accumulent.
 */
export function nomFichierAffiche(affiche: Affiche, extension: string): string {
  const rang = String(affiche.numero).padStart(2, '0');
  return `journee-${rang}-${affiche.categorie}-${affiche.saison}.${extension}`;
}
