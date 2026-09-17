import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { applyEach, form, FormField, min, required } from '@angular/forms/signals';
import type { Categorie } from 'poster-core';

import { DocumentAffiche } from '../../core/document-affiche';
import { Icone } from '../../shared/icone';
import { CreneauEditeur } from './creneau-editeur';

/**
 * Page de saisie d'une affiche.
 *
 * Le formulaire est construit DIRECTEMENT sur le modele editable du service :
 * `form()` en derive sa structure, et les deux partagent la meme valeur. Il n'y
 * a donc ni modele de formulaire parallele, ni conversion a synchroniser — le
 * pont que le plan prevoyait a disparu avec le choix des Signal Forms.
 *
 * Les mutations de STRUCTURE (ajouter un creneau, deplacer une rencontre)
 * passent en revanche par le service : un formulaire ne sait pas reordonner sa
 * propre liste, et ces operations doivent remplacer la valeur du signal pour
 * que la vue se redessine.
 */
@Component({
  selector: 'ppc-editeur',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    RouterLink,
    Icone,
    CreneauEditeur,
  ],
  templateUrl: './editeur.html',
  styleUrl: './editeur.scss',
})
export class Editeur {
  protected readonly doc = inject(DocumentAffiche);

  /**
   * Categorie demandee par la route.
   *
   * Elle ne se change pas depuis l'editeur : un document est une affiche
   * adultes OU une affiche jeunes. Changer d'avis, c'est revenir a l'ecran de
   * choix, et le service repart d'une affiche vierge.
   */
  readonly categorie = input.required<Categorie>();

  /**
   * Regles de saisie.
   *
   * Elles doublent volontairement le schema zod sur les champs que
   * l'utilisateur peut laisser vides : le schema dit si le document est
   * publiable, ces regles disent a l'instant ou porter le regard. Le verdict
   * de publication, lui, reste celui du schema — voir `doc.problemes`.
   */
  protected readonly formulaire = form(this.doc.affiche, (chemin) => {
    min(chemin.numero, 1, { message: 'La journée commence au numéro 1.' });

    applyEach(chemin.groupes, (groupe) => {
      required(groupe.date, { message: 'Sans date, l’affiche ne peut pas être publiée.' });
      required(groupe.heure, { message: 'Indiquez l’heure de début.' });

      applyEach(groupe.rencontres, (rencontre) => {
        required(rencontre.adversaireLibelle, { message: 'Nommez l’équipe adverse.' });
        min(rencontre.numero, 1, { message: 'Le numéro d’équipe commence à 1.' });
      });
    });
  });

  protected libelleCategorie(categorie: Categorie): string {
    return categorie === 'jeunes' ? 'jeunes' : 'adultes';
  }
}
