import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MiseAJour } from './core/mise-a-jour';

@Component({
  selector: 'ppc-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /**
   * Les mises a jour sont annoncees depuis la coquille, donc sur tout ecran.
   *
   * Servie par un service worker, l'application ne prend pas une nouvelle
   * version au rechargement : sans ce bandeau, un correctif publie
   * n'atteindrait jamais un poste qui a deja ouvert le site.
   */
  protected readonly maj = inject(MiseAJour);
}
