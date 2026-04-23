export type EquipmentType = 'WEAPON' | 'ARMOR' | 'MOUNT' | 'VEHICLE' | 'TOOL' | 'GEAR' | 'SERVICE';

export type EquipmentSubtype =
  // weapons
  | 'SIMPLE_MELEE'
  | 'SIMPLE_RANGED'
  | 'MARTIAL_MELEE'
  | 'MARTIAL_RANGED'
  // armors
  | 'LIGHT'
  | 'MEDIUM'
  | 'HEAVY'
  | 'SHIELD'
  // mounts
  | 'ANIMAL'
  // vehicles
  | 'LAND'
  | 'WATER'
  | 'AIR'
  // gear
  | 'CONTAINER';
