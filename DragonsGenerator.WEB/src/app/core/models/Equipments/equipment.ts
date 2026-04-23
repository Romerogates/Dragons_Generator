import { Cost } from './cost';
import { EquipmentData } from './equipment-data';
import { EquipmentSubtype, EquipmentType } from './equipment-enums';

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  subtype: EquipmentSubtype | null;
  cost: Cost;
  wKg: number | null;
  data: EquipmentData | null;
}
