import type {
  BackgroundEquipmentChooseGroup,
  BackgroundEquipmentItem,
} from '@core/models/Backgrounds/background';
import type { EquipmentInstance, EquipmentLocation, EquipmentSlot } from '@core/models/Character/character';

function mapBackgroundItemLocation(
  location: BackgroundEquipmentItem['location'] | undefined,
): EquipmentLocation {
  if (location === 'equipped') return 'equipped';
  if (location === 'storage') return 'stored';
  return 'backpack';
}

export function mapBackgroundFixedEquipment(items: BackgroundEquipmentItem[]): EquipmentInstance[] {
  return items.map((item) => {
    const location = mapBackgroundItemLocation(item.location);
    return {
      instanceId: crypto.randomUUID(),
      refId: item.id,
      name: item.name,
      qty: item.qty ?? 1,
      location,
      equipped: location === 'equipped',
      wKg: null,
      customData: undefined,
    };
  });
}

export function mapBackgroundEquipmentChoiceSlots(
  groups: BackgroundEquipmentChooseGroup[],
): EquipmentSlot[] {
  return groups.map((choice, i) => ({
    slot: 100 + i,
    description: choice.name ?? "Choix d'équipement",
    alternatives: (choice.pool ?? []).map((item) => [{ id: item.id, qty: item.qty ?? 1 }]),
  }));
}
