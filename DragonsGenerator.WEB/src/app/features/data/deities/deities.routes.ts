import { Routes } from '@angular/router';

export const DEITIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@features/data/deities/deities-list/deities-list').then((m) => m.DeitiesList),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/deities/deity-by-id/deity-by-id').then((m) => m.DeityById),
  },
];
