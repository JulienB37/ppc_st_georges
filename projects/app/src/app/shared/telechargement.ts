/**
 * Enregistre un fichier depuis le navigateur.
 *
 * DEUX voies, et la premiere existe parce que la seconde s'est revelee fragile.
 *
 * 1. `showSaveFilePicker` — la boite de dialogue native. Le nom propose y est
 *    un parametre de l'API : il ne peut pas se perdre, et l'utilisateur choisit
 *    ou va son affiche. C'est aussi ce que le plan prevoyait cote bureau.
 *    Disponible sur Chrome et Edge, absente de Firefox et Safari.
 *
 * 2. Le lien clique — le recours universel. Trois details y decident si le nom
 *    survit, et les trois ont ete appris a la dure, le fichier arrivant nomme
 *    d'apres l'URL blob : un identifiant sans extension.
 *
 *      a. le lien doit etre DANS le document (Firefox ignore `download` sur un
 *         element detache) ;
 *      b. il doit y RESTER apres le clic (Chrome suit le lien de facon
 *         asynchrone : disparu, l'attribut est perdu) ;
 *      c. l'URL blob ne doit pas etre revoquee dans la foulee, pour la meme
 *         raison.
 *
 * Le menage est donc differe, et idempotent.
 */

export type VoieTelechargement = 'dialogue' | 'lien';

export interface Telechargement {
  /** Voie effectivement empruntee, pour que l'appelant puisse le dire. */
  voie: VoieTelechargement;
  /** Le lien pose dans le document, si c'est la voie de recours. */
  lien?: HTMLAnchorElement;
  /** Retire le lien et libere l'URL. Appele automatiquement apres un delai. */
  nettoyer: () => void;
}

/** Delai avant menage. Large : un gros fichier met du temps a demarrer. */
const DELAI_MENAGE_MS = 60_000;

interface FenetreAvecDialogue {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (donnees: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

export async function telechargerBlob(
  contenu: Blob,
  nom: string,
  extensions: string[] = ['.png'],
): Promise<Telechargement> {
  if (!nom) {
    // Un nom vide ferait retomber le navigateur sur l'URL blob : mieux vaut le
    // dire que de livrer un fichier nomme par un identifiant.
    throw new Error('Nom de fichier vide : le telechargement serait mal nomme.');
  }

  const dialogue = (window as unknown as FenetreAvecDialogue).showSaveFilePicker;
  if (dialogue) {
    try {
      const fichier = await dialogue({
        suggestedName: nom,
        types: [{ description: 'Affiche', accept: { [contenu.type || 'image/png']: extensions } }],
      });
      const flux = await fichier.createWritable();
      await flux.write(contenu);
      await flux.close();
      return { voie: 'dialogue', nettoyer: () => undefined };
    } catch (erreur) {
      // L'utilisateur a ferme la boite : ce n'est pas une panne, et il ne faut
      // surtout pas enchainer sur un telechargement qu'il n'a pas demande.
      if (erreur instanceof Error && erreur.name === 'AbortError') {
        return { voie: 'dialogue', nettoyer: () => undefined };
      }
      // Tout autre echec — permission refusee, API restreinte — retombe sur le
      // lien plutot que de laisser l'utilisateur sans fichier.
    }
  }

  return parLien(contenu, nom);
}

function parLien(contenu: Blob, nom: string): Telechargement {
  const url = URL.createObjectURL(contenu);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.style.display = 'none';
  document.body.appendChild(lien);
  lien.click();

  let fait = false;
  const nettoyer = () => {
    if (fait) return;
    fait = true;
    lien.remove();
    URL.revokeObjectURL(url);
  };
  setTimeout(nettoyer, DELAI_MENAGE_MS);

  return { voie: 'lien', lien, nettoyer };
}
