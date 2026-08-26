import { Routes } from '@angular/router';

export const SKILLS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('@features/data/skills/skills-list/skills-list').then((m) => m.SkillsList),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/skills/skill-by-id/skill-by-id').then((m) => m.SkillById),
  },
];
