import type { BackgroundEquipmentItem } from '@core/models/Backgrounds/background';
import {
  mapBackgroundEquipmentChoiceSlots,
  mapBackgroundFixedEquipment,
} from './character-background-equipment.util';

describe('character-background-equipment.util', () => {
  it('mapBackgroundFixedEquipment builds equipment instances', () => {
    const items = mapBackgroundFixedEquipment([
      { id: 'gr-sac', name: 'Sac', qty: 1, location: 'equipped' },
      { id: 'gr-coffre', name: 'Relique', qty: 1, location: 'storage' },
    ]);
    expect(items[0].refId).toBe('gr-sac');
    expect(items[0].equipped).toBeTrue();
    expect(items[0].location).toBe('equipped');
    expect(items[1].location).toBe('stored');
  });

  it('defaults missing location to backpack', () => {
    const items = mapBackgroundFixedEquipment([
      { id: 'gr-kit', name: 'Kit', qty: 1, location: 'backpack' },
      { id: 'gr-loose', name: 'Loose', qty: 1 } as import('@core/models/Backgrounds/background').BackgroundEquipmentItem,
    ]);
    expect(items[0].location).toBe('backpack');
    expect(items[1].location).toBe('backpack');
    expect(items[0].equipped).toBeFalse();
  });

  it('mapBackgroundEquipmentChoiceSlots handles empty pool', () => {
    const slots = mapBackgroundEquipmentChoiceSlots([{ name: 'Vide' }]);
    expect(slots[0].alternatives).toEqual([]);
  });

  it('defaults missing qty to 1 on fixed equipment', () => {
    const items = mapBackgroundFixedEquipment([
      { id: 'gr-no-qty', name: 'Sans qty', location: 'backpack' } as BackgroundEquipmentItem,
    ]);
    expect(items[0].qty).toBe(1);
  });

  it('mapBackgroundEquipmentChoiceSlots uses default description when name is missing', () => {
    const slots = mapBackgroundEquipmentChoiceSlots([{}]);
    expect(slots[0].description).toBe("Choix d'équipement");
  });

  it('mapBackgroundEquipmentChoiceSlots defaults pool item qty to 1', () => {
    const slots = mapBackgroundEquipmentChoiceSlots([
      { name: 'Outil', pool: [{ id: 'tl-plume' }] },
    ]);
    expect(slots[0].alternatives?.[0][0]).toEqual({ id: 'tl-plume', qty: 1 });
  });
});
