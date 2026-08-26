import { Routes } from '@angular/router';

export const FEATS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('@features/data/feats/feats-list/feats-list').then((m) => m.FeatsList),
  },
  {
    path: ':id',
    loadComponent: () => import('@features/data/feats/feat-by-id/feat-by-id').then((m) => m.FeatById),
  },
];
