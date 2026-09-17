/**
 * Declenche l'enregistrement d'un fichier par le navigateur.
 *
 * Il n'existe pas d'API pour cela : on fabrique un lien et on le clique. Trois
 * details decident si le fichier garde son nom, et les trois ont ete appris a
 * la dure — le fichier arrivait nomme d'apres l'URL blob, un identifiant sans
 * extension.
 *
 * 1. Le lien doit etre DANS le document. Firefox ignore l'attribut `download`
 *    d'un element detache.
 * 2. Il doit y RESTER apres le clic. Chrome demarre le telechargement de facon
 *    asynchrone : si l'element a disparu entre-temps, l'attribut `download` est
 *    perdu et le nom vient de l'URL. C'est la cause qui a resiste le plus
 *    longtemps.
 * 3. L'URL blob ne doit pas etre revoquee dans la foulee, pour la meme raison :
 *    au moment du clic, rien n'a encore ete lu.
 *
 * Le menage est donc differe. La fonction rend le nettoyage pour que les tests
 * puissent l'appeler sans attendre.
 */
export interface Telechargement {
  /** Le lien pose dans le document, le temps que le navigateur le suive. */
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
