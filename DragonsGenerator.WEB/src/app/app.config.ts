import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { IdlePreloadStrategy } from './core/routing/idle-preload.strategy';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),

    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(IdlePreloadStrategy),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),

    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
