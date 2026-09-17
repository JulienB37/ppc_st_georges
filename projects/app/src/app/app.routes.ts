import type { Routes } from '@angular/router';

/**
 * Routes de l'application.
 *
 * L'editeur est charge PARESSEUSEMENT, et ce n'est pas une precaution de
 * principe : c'est lui qui tirera le rasteriseur, soit 2,4 Mo de wasm, qu'un
 * benevole venu consulter son historique n'a aucune raison de telecharger.
 *
 * L'historique et la bibliotheque de clubs arrivent aux lots 6 et 7 ; leurs
 * chemins ne sont pas encore declares, pour qu'aucune route ne mene a une page
 * vide.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'journee' },
  {
    path: 'journee',
    title: 'Journée de championnat — PPC St Georges/Cher',
    loadComponent: () => import('./features/editeur/editeur').then((m) => m.Editeur),
  },
  { path: '**', redirectTo: 'journee' },
];
