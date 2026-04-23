// features/compendium/compendium.routes.ts
import { Routes } from '@angular/router';

export const SPECIES_ROUTES: Routes = [
  // === Species ===
  {
    path: '',
    loadComponent: () =>
      import('@features/data/species/species/species').then((m) => m.SpeciesList),
  },
  {
    path: 'summary',
    loadComponent: () =>
      import('@features/data/species/species-summary/species-summary').then(
        (m) => m.SpeciesSummary,
      ),
  },
  {
    path: 'codes',
    loadComponent: () =>
      import('@features/data/species/species-codes/species-codes').then((m) => m.SpeciesCodes),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/species/species-by-id/species-by-id').then((m) => m.SpeciesById),
  },
];
