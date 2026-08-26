import { Routes } from '@angular/router';

export const COMBAT_ACTIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('@features/data/combat-actions/combat-actions-list/combat-actions-list').then(
        (m) => m.CombatActionsList,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/combat-actions/combat-action-by-id/combat-action-by-id').then(
        (m) => m.CombatActionById,
      ),
  },
];
