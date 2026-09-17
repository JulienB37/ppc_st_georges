import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CatalogueClubs } from '../../core/catalogue-clubs';
import { Icone } from '../../shared/icone';
import { FormField, type FieldTree } from '@angular/forms/signals';
import {
  clubIdDepuisLibelle,
  equipeParDivision,
  formatCreneau,
  optionsDivision,
  type EntreeClub,
  type GroupeEditable,
  type RencontreEditable,
} from 'poster-core';

/**
 * Un creneau et ses rencontres.
 *
 * Le composant recoit une BRANCHE du formulaire, pas une copie des donnees :
 * `FieldTree<GroupeEditable>` porte a la fois la valeur et son etat de
 * validation. Il n'y a donc rien a remonter au parent quand un champ change —
 * seules les mutations de structure, que le composant demande par ses sorties.
 */
@Component({
  selector: 'ppc-creneau-editeur',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    Icone,
  ],
  templateUrl: './creneau-editeur.html',
  styleUrl: './creneau-editeur.scss',
})
export class CreneauEditeur {
  protected readonly catalogue = inject(CatalogueClubs);

  readonly champs = input.required<FieldTree<GroupeEditable>>();
  /** Rang affiche, et bornes pour griser les fleches de deplacement. */
  readonly index = input.required<number>();
  readonly dernier = input.required<boolean>();

  readonly ajouterRencontre = output<void>();
  readonly retirerRencontre = output<number>();
  readonly deplacerRencontre = output<{ de: number; vers: number }>();
  readonly retirer = output<void>();
  readonly deplacer = output<number>();

  /**
   * Equipes proposees pour une rencontre.
   *
   * La valeur enregistree en fait partie meme si elle n'est plus dans la table
   * du club : un document importe peut porter « PR » ou un second « D3 », venus
   * de la configuration historique, et les effacer en silence perdrait une
   * donnee que l'utilisateur n'a pas demande a changer.
   */
  protected options(division: string) {
    return optionsDivision(division);
  }

  /**
   * Un seul champ pour la division ET le rang de l'equipe.
   *
   * Les deux ne sont pas independants : l'equipe 1 joue en R2, la 2 en R3. Les
   * saisir separement, comme le faisait l'ancien script, permettait « D2 (3) »,
   * une combinaison qui n'existe pas, et obligeait a retaper un numero que la
   * division determine deja.
   *
   * Une etiquette inconnue de la table laisse le numero en place : elle vient
   * d'un document existant, dont le rang est deja enregistre.
   */
  protected choisirEquipe(rencontre: FieldTree<RencontreEditable>, division: string): void {
    const equipe = equipeParDivision(division);
    if (equipe) rencontre.numero().value.set(equipe.numero);
  }

  /**
   * Club retenu pour une rencontre, s'il a un logo.
   *
   * Sert a montrer la vignette a cote du champ : c'est ainsi que le benevole
   * VOIT que sa saisie a bien designe un club, au lieu de le decouvrir sur
   * l'affiche. L'ancien script devinait le club par une expression reguliere et
   * ne disait jamais s'il avait trouve.
   */
  protected clubRetenu(clubId: string): EntreeClub | undefined {
    return this.catalogue.parId(clubId);
  }

  /**
   * Met a jour l'identifiant du club adverse a chaque frappe.
   *
   * Seule une correspondance EXACTE est retenue : un rapprochement approximatif
   * n'est jamais applique en silence, c'est la regle du domaine. A defaut,
   * l'identifiant est deduit du libelle — le document reste ainsi valide et
   * l'affiche portera un monogramme, ce que l'absence de vignette annonce.
   */
  protected accorderClub(rencontre: FieldTree<RencontreEditable>): void {
    const libelle = rencontre.adversaireLibelle().value();
    const exact = libelle ? this.catalogue.parLibelle(libelle) : undefined;
    rencontre
      .adversaireClubId()
      .value.set(exact?.id ?? (libelle ? clubIdDepuisLibelle(libelle) : ''));
  }

  /** Selection dans la liste : le libelle et l'identifiant viennent du catalogue. */
  protected choisirClub(rencontre: FieldTree<RencontreEditable>, club: EntreeClub): void {
    rencontre.adversaireLibelle().value.set(club.libelle);
    rencontre.adversaireClubId().value.set(club.id);
  }

  /**
   * Libelle tel qu'il paraitra sur l'affiche.
   *
   * Affiche sous les champs de date : c'est la seule facon pour l'utilisateur
   * de verifier ce que produira sa saisie sans generer l'affiche, et cela evite
   * le recours au libelle impose « au cas ou ».
   */
  protected apercuDate(groupe: GroupeEditable): string {
    if (groupe.libelleOverride) return groupe.libelleOverride;
    const iso = `${groupe.date}T${groupe.heure}`;
    try {
      return formatCreneau(iso);
    } catch {
      return '—';
    }
  }
}
