import { telechargerBlob } from './telechargement';

/**
 * Le nom du fichier telecharge se perdait, et aucun test ne le voyait.
 *
 * Trois causes se sont succede, toutes dans la plomberie DOM du declenchement.
 * Une verification par pilotage de navigateur ne les attrapait pas : son
 * gestionnaire de telechargement ne depend pas de l'ancrage. Elles sont en
 * revanche toutes observables dans jsdom, a condition de regarder l'etat du
 * document AU MOMENT du clic — ce que ces tests font.
 */
describe('telechargerBlob', () => {
  const contenu = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  let urls: string[];

  beforeEach(() => {
    urls = [];
    // jsdom ne fournit pas les URL d'objet : on les simule pour pouvoir
    // verifier qu'aucune n'est liberee trop tot.
    URL.createObjectURL = (() => {
      const url = `blob:essai/${urls.length}`;
      urls.push(url);
      return url;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = ((url: string) => {
      urls = urls.filter((u) => u !== url);
    }) as typeof URL.revokeObjectURL;
  });

  it('porte le nom demande', () => {
    const { lien, nettoyer } = telechargerBlob(contenu, 'journee-01-adultes-2026-2027.png');
    expect(lien.download).toBe('journee-01-adultes-2026-2027.png');
    nettoyer();
  });

  it('clique un lien QUI EST DANS le document', () => {
    // Firefox ignore `download` sur un element detache : le fichier prend alors
    // le nom de l'URL blob.
    let attacheAuClic: boolean | undefined;
    const clicOrigine = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      attacheAuClic = document.body.contains(this);
    };
    try {
      telechargerBlob(contenu, 'essai.png').nettoyer();
    } finally {
      HTMLAnchorElement.prototype.click = clicOrigine;
    }
    expect(attacheAuClic).toBe(true);
  });

  it('laisse le lien en place APRES le clic', () => {
    // La cause qui a resiste le plus longtemps. Chrome demarre le
    // telechargement de facon asynchrone : un lien retire dans la foulee lui
    // fait perdre l'attribut `download`, et le fichier arrive nomme
    // « ac3633f8-6ac2-4d89-9ef7-29918a32b4d4 », sans extension.
    const { lien, nettoyer } = telechargerBlob(contenu, 'essai.png');
    expect(document.body.contains(lien)).toBe(true);
    nettoyer();
    expect(document.body.contains(lien)).toBe(false);
  });

  it('ne libere pas l URL avant que le navigateur ait pu lire le blob', () => {
    const { nettoyer } = telechargerBlob(contenu, 'essai.png');
    expect(urls).toHaveLength(1);
    nettoyer();
    expect(urls).toHaveLength(0);
  });

  it('refuse un nom vide plutot que de livrer un fichier nomme par une URL', () => {
    expect(() => telechargerBlob(contenu, '')).toThrow(/vide/i);
  });

  it('supporte un nettoyage appele deux fois', () => {
    // Le menage differe s'ajoute a l'appel explicite : la seconde fois ne doit
    // ni lever ni revoquer une URL qui ne nous appartient plus.
    const { nettoyer } = telechargerBlob(contenu, 'essai.png');
    nettoyer();
    expect(() => nettoyer()).not.toThrow();
  });
});
