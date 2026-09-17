import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(), // `withComponentInputBinding` : la categorie de l'URL arrive dans l'entree
    // `categorie` de l'editeur, sans lire `ActivatedRoute` a la main.
    provideRouter(routes, withComponentInputBinding()),
  ],
};
