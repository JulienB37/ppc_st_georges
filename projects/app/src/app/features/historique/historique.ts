import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  compterRencontres,
  formatCreneau,
  ordinalJournee,
  premierCreneau,
  type Affiche,
} from 'poster-core';

import { DepotAffiches } from '../../core/depot-affiches';
import { DocumentAffiche } from '../../core/document-affiche';
import { Icone } from '../../shared/icone';
import { TEINTES_CRENEAU_UI } from '../../shared/teintes';

/**
 * Historique des affiches enregistrees.
 *
 * Il rend leur utilite aux sauvegardes : rouvrir une journee pour la corriger,
 * et surtout la DUPLIQUER pour la semaine suivante — le geste hebdomadaire du
 * club, qui reprend l'affiche precedente et n'en change que les adversaires.
 *
 * Les documents illisibles y figurent aussi, signales. Les cacher les rendrait
 * impossibles a supprimer, et laisserait l'utilisateur devant une base qui ne
 * correspond pas a ce qu'il voit.
 */
@Component({
  selector: 'ppc-historique',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icone],
  templateUrl: './historique.html',
  styleUrl: './historique.scss',
})
export class Historique {
  private readonly depot = inject(DepotAffiches);
  private readonly doc = inject(DocumentAffiche);
  private readonly router = inject(Router);

  /** Relance la lecture apres chaque suppression. */
  private readonly rechargement = signal(0);

  protected readonly entrees = resource({
    params: () => this.rechargement(),
    loader: () => this.depot.historique(),
  });

  /**
   * Rang abrege : « 1re », « 12e ».
   *
   * C'est `ordinalJournee` et non un `<sup>e</sup>` ecrit a la main : la regle
   * du feminin vit a un seul endroit, et l'affiche comme l'historique en
   * dependent. « Journee » etant feminin, le rang 1 donne « 1re ».
   */
  protected rang(affiche: Affiche): string {
    return ordinalJournee(affiche.numero);
  }

  /**
   * Couleur du rang, par CATEGORIE.
   *
   * Elle porte une information : c'est le seul trait qui distingue une affiche
   * adultes d'une affiche jeunes dans la liste. Les memes deux teintes que
   * l'ecran de choix, pour qu'un coup d'oeil suffise.
   */
  protected teinte(affiche: Affiche): string {
    return affiche.categorie === 'jeunes' ? TEINTES_CRENEAU_UI[1]! : TEINTES_CRENEAU_UI[0]!;
  }

  protected libelleCreneau(affiche: Affiche): string {
    const premier = premierCreneau(affiche.groupes);
    return premier ? formatCreneau(premier) : 'date à compléter';
  }

  protected compter(affiche: Affiche): number {
    return compterRencontres(affiche);
  }

  protected ouvrir(affiche: Affiche): void {
    this.doc.ouvrir(affiche);
    void this.router.navigate(['/affiche', affiche.categorie]);
  }

  /** Reprend l'affiche pour la journee suivante, sans toucher a l'originale. */
  protected dupliquer(affiche: Affiche): void {
    this.doc.ouvrir(affiche);
    this.doc.dupliquer();
    void this.router.navigate(['/affiche', affiche.categorie]);
  }

  protected async supprimer(id: string): Promise<void> {
    await this.depot.supprimer(id);
    this.rechargement.update((n) => n + 1);
  }
}
