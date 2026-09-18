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
    // Pas de boite de dialogue native dans jsdom : ces tests portent donc sur
    // la voie de recours, celle qui a pose tous les problemes.
    delete (window as unknown as Record<string, unknown>)['showSaveFilePicker'];
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

  it('porte le nom demande', async () => {
    const { lien, nettoyer } = await telechargerBlob(contenu, 'journee-01-adultes-2026-2027.png');
    expect(lien?.download).toBe('journee-01-adultes-2026-2027.png');
    nettoyer();
  });

  it('clique un lien QUI EST DANS le document', async () => {
    // Firefox ignore `download` sur un element detache : le fichier prend alors
    // le nom de l'URL blob.
    let attacheAuClic: boolean | undefined;
    const clicOrigine = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      attacheAuClic = document.body.contains(this);
    };
    try {
      (await telechargerBlob(contenu, 'essai.png')).nettoyer();
    } finally {
      HTMLAnchorElement.prototype.click = clicOrigine;
    }
    expect(attacheAuClic).toBe(true);
  });

  it('laisse le lien en place APRES le clic', async () => {
    // La cause qui a resiste le plus longtemps. Chrome demarre le
    // telechargement de facon asynchrone : un lien retire dans la foulee lui
    // fait perdre l'attribut `download`, et le fichier arrive nomme
    // « ac3633f8-6ac2-4d89-9ef7-29918a32b4d4 », sans extension.
    const { lien, nettoyer } = await telechargerBlob(contenu, 'essai.png');
    expect(document.body.contains(lien!)).toBe(true);
    nettoyer();
    expect(document.body.contains(lien!)).toBe(false);
  });

  it('ne libere pas l URL avant que le navigateur ait pu lire le blob', async () => {
    const { nettoyer } = await telechargerBlob(contenu, 'essai.png');
    expect(urls).toHaveLength(1);
    nettoyer();
    expect(urls).toHaveLength(0);
  });

  it('refuse un nom vide plutot que de livrer un fichier nomme par une URL', async () => {
    await expect(telechargerBlob(contenu, '')).rejects.toThrow(/vide/i);
  });

  it('supporte un nettoyage appele deux fois', async () => {
    // Le menage differe s'ajoute a l'appel explicite : la seconde fois ne doit
    // ni lever ni revoquer une URL qui ne nous appartient plus.
    const { nettoyer } = await telechargerBlob(contenu, 'essai.png');
    nettoyer();
    expect(() => nettoyer()).not.toThrow();
  });

  describe('boite de dialogue native', () => {
    it('la prefere quand elle existe, le nom y etant un parametre', async () => {
      // Sur cette voie le nom ne PEUT PAS se perdre : il est passe a l'API, et
      // non porte par un attribut que le navigateur choisit d'honorer ou non.
      const ecrits: { nom?: string; octets: number } = { octets: 0 };
      (window as unknown as Record<string, unknown>)['showSaveFilePicker'] = (options: {
        suggestedName?: string;
      }) => {
        ecrits.nom = options.suggestedName;
        return Promise.resolve({
          createWritable: () =>
            Promise.resolve({
              write: (donnees: Blob) => {
                ecrits.octets = donnees.size;
                return Promise.resolve();
              },
              close: () => Promise.resolve(),
            }),
        });
      };

      const resultat = await telechargerBlob(contenu, 'journee-03-jeunes-2026-2027.png');
      expect(resultat.voie).toBe('dialogue');
      expect(ecrits.nom).toBe('journee-03-jeunes-2026-2027.png');
      expect(ecrits.octets).toBe(3);
      // Et aucun lien n'a ete pose dans le document.
      expect(resultat.lien).toBeUndefined();
    });

    it('ne telecharge rien si l utilisateur ferme la boite', async () => {
      (window as unknown as Record<string, unknown>)['showSaveFilePicker'] = () => {
        const erreur = new Error('annule');
        erreur.name = 'AbortError';
        return Promise.reject(erreur);
      };

      const resultat = await telechargerBlob(contenu, 'essai.png');
      // Surtout pas de repli sur le lien : l'utilisateur a dit non.
      expect(resultat.voie).toBe('dialogue');
      expect(resultat.lien).toBeUndefined();
      expect(urls).toHaveLength(0);
    });

    it('retombe sur le lien si la boite echoue pour une autre raison', async () => {
      (window as unknown as Record<string, unknown>)['showSaveFilePicker'] = () =>
        Promise.reject(new Error('permission refusee'));

      const resultat = await telechargerBlob(contenu, 'essai.png');
      expect(resultat.voie).toBe('lien');
      expect(resultat.lien?.download).toBe('essai.png');
      resultat.nettoyer();
    });
  });
});
