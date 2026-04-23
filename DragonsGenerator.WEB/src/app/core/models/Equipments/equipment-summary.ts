import { Cost } from './cost';
import { EquipmentSubtype, EquipmentType } from './equipment-enums';

export interface EquipmentSummary {
  id: string;
  name: string;
  type: EquipmentType;
  subtype: EquipmentSubtype | null;
  cost: Cost;
  wKg: number | null;
}
