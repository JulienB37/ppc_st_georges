import type { Routes } from '@angular/router';

/**
 * Routes de l'application.
 *
 * Le parcours commence par le CHOIX DE LA CATEGORIE : un document est une
 * affiche adultes ou une affiche jeunes, jamais les deux. La categorie est donc
 * dans l'URL, ce qui rend l'etat partageable et le retour arriere naturel.
 *
 * L'editeur est charge PARESSEUSEMENT, et ce n'est pas une precaution de
 * principe : c'est lui qui tirera le rasteriseur, soit 2,4 Mo de wasm, qu'un
 * benevole venu consulter son historique n'a aucune raison de telecharger.
 *
 * La bibliotheque de clubs arrive au lot 7 ; son chemin n'est pas encore
 * declare, pour qu'aucune route ne mene a une page vide.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'nouvelle' },
  {
    path: 'nouvelle',
    title: 'Nouvelle affiche — PPC St Georges/Cher',
    loadComponent: () => import('./features/nouvelle/nouvelle').then((m) => m.Nouvelle),
  },
  {
    path: 'affiche/:categorie',
    title: 'Affiche de championnat — PPC St Georges/Cher',
    loadComponent: () => import('./features/editeur/editeur').then((m) => m.Editeur),
  },
  {
    path: 'historique',
    title: 'Affiches enregistrées — PPC St Georges/Cher',
    loadComponent: () => import('./features/historique/historique').then((m) => m.Historique),
  },
  { path: '**', redirectTo: 'nouvelle' },
];
