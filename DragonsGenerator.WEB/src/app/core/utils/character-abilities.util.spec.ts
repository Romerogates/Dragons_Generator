import type { AbilityScores, AsiChoiceSlot, FeatureInstance } from '@core/models/Character/character';
import {
  aggregateAsiChoices,
  canAffordAbilityScore,
  computeAbilityModifiersFromScores,
  computeFinalAbilities,
  computeHitPointsMax,
  computePassivePerception,
} from './character-abilities.util';

const base: AbilityScores = {
  force: 8,
  dexterite: 14,
  constitution: 12,
  intelligence: 10,
  sagesse: 13,
  charisme: 9,
};

describe('character-abilities.util', () => {
  it('computeFinalAbilities clamps at 20', () => {
    const final = computeFinalAbilities(base, { force: 4 }, { force: 10 });
    expect(final.force).toBe(20);
    expect(final.dexterite).toBe(14);
  });

  it('computeAbilityModifiersFromScores follows D&D tiers', () => {
    const mods = computeAbilityModifiersFromScores({ ...base, dexterite: 14, force: 8 });
    expect(mods.dexterite).toBe(2);
    expect(mods.force).toBe(-1);
  });

  it('computeHitPointsMax uses defaults for missing hp fields', () => {
    const hp = computeHitPointsMax({
      targetLevel: 1,
      hpAtLevel1: 0,
      hpPerLevelAverage: 0,
      hitDie: 8,
      constitutionMod: 0,
      classId: 'cls-guerrier',
      subclassId: null,
      classFeatures: [],
    });
    expect(hp).toBe(8);
  });

  it('computeHitPointsMax adds draconic sorcerer bonus', () => {
    const hp = computeHitPointsMax({
      targetLevel: 3,
      hpAtLevel1: 6,
      hpPerLevelAverage: 4,
      hitDie: 6,
      constitutionMod: 1,
      classId: 'cls-ensorceleur',
      subclassId: 'subcls-lignee-draconique',
      classFeatures: [],
    });
    expect(hp).toBe(6 + 1 + 2 * (4 + 1) + 3);
  });

  it('computePassivePerception adds proficiency when trained', () => {
    expect(computePassivePerception(1, true, 2)).toBe(13);
    expect(computePassivePerception(1, false, 2)).toBe(11);
  });

  it('aggregateAsiChoices sums bonuses and feat ids', () => {
    const slots: AsiChoiceSlot[] = [
      { level: 4, mode: 'plus2', primary: 'force' },
      { level: 8, mode: 'plus1plus1', primary: 'dexterite', secondary: 'constitution' },
      { level: 12, mode: 'feat', featId: 'feat-alert' },
    ];
    const { bonuses, featIds } = aggregateAsiChoices(slots);
    expect(bonuses.force).toBe(2);
    expect(bonuses.dexterite).toBe(1);
    expect(bonuses.constitution).toBe(1);
    expect(featIds).toEqual(['feat-alert']);
  });

  it('canAffordAbilityScore respects point-buy budget', () => {
    expect(canAffordAbilityScore(8, 9, 27)).toBeTrue();
    expect(canAffordAbilityScore(8, 15, 0)).toBeFalse();
    expect(canAffordAbilityScore(8, 9, 0)).toBeFalse();
  });

  it('aggregateAsiChoices ignores incomplete slots', () => {
    const { bonuses, featIds } = aggregateAsiChoices([
      { level: 4, mode: 'plus2' },
      { level: 8, mode: 'plus1plus1', primary: 'force' },
      { level: 12, mode: 'feat' },
    ]);
    expect(Object.keys(bonuses).length).toBe(0);
    expect(featIds.length).toBe(0);
  });
});
