// features/compendium/compendium.routes.ts
import { Routes } from '@angular/router';

export const CIVILISATIONS_ROUTES: Routes = [
  // === Civilisations ===
  {
    path: '',
    loadComponent: () =>
      import('@features/data/civilisations/civilisations/civilisations').then(
        (m) => m.Civilisations,
      ),
  },
  {
    path: 'summary',
    loadComponent: () =>
      import('@features/data/civilisations/civilisationsSummary/civilisations-summary').then(
        (m) => m.CivilisationsSummary,
      ),
  },

  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/civilisations/civilisation-by-id/civilisation-by-id').then(
        (m) => m.CivilisationById,
      ),
  },
];
