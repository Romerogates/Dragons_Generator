import { ApplicationConfig, isDevMode, provideZonelessChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

import { ViewportScroller } from '@angular/common';
import { routes } from './app.routes';
import { KeepScrollViewportScroller } from './core/routing/keep-scroll-viewport-scroller';
import { IdlePreloadStrategy } from './core/routing/idle-preload.strategy';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { aiRateLimitInterceptor } from './core/interceptors/ai-rate-limit.interceptor';
import { quietPollInterceptor } from './core/interceptors/quiet-poll.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    { provide: ViewportScroller, useClass: KeepScrollViewportScroller },

    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(IdlePreloadStrategy),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled',
      }),
    ),

    provideHttpClient(
      withFetch(),
      withInterceptors([
        credentialsInterceptor,
        authInterceptor,
        quietPollInterceptor,
        aiRateLimitInterceptor,
      ]),
    ),

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:5000',
    }),
  ],
};
