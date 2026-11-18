import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import {
  deriveBuilderCombatSnapshot,
  deriveWoundThreshold,
  secondaryClassesTotalLevel,
  totalCharacterLevel,
} from './character-builder-derived.util';

describe('character-builder-derived.util', () => {
  it('sums secondary class levels and caps total at 20', () => {
    expect(secondaryClassesTotalLevel([{ level: 3 } as never, { level: 2 } as never])).toBe(5);
    expect(totalCharacterLevel(18, 5)).toBe(20);
  });

  it('ceil-divides wound threshold', () => {
    expect(deriveWoundThreshold(17)).toBe(9);
  });

  it('derives combat snapshot from an empty creation', () => {
    const snap = deriveBuilderCombatSnapshot(structuredClone(INITIAL_CREATION_STATE));
    expect(snap.totalCharacterLevel).toBe(1);
    expect(snap.proficiencyBonus).toBe(2);
    expect(snap.initiative).toBe(snap.abilityModifiers.dexterite);
    expect(snap.needsMagicStep).toBeFalse();
    expect(snap.woundThreshold).toBe(deriveWoundThreshold(snap.hitPointsMax));
  });

  it('flags perception proficiency for passive score', () => {
    const without = deriveBuilderCombatSnapshot(structuredClone(INITIAL_CREATION_STATE));
    const withPerception = deriveBuilderCombatSnapshot({
      ...structuredClone(INITIAL_CREATION_STATE),
      selectedSkills: ['skill-perception'],
    });
    expect(withPerception.passivePerception).toBeGreaterThan(without.passivePerception);
  });
});
