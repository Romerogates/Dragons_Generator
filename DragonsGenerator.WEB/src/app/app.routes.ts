// app.routes.ts
import { Routes } from '@angular/router';
import { CharacterCreation } from './features/character-creation/character-creation';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
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
    path: 'create',
    loadComponent: () =>
      import('@features/character-creation/character-creation').then((m) => m.CharacterCreation),
  },
  {
    path: 'characters',
    loadComponent: () => import('@features/characters/characters').then((m) => m.Characters),
  },
  // === FALLBACK ===
  { path: '**', redirectTo: '' },
];
