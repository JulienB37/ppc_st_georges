import { TestBed } from '@angular/core/testing';

import { DocumentAffiche } from './document-affiche';

describe('DocumentAffiche', () => {
  let doc: DocumentAffiche;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    doc = TestBed.inject(DocumentAffiche);
  });

  it('demarre sur une affiche vierge, non publiable et sans lever', () => {
    // C'est l'etat au premier lancement : aucune date saisie. L'editeur doit
    // pouvoir s'afficher, et dire ce qui manque.
    expect(doc.affiche().groupes).toHaveLength(1);
    expect(doc.publiable()).toBe(false);
    // Et le probleme est enonce en clair, avec l'endroit ou regarder : c'est un
    // benevole qui le lit, pas un chemin zod.
    expect(doc.problemes()[0]).toMatchObject({
      ou: 'créneau 1',
      quoi: expect.stringMatching(/date/i),
    });
  });

  it('devient publiable une fois la saisie complete', () => {
    // Le chemin reel de l'utilisateur : une rencontre, une date, un adversaire.
    doc.ajouterRencontre(0);
    remplir(doc, { date: '2026-09-19', heure: '18:00', adversaire: 'US Chouzy TT' });
    expect(doc.problemes()).toEqual([]);
    expect(doc.publiable()).toBe(true);
  });

  it('deduit la saison de la date saisie', () => {
    doc.ajouterRencontre(0);
    remplir(doc, { date: '2030-10-04', heure: '18:00', adversaire: 'US Chouzy TT' });
    expect(doc.domaine().saison).toBe('2030-2031');
  });

  describe('structure', () => {
    it('ajoute un creneau en reprenant la date du precedent', () => {
      remplir(doc, { date: '2026-09-19', heure: '18:00', adversaire: '' });
      doc.ajouterGroupe();
      const groupes = doc.affiche().groupes;
      expect(groupes).toHaveLength(2);
      expect(groupes[1]!.date).toBe('2026-09-19');
    });

    it('numerote les equipes sans jamais repeter un rang', () => {
      doc.ajouterRencontre(0);
      doc.ajouterRencontre(0);
      doc.retirerRencontre(0, 0);
      doc.ajouterRencontre(0);
      const numeros = doc.affiche().groupes[0]!.rencontres.map((r) => r.numero);
      expect(new Set(numeros).size).toBe(numeros.length);
    });

    it('deplace une rencontre dans son creneau', () => {
      doc.ajouterRencontre(0);
      doc.ajouterRencontre(0);
      const avant = doc.affiche().groupes[0]!.rencontres.map((r) => r.id);
      doc.deplacerRencontre(0, 1, 0);
      const apres = doc.affiche().groupes[0]!.rencontres.map((r) => r.id);
      expect(apres).toEqual([avant[1], avant[0]]);
    });

    it('remplace la valeur du signal a chaque mutation', () => {
      // Les Signal Forms lisent le modele depuis ce signal : une mutation en
      // place ne changerait pas la reference, et la vue ne se redessinerait pas.
      const avant = doc.affiche();
      doc.ajouterGroupe();
      expect(doc.affiche()).not.toBe(avant);
      expect(avant.groupes).toHaveLength(1);
    });

    it('relance le tirage des partenaires sans le rendre imprevisible', () => {
      // La graine est incrementee, pas tiree au hasard : deux rendus de la
      // meme affiche doivent montrer les memes partenaires, sans quoi l'apercu
      // papilloterait et rien ne serait reproductible.
      const avant = doc.affiche().sponsors.graine;
      doc.relancerSponsors();
      expect(doc.affiche().sponsors.graine).not.toBe(avant);
      doc.relancerSponsors();
      // Deterministe : la meme suite d'actions redonne la meme graine.
      expect(doc.affiche().sponsors.graine).toBe('j1-adultes-3');
    });

    it('repart d une affiche vierge dans la categorie choisie', () => {
      // La categorie decide du document : elle est choisie a la creation et ne
      // se change pas ensuite, les deux championnats n'etant pas a la meme
      // journee.
      doc.commencer('jeunes', 8);
      expect(doc.affiche().categorie).toBe('jeunes');
      expect(doc.affiche().numero).toBe(8);
      expect(doc.affiche().sponsors.graine).toBe('j8-jeunes');
    });
  });
});

/**
 * Remplit tous les creneaux et rencontres, comme le ferait la saisie.
 *
 * Les Signal Forms ecrivent dans le meme signal que le service : un test peut
 * donc simuler la frappe en posant les valeurs, sans monter de composant.
 */
function remplir(
  doc: DocumentAffiche,
  valeurs: { date: string; heure: string; adversaire: string },
): void {
  doc.affiche.update((affiche) => ({
    ...affiche,
    groupes: affiche.groupes.map((groupe) => ({
      ...groupe,
      date: valeurs.date,
      heure: valeurs.heure,
      rencontres: groupe.rencontres.map((rencontre) => ({
        ...rencontre,
        adversaireClubId: 'us-chouzy-tt',
        adversaireLibelle: valeurs.adversaire || rencontre.adversaireLibelle,
      })),
    })),
  }));
}
