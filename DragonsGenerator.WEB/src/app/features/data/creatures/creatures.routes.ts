import { Routes } from '@angular/router';

export const CREATURES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@features/data/creatures/creatures/creatures').then((m) => m.Creatures),
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('@features/data/creatures/creatures-categories/creatures-categories').then(
        (m) => m.CreaturesCategories,
      ),
  },
  {
    path: 'category/:category',
    loadComponent: () =>
      import('@features/data/creatures/creatures-by-category/creatures-by-category').then(
        (m) => m.CreaturesByCategory,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/creatures/creature-by-id/creature-by-id').then((m) => m.CreatureById),
  },
];
