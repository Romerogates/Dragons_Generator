// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register').then((m) => m.RegisterPage),
  },
  {
    path: 'confirm-email',
    loadComponent: () =>
      import('./features/auth/confirm-email').then((m) => m.ConfirmEmailPage),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'support',
    canActivate: [authGuard],
    loadComponent: () => import('./features/support/support').then((m) => m.SupportPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin').then((m) => m.AdminPage),
  },
  {
    path: 'civilisations',
    loadChildren: () =>
      import('@features/data/civilisations/civilisations.routes').then(
        (m) => m.CIVILISATIONS_ROUTES,
      ),
  },
  {
    path: 'classes',
    loadChildren: () =>
      import('@features/data/characterClasses/characterClasses.routes').then(
        (m) => m.CLASSES_ROUTES,
      ),
  },
  {
    path: 'species',
    loadChildren: () =>
      import('@features/data/species/species.routes').then((m) => m.SPECIES_ROUTES),
  },
  {
    path: 'equipments',
    loadChildren: () =>
      import('@features/data/equipments/equipments.routes').then((m) => m.EQUIPMENTS_ROUTES),
  },
  {
    path: 'spells',
    loadChildren: () => import('@features/data/spells/spells.routes').then((m) => m.SPELLS_ROUTES),
  },
  {
    path: 'skills',
    loadChildren: () => import('@features/data/skills/skills.routes').then((m) => m.SKILLS_ROUTES),
  },
  {
    path: 'feats',
    loadChildren: () => import('@features/data/feats/feats.routes').then((m) => m.FEATS_ROUTES),
  },
  {
    path: 'combat-actions',
    loadChildren: () =>
      import('@features/data/combat-actions/combat-actions.routes').then(
        (m) => m.COMBAT_ACTIONS_ROUTES,
      ),
  },
  {
    path: 'deities',
    loadChildren: () =>
      import('@features/data/deities/deities.routes').then((m) => m.DEITIES_ROUTES),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('@features/character-creation/character-creation').then((m) => m.CharacterCreation),
  },
  {
    path: 'characters',
    loadComponent: () => import('@features/characters/characters').then((m) => m.Characters),
  },
  {
    path: 'character-sheet',
    loadComponent: () =>
      import('@features/character-sheet/character-sheet').then((m) => m.CharacterSheet),
  },
  { path: '**', redirectTo: '' },
];
