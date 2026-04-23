// Le champ "data" varie selon le type. On modélise les variantes connues.

export interface BaseData {
  desc: string | null;
}

export interface WeaponData extends BaseData {
  dmg_d: string | null;
  dmg_t: string | null; // 'tranchant' | 'perforant' | 'contondant' | 'radiant' | ...
  props: string[];
}

export interface ArmorData extends BaseData {
  ac: number;
  str_req?: number | null;
  stealth_dis: boolean;
}

export interface MountData extends BaseData {
  speed: string;
  cap_kg: number;
}

export interface VehicleData extends BaseData {
  speed?: string;
}

export interface ContainerData extends BaseData {
  cap_kg?: number | null;
}

export interface GearData extends BaseData {
  dmg_d?: string;
  dmg_t?: string;
  cap_kg?: number | null;
}

export type EquipmentData =
  | WeaponData
  | ArmorData
  | MountData
  | VehicleData
  | ContainerData
  | GearData
  | BaseData;
