import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Icone } from '../../shared/icone';
import { FormField, type FieldTree } from '@angular/forms/signals';
import {
  clubIdDepuisLibelle,
  formatCreneau,
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
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    Icone,
  ],
  templateUrl: './creneau-editeur.html',
  styleUrl: './creneau-editeur.scss',
})
export class CreneauEditeur {
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
   * Deduit l'identifiant du club adverse de son libelle.
   *
   * PROVISOIRE, jusqu'au lot 7 : la selection du club s'y fera par
   * autocompletion, avec la vignette du logo et une resolution explicite a
   * trois issues. En attendant, `clubIdDepuisLibelle` — deja ecrite et testee —
   * rend le document publiable, faute de quoi l'editeur resterait bloque sur
   * « le club adverse n'est pas choisi ».
   *
   * Ce n'est PAS la regression de l'ancien script, qui devinait le club par une
   * expression reguliere sur une chaine libre sans jamais le dire : ici
   * l'identifiant est ecrit dans le document, et le lot 7 le rendra visible et
   * corrigeable.
   */
  protected deriverClub(rencontre: FieldTree<RencontreEditable>): void {
    const libelle = rencontre.adversaireLibelle().value();
    rencontre.adversaireClubId().value.set(libelle ? clubIdDepuisLibelle(libelle) : '');
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
