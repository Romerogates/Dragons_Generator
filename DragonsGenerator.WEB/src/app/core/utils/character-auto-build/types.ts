export interface EquipmentCatalogItem {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  cost: { v: number | null; u: string };
  wKg: number | null;
  data: Record<string, unknown>;
}
