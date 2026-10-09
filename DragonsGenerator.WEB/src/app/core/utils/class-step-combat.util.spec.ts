import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import {
  asChoicePools,
  asFeatureJsonList,
  isConcreteCombatStyleId,
  isExtraCombatStyleFeature,
  isFightingStylePool,
  resolveAvailableCombatStyles,
  resolveCombatStyleRequiredCount,
  resolveCombatStyleUnlockLevel,
} from './class-step-combat.util';

function cls(id: string, data: Record<string, unknown> = {}): CharacterClass {
  return {
    id,
    name: 'X',
    data: {
      hit_die: 8,
      primary_abilities: [],
      proficiencies: {},
      starting_equipment: [],
      progression: [],
      ...data,
    },
  } as unknown as CharacterClass;
}

describe('class-step-combat.util', () => {
  it('detects fighting-style pools and concrete style ids', () => {
    expect(isFightingStylePool({ id: 'choice-fighting_style', type: 'x' })).toBeTrue();
    expect(isFightingStylePool({ name: 'Style de combat' })).toBeTrue();
    expect(isFightingStylePool({ id: 'skills' })).toBeFalse();
    expect(isConcreteCombatStyleId('')).toBeFalse();
    expect(isConcreteCombatStyleId('feat-style-de-combat-guerrier')).toBeFalse();
    expect(isConcreteCombatStyleId('feat-style-duel')).toBeTrue();
    expect(isConcreteCombatStyleId('style-archerie')).toBeTrue();
    expect(isExtraCombatStyleFeature('feat-style-de-combat-supplementaire')).toBeTrue();
  });

  it('coerces pools and feature lists', () => {
    expect(asChoicePools(null)).toEqual([]);
    expect(asChoicePools([{ id: 'a' }])).toEqual([{ id: 'a' }]);
    expect(asFeatureJsonList('nope')).toEqual([]);
    expect(asFeatureJsonList([{ id: 'f1', name: 'A' }]).length).toBe(1);
  });

  it('resolves guerrier unlock + duel fallback, and extra style count', () => {
    const guerrier = cls('cls-guerrier', {
      choice_pools: [{ id: 'choice-fighting_style', pool: ['feat-style-duel'] }],
      features_details: [],
    });
    expect(resolveCombatStyleUnlockLevel(guerrier)).toBe(1);
    expect(resolveAvailableCombatStyles(guerrier)[0].name).toBe('Duel');
    expect(
      resolveCombatStyleRequiredCount({
        requiresCombatStyle: true,
        targetLevel: 10,
        subclassFeatures: [{ id: 'feat-style-de-combat-supplementaire', level: 10 }],
      }),
    ).toBe(2);
    expect(resolveCombatStyleRequiredCount({ requiresCombatStyle: false, targetLevel: 1 })).toBe(0);
    expect(resolveCombatStyleUnlockLevel(null)).toBe(99);
    expect(resolveAvailableCombatStyles(null)).toEqual([]);
  });

  it('reads unlock from feature grant when class has no hardcoded level', () => {
    const other = cls('cls-other', {
      features_details: [
        {
          id: 'grant',
          name: 'Style',
          desc: '…',
          level: 3,
          resolves_to_choice_pool: 'fighting-style',
        },
      ],
    });
    expect(resolveCombatStyleUnlockLevel(other)).toBe(3);
  });

  it('covers remaining pool/style branches', () => {
    expect(isFightingStylePool({ id: 'combat-style-pool' })).toBeTrue();
    expect(isFightingStylePool({ type: 'style-combat' })).toBeTrue();
    expect(isConcreteCombatStyleId('foo-style-duel-bar')).toBeTrue();
    expect(isExtraCombatStyleFeature('feat-other')).toBeFalse();
    expect(asChoicePools([null, { id: 'ok' }])).toEqual([{ id: 'ok' }]);
    expect(asFeatureJsonList([{ name: 'no-id' }, { id: 'f' }]).map((f) => f.id)).toEqual(['f']);
    const named = cls('cls-paladin', {
      choice_pools: [{ name: 'Style de combat', pool: ['custom-style'] }],
      features_details: [
        { id: 'custom-style', name: 'Style de combat : Garde', desc: 'Custom.' },
      ],
    });
    expect(resolveCombatStyleUnlockLevel(named)).toBe(2);
    expect(resolveAvailableCombatStyles(named)[0]).toEqual({
      id: 'custom-style',
      name: 'Garde',
      desc: 'Custom.',
    });
    expect(
      resolveCombatStyleRequiredCount({
        requiresCombatStyle: true,
        targetLevel: 6,
        classFeaturesDetails: [{ id: 'feat-style-de-combat-supplementaire', unlocks_at_level: 6 }],
      }),
    ).toBe(2);
    const unknown = cls('cls-inconnu', { features_details: [] });
    expect(resolveCombatStyleUnlockLevel(unknown)).toBe(99);
    expect(resolveAvailableCombatStyles(cls('cls-x', { choice_pools: [] }))).toEqual([]);
  });
});
