import { urlAsset } from './url-asset';

/**
 * Le deploiement sous un sous-chemin est le seul cas qui compte ici.
 *
 * En developpement l'application est servie a la racine, ou toutes les
 * ecritures marchent : un chemin absolu, un chemin relatif, n'importe quoi.
 * C'est sur GitHub Pages, sous `/ppc_st_georges/`, que la difference se voit —
 * et la, un chemin absolu livre un site sans police ni logo.
 *
 * Ces tests posent donc un `<base href>` et verifient la resolution, y compris
 * depuis une route profonde, qui est le piege du chemin relatif nu.
 */
describe('urlAsset', () => {
  let base: HTMLBaseElement | undefined;

  afterEach(() => {
    base?.remove();
    base = undefined;
  });

  function poserBase(href: string): void {
    base = document.createElement('base');
    base.href = href;
    document.head.prepend(base);
  }

  /** L'origine de jsdom : `pushState` refuse toute autre. */
  const ORIGINE = location.origin;

  it('resout contre la base du document', () => {
    poserBase('https://julienb37.github.io/ppc_st_georges/');
    expect(urlAsset('assets/fonts/Anton-400.woff2')).toBe(
      'https://julienb37.github.io/ppc_st_georges/assets/fonts/Anton-400.woff2',
    );
  });

  it('ignore la route courante', () => {
    // Le coeur du probleme : la meme URL d'asset, quelle que soit la
    // profondeur de la route. Un `fetch('assets/x')` se lirait comme s'il en
    // dependait.
    poserBase(`${ORIGINE}/ppc_st_georges/`);
    const attendu = `${ORIGINE}/ppc_st_georges/assets/clubs/logo.png`;

    history.pushState({}, '', '/ppc_st_georges/');
    expect(urlAsset('assets/clubs/logo.png')).toBe(attendu);

    history.pushState({}, '', '/ppc_st_georges/affiche/adultes');
    expect(urlAsset('assets/clubs/logo.png')).toBe(attendu);
  });

  it('fonctionne aussi a la racine, comme en developpement', () => {
    poserBase('http://localhost:4200/');
    expect(urlAsset('assets/resvg/index_bg.wasm')).toBe(
      'http://localhost:4200/assets/resvg/index_bg.wasm',
    );
  });
});
