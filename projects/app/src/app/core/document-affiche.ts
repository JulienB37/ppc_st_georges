import { computed, Injectable, signal } from '@angular/core';
import {
  afficheVide,
  deplacer,
  equipeLibreDe,
  inserer,
  nouveauGroupe,
  nouvelleRencontre,
  problemesDe,
  remplacer,
  retirer,
  versDomaine,
  versEditable,
  type Affiche,
  type AfficheEditable,
  type Categorie,
  type Probleme,
} from 'poster-core';

/**
 * L'affiche en cours d'edition.
 *
 * Un document est UNE affiche : une categorie, un numero de journee, ses
 * creneaux. La categorie est choisie a la creation et ne change plus — les
 * championnats adultes et jeunes n'avancent pas a la meme journee, et les
 * saisir ensemble forcait a leur imposer un numero commun.
 *
 * Un signal et des methodes, sans NgRx : aucune des trois raisons d'exister de
 * NgRx n'est reunie ici — pas de synchronisation serveur, pas d'orchestration
 * asynchrone, pas d'etat partage entre features distantes.
 *
 * Le signal est expose en ECRITURE parce que `form()` ecrit dedans : c'est la
 * mecanique des Signal Forms, le formulaire et le modele partagent la meme
 * valeur. Les methodes servent aux mutations de structure — ajouter un creneau,
 * deplacer une rencontre — que le formulaire ne sait pas faire seul.
 *
 * Toutes delegues aux fonctions pures de `poster-core`, et toutes remplacent la
 * valeur au lieu de la modifier : muter un tableau en place ne changerait pas la
 * reference du signal, et rien ne se redessinerait.
 */
@Injectable({ providedIn: 'root' })
export class DocumentAffiche {
  /** Modele editable, partage avec le formulaire. */
  readonly affiche = signal<AfficheEditable>(afficheVide('adultes', 1, maintenant()));

  /**
   * Vue domaine du document.
   *
   * Recalculee a chaque frappe, et c'est voulu : c'est elle qui alimentera
   * l'apercu et le texte de publication, donc l'image et le texte viendront
   * toujours de la meme conversion. `versDomaine` ne leve jamais, meme sur une
   * saisie incomplete.
   */
  readonly domaine = computed<Affiche>(() => versDomaine(this.affiche()));

  /**
   * Ce qui manque pour que l'affiche soit publiable.
   *
   * Le schema zod reste la reference de validite, et non une liste de regles
   * recopiee dans le formulaire : une divergence entre les deux laisserait
   * passer un document que l'export refuserait ensuite. `problemesDe` se charge
   * d'en traduire les chemins techniques en phrases situees.
   */
  readonly problemes = computed<Probleme[]>(() => problemesDe(this.domaine()));

  readonly publiable = computed(() => this.problemes().length === 0);

  readonly nbRencontres = computed(() =>
    this.affiche().groupes.reduce((total, groupe) => total + groupe.rencontres.length, 0),
  );

  /** Reprend une affiche existante — import, historique, duplication. */
  ouvrir(affiche: Affiche): void {
    this.affiche.set(versEditable(affiche));
  }

  /**
   * Repart d'une affiche vierge.
   *
   * La categorie est un parametre et non une preference : c'est elle qui decide
   * du document, et elle ne se change pas ensuite.
   */
  commencer(categorie: Categorie, numero = 1): void {
    this.affiche.set(afficheVide(categorie, numero, maintenant()));
  }

  // --- Creneaux ----------------------------------------------------------

  ajouterGroupe(): void {
    this.affiche.update((a) => ({
      ...a,
      // Le nouveau creneau reprend la date du dernier : une journee se joue sur
      // un ou deux jours.
      groupes: inserer(a.groupes, nouveauGroupe(a.groupes.at(-1))),
    }));
  }

  retirerGroupe(index: number): void {
    this.affiche.update((a) => ({ ...a, groupes: retirer(a.groupes, index) }));
  }

  deplacerGroupe(de: number, vers: number): void {
    this.affiche.update((a) => ({ ...a, groupes: deplacer(a.groupes, de, vers) }));
  }

  // --- Rencontres --------------------------------------------------------

  ajouterRencontre(iGroupe: number): void {
    this.affiche.update((a) => ({
      ...a,
      groupes: remplacer(a.groupes, iGroupe, (groupe) => ({
        ...groupe,
        // L'equipe proposee est la premiere que la journee n'engage pas encore :
        // une equipe ne joue qu'une fois par journee.
        rencontres: inserer(groupe.rencontres, nouvelleRencontre(equipeLibreDe(a))),
      })),
    }));
  }

  retirerRencontre(iGroupe: number, iRencontre: number): void {
    this.majGroupe(iGroupe, (groupe) => ({
      ...groupe,
      rencontres: retirer(groupe.rencontres, iRencontre),
    }));
  }

  deplacerRencontre(iGroupe: number, de: number, vers: number): void {
    this.majGroupe(iGroupe, (groupe) => ({
      ...groupe,
      rencontres: deplacer(groupe.rencontres, de, vers),
    }));
  }

  private majGroupe(
    index: number,
    calculer: (groupe: AfficheEditable['groupes'][number]) => AfficheEditable['groupes'][number],
  ): void {
    this.affiche.update((a) => ({ ...a, groupes: remplacer(a.groupes, index, calculer) }));
  }
}

/** Horodatage ISO. Isole ici : la librairie de rendu, elle, ne lit pas l'horloge. */
function maintenant(): string {
  return new Date().toISOString();
}
