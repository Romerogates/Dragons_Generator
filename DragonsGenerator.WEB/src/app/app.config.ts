import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // 1. Détection de changement ultra-rapide (Zoneless)
    provideZonelessChangeDetection(),

    // 2. Configuration avancée de la navigation
    provideRouter(
      routes,
      // Magique ! Permet de lire les paramètres de l'URL directement avec des @Input() dans tes composants
      withComponentInputBinding(),
      // Ajoute des animations de transition fluides et natives entre les pages de ton grimoire
      withViewTransitions(),
      // Remonte automatiquement en haut de la page quand tu changes de sort
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),

    // 3. Client HTTP pour récupérer ta liste de sorts
    provideHttpClient(
      // Utilise l'API "Fetch" native du navigateur (plus léger et performant)
      withFetch(),
    ),
  ],
};
