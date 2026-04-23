// features/compendium/spells.routes.ts
import { Routes } from '@angular/router';

export const SPELLS_ROUTES: Routes = [
  // === Spells ===
  {
    path: '',
    loadComponent: () => import('@features/data/spells/spells/spells').then((m) => m.Spells),
  },
  {
    path: 'summary',
    loadComponent: () =>
      import('@features/data/spells/spells-summary/spells-summary').then((m) => m.SpellsSummary),
  },
  {
    path: 'schools',
    loadComponent: () =>
      import('@features/data/spells/spells-schools/spells-schools').then((m) => m.SpellSchools),
  },
  {
    path: 'level/:level',
    loadComponent: () =>
      import('@features/data/spells/spells-by-level/spells-by-level').then((m) => m.SpellsByLevel),
  },
  {
    path: 'school/:school',
    loadComponent: () =>
      import('@features/data/spells/spells-by-school/spells-by-school').then(
        (m) => m.SpellsBySchool,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/spells/spell-by-id/spell-by-id').then((m) => m.SpellById),
  },
];
