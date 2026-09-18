import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // `withComponentInputBinding` : la categorie de l'URL arrive dans l'entree
    // `categorie` de l'editeur, sans lire `ActivatedRoute` a la main.
    provideRouter(routes, withComponentInputBinding()),
    /*
     * Service worker : l'application s'installe et fonctionne hors ligne.
     *
     * Le besoin est reel et non decoratif : la saisie se fait en salle, ou le
     * wifi est mediocre, et l'affiche ne peut pas se rendre sans ses polices,
     * son gabarit et les 2,4 Mo de wasm de resvg. Les groupes d'assets de
     * `ngsw-config.json` suivent cette logique :
     *
     *   - la coquille et le MOTEUR — polices, wasm, gabarit — sont prefetches,
     *     car sans eux l'application est installee mais incapable de dessiner
     *     quoi que ce soit hors ligne ;
     *   - les logos de clubs et de partenaires sont PARESSEUX : il y en a une
     *     cinquantaine pour 1,2 Mo, dont une journee n'utilise qu'une poignee.
     *     Les prefetcher ferait payer a l'installation ce qui se met en cache
     *     tout seul a l'usage.
     *
     * `registrationStrategy` attend la stabilisation de l'application : le
     * premier rendu de l'apercu ne se retrouve pas en concurrence avec le
     * telechargement du cache.
     */
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
