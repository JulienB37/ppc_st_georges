import { TestBed } from '@angular/core/testing';

import { CatalogueClubs } from './catalogue-clubs';

describe('CatalogueClubs', () => {
  let catalogue: CatalogueClubs;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    catalogue = TestBed.inject(CatalogueClubs);
  });

  it('exclut le club hote de ses propres adversaires', () => {
    // On ne se rencontre pas soi-meme : le proposer serait une erreur possible
    // a chaque saisie.
    expect(catalogue.chercher('st georges', 30).map((c) => c.id)).not.toContain(
      'pp-st-georgescher',
    );
    expect(catalogue.parId('pp-st-georgescher')).toBeUndefined();
  });

  it('propose tout le catalogue sur une saisie vide, par ordre alphabetique', () => {
    const tous = catalogue.chercher('', 50);
    expect(tous.length).toBeGreaterThan(20);
    const libelles = tous.map((c) => c.libelle);
    expect(libelles).toEqual([...libelles].sort((a, b) => a.localeCompare(b, 'fr')));
  });

  it('classe par prefixe de jetons et non par simple ressemblance', () => {
    expect(catalogue.chercher('bloi')[0]?.libelle).toMatch(/Blois/);
  });

  it("n'applique jamais un rapprochement approximatif", () => {
    // La regle du domaine : une suggestion doit etre choisie, pas subie. Un
    // libelle voisin ne doit donc pas designer un club a lui seul.
    expect(catalogue.parLibelle('Blois Pin')).toBeUndefined();
    expect(catalogue.parLibelle('Blois Ping 41')?.id).toBe('blois-ping-41');
  });

  it('donne une vignette resolue contre la base du document', () => {
    // Et non un chemin absolu depuis la racine du domaine : l'application est
    // servie sous un sous-chemin sur GitHub Pages, ou `/assets/...` ne mene a
    // rien. Voir `urlAsset`.
    const club = catalogue.parLibelle('Blois Ping 41')!;
    expect(catalogue.vignette(club)).toBe(
      new URL(`assets/clubs/${club.fichier}`, document.baseURI).href,
    );
    expect(catalogue.vignette(club).startsWith('/')).toBe(false);
  });
});
