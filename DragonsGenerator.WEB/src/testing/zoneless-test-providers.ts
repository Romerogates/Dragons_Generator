import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

/** Providers requis pour tester des composants standalone (app zoneless). */
export const zonelessTestProviders = [
  provideZonelessChangeDetection(),
  provideHttpClient(),
  provideHttpClientTesting(),
];
