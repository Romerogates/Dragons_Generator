import {
  classResourceLabel,
  isHiddenClassResourceKey,
  visibleClassResources,
} from './class-resource-labels';

describe('classResourceLabel', () => {
  it('uses the French dictionary then a title-cased fallback', () => {
    expect(classResourceLabel('rage')).toBe('Rages');
    expect(classResourceLabel('custom_pool')).toBe('Custom pool');
  });
});

describe('isHiddenClassResourceKey', () => {
  it('hides ranger internal counters and conquest payloads', () => {
    expect(isHiddenClassResourceKey('enemy_count')).toBeTrue();
    expect(isHiddenClassResourceKey('terrain_count')).toBeTrue();
    expect(isHiddenClassResourceKey('conquete_methodique_effects')).toBeTrue();
    expect(isHiddenClassResourceKey('rage')).toBeFalse();
  });
});

describe('visibleClassResources', () => {
  it('returns an empty list without resources', () => {
    expect(visibleClassResources(null)).toEqual([]);
    expect(visibleClassResources(undefined)).toEqual([]);
  });

  it('drops hidden keys, empty values, and sorts remaining labels', () => {
    const rows = visibleClassResources({
      enemy_count: 2,
      terrain_count: 1,
      rage: 0,
      ki: 3,
      notes: '  ',
      pact_slots_count: '2',
      unused: null,
    });
    expect(rows.map((r) => r.key)).toEqual(['pact_slots_count', 'ki']);
    expect(rows.find((r) => r.key === 'ki')?.value).toBe('3');
    expect(rows.find((r) => r.key === 'pact_slots_count')?.label).toBe('Emplacements de pacte');
  });
});
