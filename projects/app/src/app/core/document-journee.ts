import { computed, Injectable, signal } from '@angular/core';
import {
  deplacer,
  inserer,
  journeeVide,
  nouveauGroupe,
  nouvelleAffiche,
  nouvelleRencontre,
  prochainNumeroEquipe,
  problemesDe,
  remplacer,
  retirer,
  versDomaine,
  versEditable,
  type Categorie,
  type Journee,
  type JourneeEditable,
  type Probleme,
} from 'poster-core';

/**
 * Le document en cours d'edition.
 *
 * Un signal et des methodes, sans NgRx : aucune des trois raisons d'exister de
 * NgRx n'est reunie ici — pas de synchronisation serveur, pas d'orchestration
 * asynchrone, pas d'etat partage entre features distantes. Il y a un document
 * et deux catalogues.
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
export class DocumentJournee {
  /** Modele editable, partage avec le formulaire. */
  readonly journee = signal<JourneeEditable>(journeeVide(1, maintenant()));

  /**
   * Vue domaine du document.
   *
   * Recalculee a chaque frappe, et c'est voulu : c'est elle qui alimentera
   * l'apercu et le texte de publication, donc l'image et le texte viendront
   * toujours de la meme conversion. `versDomaine` ne leve jamais, meme sur une
   * saisie incomplete.
   */
  readonly domaine = computed<Journee>(() => versDomaine(this.journee()));

  /**
   * Ce qui manque pour que le document soit publiable.
   *
   * Le schema zod reste la reference de validite, et non une liste de regles
   * recopiee dans le formulaire : une divergence entre les deux laisserait
   * passer un document que l'export refuserait ensuite. `problemesDe` se charge
   * d'en traduire les chemins techniques en phrases situees.
   */
  readonly problemes = computed<Probleme[]>(() => problemesDe(this.domaine()));

  readonly publiable = computed(() => this.problemes().length === 0);

  /** Reprend un document existant — import, historique, duplication. */
  ouvrir(journee: Journee): void {
    this.journee.set(versEditable(journee));
  }

  recommencer(numero = 1): void {
    this.journee.set(journeeVide(numero, maintenant()));
  }

  // --- Affiches ----------------------------------------------------------

  ajouterAffiche(categorie: Categorie): void {
    this.journee.update((j) => ({
      ...j,
      affiches: inserer(j.affiches, nouvelleAffiche(categorie, j.numero)),
    }));
  }

  retirerAffiche(index: number): void {
    this.journee.update((j) => ({ ...j, affiches: retirer(j.affiches, index) }));
  }

  // --- Creneaux ----------------------------------------------------------

  ajouterGroupe(iAffiche: number): void {
    this.journee.update((j) => ({
      ...j,
      affiches: remplacer(j.affiches, iAffiche, (affiche) => ({
        ...affiche,
        // Le nouveau creneau reprend la date du dernier : une journee se joue
        // sur un ou deux jours.
        groupes: inserer(affiche.groupes, nouveauGroupe(affiche.groupes.at(-1))),
      })),
    }));
  }

  retirerGroupe(iAffiche: number, iGroupe: number): void {
    this.majAffiche(iAffiche, (affiche) => ({
      ...affiche,
      groupes: retirer(affiche.groupes, iGroupe),
    }));
  }

  deplacerGroupe(iAffiche: number, de: number, vers: number): void {
    this.majAffiche(iAffiche, (affiche) => ({
      ...affiche,
      groupes: deplacer(affiche.groupes, de, vers),
    }));
  }

  // --- Rencontres --------------------------------------------------------

  ajouterRencontre(iAffiche: number, iGroupe: number): void {
    this.majAffiche(iAffiche, (affiche) => ({
      ...affiche,
      groupes: remplacer(affiche.groupes, iGroupe, (groupe) => ({
        ...groupe,
        rencontres: inserer(groupe.rencontres, nouvelleRencontre(prochainNumeroEquipe(affiche))),
      })),
    }));
  }

  retirerRencontre(iAffiche: number, iGroupe: number, iRencontre: number): void {
    this.majGroupe(iAffiche, iGroupe, (groupe) => ({
      ...groupe,
      rencontres: retirer(groupe.rencontres, iRencontre),
    }));
  }

  deplacerRencontre(iAffiche: number, iGroupe: number, de: number, vers: number): void {
    this.majGroupe(iAffiche, iGroupe, (groupe) => ({
      ...groupe,
      rencontres: deplacer(groupe.rencontres, de, vers),
    }));
  }

  // --- Plomberie ---------------------------------------------------------

  private majAffiche(
    index: number,
    calculer: (affiche: JourneeEditable['affiches'][number]) => JourneeEditable['affiches'][number],
  ): void {
    this.journee.update((j) => ({ ...j, affiches: remplacer(j.affiches, index, calculer) }));
  }

  private majGroupe(
    iAffiche: number,
    iGroupe: number,
    calculer: (
      groupe: JourneeEditable['affiches'][number]['groupes'][number],
    ) => JourneeEditable['affiches'][number]['groupes'][number],
  ): void {
    this.majAffiche(iAffiche, (affiche) => ({
      ...affiche,
      groupes: remplacer(affiche.groupes, iGroupe, calculer),
    }));
  }
}

/** Horodatage ISO. Isole ici : la librairie de rendu, elle, ne lit pas l'horloge. */
function maintenant(): string {
  return new Date().toISOString();
}
