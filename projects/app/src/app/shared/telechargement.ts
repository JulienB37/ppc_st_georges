/**
 * Telecharge un fichier depuis le navigateur, par un lien clique.
 *
 * C'est le telechargement classique : le fichier part dans le dossier de
 * telechargements, sans boite de dialogue. Une version precedente passait par
 * `showSaveFilePicker` ; la boite « Enregistrer sous » a ete jugee de trop pour
 * un geste hebdomadaire, et elle n'existait de toute facon que sur Chrome et
 * Edge.
 *
 * Trois details decident si le nom survit, et les trois ont ete appris a la
 * dure, le fichier arrivant nomme d'apres l'URL blob : un identifiant sans
 * extension.
 *
 *   a. le lien doit etre DANS le document (Firefox ignore `download` sur un
 *      element detache) ;
 *   b. il doit y RESTER apres le clic (Chrome suit le lien de facon
 *      asynchrone : disparu, l'attribut est perdu) ;
 *   c. l'URL blob ne doit pas etre revoquee dans la foulee, pour la meme
 *      raison.
 *
 * Le menage est donc differe, et idempotent.
 */

export interface Telechargement {
  /** Le lien pose dans le document. */
  lien: HTMLAnchorElement;
  /** Retire le lien et libere l'URL. Appele automatiquement apres un delai. */
  nettoyer: () => void;
}

/** Delai avant menage. Large : un gros fichier met du temps a demarrer. */
const DELAI_MENAGE_MS = 60_000;

export function telechargerBlob(contenu: Blob, nom: string): Telechargement {
  if (!nom) {
    // Un nom vide ferait retomber le navigateur sur l'URL blob : mieux vaut le
    // dire que de livrer un fichier nomme par un identifiant.
    throw new Error('Nom de fichier vide : le telechargement serait mal nomme.');
  }

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

  return { lien, nettoyer };
}
