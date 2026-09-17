import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Icone } from '../../shared/icone';
import { applyEach, form, FormField, min, required } from '@angular/forms/signals';

import { DocumentJournee } from '../../core/document-journee';
import { CreneauEditeur } from './creneau-editeur';

/**
 * Page de saisie d'une journee.
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
    Icone,
    CreneauEditeur,
  ],
  templateUrl: './editeur.html',
  styleUrl: './editeur.scss',
})
export class Editeur {
  protected readonly doc = inject(DocumentJournee);

  /**
   * Regles de saisie.
   *
   * Elles doublent volontairement le schema zod sur les deux champs que
   * l'utilisateur peut laisser vides : le schema dit si le document est
   * publiable, ces regles disent a l'instant ou porter le regard. Le verdict
   * de publication, lui, reste celui du schema — voir `doc.problemes`.
   */
  protected readonly formulaire = form(this.doc.journee, (chemin) => {
    min(chemin.numero, 1, { message: 'La journee commence au numero 1.' });

    applyEach(chemin.affiches, (affiche) => {
      applyEach(affiche.groupes, (groupe) => {
        required(groupe.date, { message: 'Sans date, l’affiche ne peut pas être publiée.' });
        required(groupe.heure, { message: 'Indiquez l’heure de début.' });

        applyEach(groupe.rencontres, (rencontre) => {
          required(rencontre.adversaireLibelle, { message: 'Nommez l’équipe adverse.' });
          min(rencontre.numero, 1, { message: 'Le numéro d’équipe commence à 1.' });
        });
      });
    });
  });

  /** Total affiche dans l'en-tete : c'est lui qui decide de la mise en page. */
  protected readonly nbRencontres = computed(() =>
    this.doc
      .journee()
      .affiches.reduce(
        (total, affiche) =>
          total + affiche.groupes.reduce((n, groupe) => n + groupe.rencontres.length, 0),
        0,
      ),
  );
}
