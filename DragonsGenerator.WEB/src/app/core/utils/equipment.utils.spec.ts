import {
  CATEGORY_FILTERS,
  isEquipmentCategoryId,
  isMasteredProficiencyChoice,
  masteredProficiencyChoiceLabel,
  normalizeEquipments,
  normalizeItemRef,
  normalizeEquipmentType,
  normalizeEquipmentSubtype,
  resolveEquipmentRefId,
} from './equipment.utils';

describe('equipment.utils', () => {
  it('resolveEquipmentRefId maps aliases', () => {
    expect(resolveEquipmentRefId('wp-cat-martial')).toBe('category-martial-weapons');
    expect(resolveEquipmentRefId('gr-sac-erudit')).toBe('gr-sac-derudit');
    expect(resolveEquipmentRefId('wp-dague')).toBe('wp-dague');
  });

  it('isEquipmentCategoryId detects categories and mastered choices', () => {
    expect(isEquipmentCategoryId('category-simple-weapons')).toBe(true);
    expect(isEquipmentCategoryId('wp-mastered-choice')).toBe(true);
    expect(isEquipmentCategoryId('tl-mastered-choice')).toBe(true);
    expect(isEquipmentCategoryId('wp-dague')).toBe(false);
  });

  it('mastered proficiency choice helpers', () => {
    expect(isMasteredProficiencyChoice('wp-mastered-choice')).toBe(true);
    expect(isMasteredProficiencyChoice('tl-mastered-choice')).toBe(true);
    expect(isMasteredProficiencyChoice('wp-dague')).toBe(false);
    expect(masteredProficiencyChoiceLabel('wp-mastered-choice')).toContain('Arme');
    expect(masteredProficiencyChoiceLabel('tl-mastered-choice')).toContain('Outil');
  });

  it('normalizeItemRef parses qty suffix and objects', () => {
    expect(normalizeItemRef('wp-dague-x2')).toEqual({ id: 'wp-dague', qty: 2 });
    expect(normalizeItemRef({ id: 'gr-sac-derudit', qty: 1 })).toEqual({
      id: 'gr-sac-derudit',
      qty: 1,
    });
    expect(normalizeItemRef(null)).toEqual({ id: 'unknown', qty: 1 });
  });

  it('normalizeEquipments maps API damage fields', () => {
    const items = normalizeEquipments([
      {
        id: 'wp-dague',
        name: 'Dague',
        type: 'weapon',
        subtype: 'simple_melee',
        data: { damage_dice: '1d4', damage_type: 'perforant', properties: ['prop-finesse'] },
      } as any,
    ]);
    expect(items[0].type).toBe('WEAPON');
    const data = items[0].data as unknown as Record<string, unknown>;
    expect(data['dmg_d']).toBe('1d4');
    expect(data['props']).toEqual(jasmine.arrayContaining(['prop-finesse']));
  });

  it('CATEGORY_FILTERS contains expected weapon groups', () => {
    expect(CATEGORY_FILTERS['category-martial-weapons'].subtypes).toContain('MARTIAL_MELEE');
    expect(CATEGORY_FILTERS['category-musical-instruments'].ids).toContain('tl-lyre');
  });

  it('normalizeItemRef resolves equipment id aliases', () => {
    expect(normalizeItemRef('gr-sac-erudit').id).toBe('gr-sac-derudit');
  });

  it('normalizeEquipmentType and subtype uppercases values', () => {
    expect(normalizeEquipmentType('weapon')).toBe('WEAPON');
    expect(normalizeEquipmentSubtype('simple_melee')).toBe('SIMPLE_MELEE');
    expect(normalizeEquipmentSubtype(null)).toBeNull();
  });
});
