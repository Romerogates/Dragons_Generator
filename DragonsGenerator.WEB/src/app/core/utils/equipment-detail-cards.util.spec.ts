import {
  equipmentDetailCards,
  equipmentDetailDescription,
} from './equipment-detail-cards.util';
import type { EquipmentDisplayLike } from './equipment-display.util';

describe('equipment-detail-cards.util', () => {
  it('builds weapon cards with properties and ranges', () => {
    const eq: EquipmentDisplayLike = {
      type: 'WEAPON',
      subtype: 'MARTIAL_MELEE',
      cost: { v: 15, u: 'po' },
      wKg: 1.5,
      data: {
        desc: 'Une lame fiable.',
        damage_dice: '1d8',
        damage_type: 'tranchant',
        properties: ['prop-polyvalente-1d10'],
        throw_range: { normal: 6, max: 18 },
        str_req: 13,
      },
    };
    const cards = equipmentDetailCards(eq);
    expect(cards.some((c) => c.label === 'Dégâts')).toBeTrue();
    expect(cards.some((c) => c.kind === 'chips')).toBeTrue();
    expect(cards.some((c) => c.label === 'Portée (lancer)')).toBeTrue();
    expect(equipmentDetailDescription(eq)).toBe('Une lame fiable.');
  });

  it('builds armor cards with stealth flag', () => {
    const cards = equipmentDetailCards({
      type: 'ARMOR',
      subtype: 'HEAVY',
      data: { ac: 18, stealth_dis: true, str_required: 15 },
    });
    expect(cards.some((c) => c.label === "Classe d'armure" && c.value === '18')).toBeTrue();
    expect(cards.some((c) => c.kind === 'yes')).toBeTrue();
  });

  it('handles empty data', () => {
    expect(equipmentDetailCards({ type: 'GEAR', subtype: null, data: {} }).length).toBeGreaterThan(0);
    expect(equipmentDetailDescription({ type: 'GEAR', subtype: null, data: {} })).toBeNull();
  });
});
