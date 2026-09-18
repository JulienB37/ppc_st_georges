import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Categorie } from 'poster-core';

import { DocumentAffiche } from '../../core/document-affiche';

/**
 * Choix de la categorie, premiere etape.
 *
 * Une affiche adultes et une affiche jeunes ne sont pas deux moitiés d'un meme
 * document : les deux championnats n'avancent pas a la meme journee — la
 * configuration historique du club le montrait, adultes en journee 1 et jeunes
 * en journee 8. Les saisir ensemble forcait a leur imposer un numero commun, et
 * l'importateur devait en jeter un.
 *
 * Le choix est donc fait ici, une fois, et decide du document.
 */
@Component({
  selector: 'ppc-nouvelle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './nouvelle.html',
  styleUrl: './nouvelle.scss',
})
export class Nouvelle {
  private readonly doc = inject(DocumentAffiche);
  private readonly router = inject(Router);

  protected commencer(categorie: Categorie): void {
    this.doc.commencer(categorie);
    void this.router.navigate(['/affiche', categorie]);
  }
}
