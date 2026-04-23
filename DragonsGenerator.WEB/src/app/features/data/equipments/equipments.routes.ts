// features/data/equipments/equipments.routes.ts
import { Routes } from '@angular/router';

export const EQUIPMENTS_ROUTES: Routes = [
  // === Equipments ===
  {
    path: '',
    loadComponent: () =>
      import('@features/data/equipments/equipments-list.ts/equipments-list.ts').then(
        (m) => m.EquipmentsList,
      ),
  },
  {
    path: 'summary',
    loadComponent: () =>
      import('@features/data/equipments/equipments-summary/equipments-summary').then(
        (m) => m.EquipmentsSummary,
      ),
  },
  {
    path: 'types',
    loadComponent: () =>
      import('@features/data/equipments/equipment-types/equipment-types').then(
        (m) => m.EquipmentTypes,
      ),
  },

  {
    path: 'type/:type',
    loadComponent: () =>
      import('@features/data/equipments/equipment-by-type/equipment-by-type').then(
        (m) => m.EquipmentsByType,
      ),
  },

  {
    path: ':id',
    loadComponent: () =>
      import('@features/data/equipments/equipment-detail.ts/equipment-detail.ts').then(
        (m) => m.EquipmentDetail,
      ),
  },
];
