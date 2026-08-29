import { Routes } from '@angular/router';

export const BACKGROUNDS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@features/data/backgrounds/backgrounds-list/backgrounds-list').then(
        (m) => m.BackgroundsList,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/backgrounds/background-by-id/background-by-id').then(
        (m) => m.BackgroundById,
      ),
  },
];
