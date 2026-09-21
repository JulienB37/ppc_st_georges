import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Installation } from './core/installation';
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

  /**
   * L'installation se propose depuis le bandeau, quand le navigateur y invite.
   *
   * Chrome n'affiche plus de banniere : l'entree est dans son menu, ou un
   * benevole n'ira pas la chercher. Rien n'apparait sur iOS, ou l'evenement
   * n'existe pas — et c'est voulu.
   */
  protected readonly installation = inject(Installation);
}
