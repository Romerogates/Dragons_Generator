// features/compendium/compendium.routes.ts
import { Routes } from '@angular/router';

export const CLASSES_ROUTES: Routes = [
  // === Classes ===
  {
    path: '',
    loadComponent: () =>
      import('@features/data/characterClasses/character-classes/character-classes').then(
        (m) => m.CharacterClasses,
      ),
  },
  {
    path: 'summary',
    loadComponent: () =>
      import('@features/data/characterClasses/character-classes-summary/character-classes-summary').then(
        (m) => m.CharacterClassesSummary,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/characterClasses/character-class-detail/character-class-detail').then(
        (m) => m.CharacterClassDetail,
      ),
  },
];
