import { AfficheSchema, VERSION_SCHEMA, type Affiche } from '../model/journee';

/**
 * Relecture d'un document persiste.
 *
 * Le plan exige un DOUBLE VERSIONNEMENT : une version pour la structure de la
 * base, et un `versionSchema` par document accompagne d'une chaine de
 * migrations pures. La raison est precise : un document peut arriver par import
 * d'une sauvegarde, donc sans passer par le `upgrade` d'IndexedDB, qui ne voit
 * que les documents deja presents.
 *
 * Etat de la chaine aujourd'hui : une seule version persistee, la v3. La v2 n'a
 * jamais ete ecrite — elle n'a existe qu'en memoire — et la v1 n'est pas un
 * document mais un fichier d'import, traite par `migrerDepuisV1`.
 *
 * La fonction refuse donc tout le reste, avec un message qui dit quoi faire.
 * C'est volontaire : accepter un document d'une version inconnue reviendrait a
 * lui appliquer un schema qui n'est pas le sien, et a perdre en silence les
 * champs qu'il porte.
 */

export type Relecture = { type: 'ok'; affiche: Affiche } | { type: 'illisible'; raison: string };

export function relireDocument(brut: unknown): Relecture {
  if (typeof brut !== 'object' || brut === null) {
    return { type: 'illisible', raison: "Ce n'est pas un document." };
  }

  const version = (brut as { versionSchema?: unknown }).versionSchema;

  if (version === VERSION_SCHEMA) {
    const verdict = AfficheSchema.safeParse(brut);
    return verdict.success
      ? { type: 'ok', affiche: verdict.data }
      : {
          type: 'illisible',
          // Le premier probleme suffit a orienter : la liste complete est du
          // ressort de `problemesDe`, sur un document deja relu.
          raison: `Document v${VERSION_SCHEMA} invalide : ${verdict.error.issues[0]?.message ?? 'forme inattendue'}.`,
        };
  }

  if (typeof version === 'number' && version < VERSION_SCHEMA) {
    return {
      type: 'illisible',
      raison:
        `Document en version ${version}, trop ancien pour cette application ` +
        `(version ${VERSION_SCHEMA}). Aucune migration n'existe depuis cette version.`,
    };
  }

  if (typeof version === 'number') {
    return {
      type: 'illisible',
      raison:
        `Document en version ${version}, plus recent que cette application ` +
        `(version ${VERSION_SCHEMA}). Mettez l'application a jour.`,
    };
  }

  return { type: 'illisible', raison: 'Ce document ne porte pas de numero de version.' };
}
