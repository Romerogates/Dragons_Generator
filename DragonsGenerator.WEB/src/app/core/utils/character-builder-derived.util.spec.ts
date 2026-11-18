import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import {
  deriveBuilderCombatSnapshot,
  deriveWoundThreshold,
  secondaryClassesTotalLevel,
  totalCharacterLevel,
} from './character-builder-derived.util';

describe('character-builder-derived.util', () => {
  it('sums secondary class levels and caps total at 20', () => {
    expect(secondaryClassesTotalLevel(undefined)).toBe(0);
    expect(secondaryClassesTotalLevel([{ level: 0 } as never, { level: 3 } as never])).toBe(3);
    expect(totalCharacterLevel(0, 0)).toBe(1);
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
    const fromBg = deriveBuilderCombatSnapshot({
      ...structuredClone(INITIAL_CREATION_STATE),
      backgroundSkills: ['skill-perception'],
      selectedSkills: [],
    });
    expect(fromBg.passivePerception).toBe(withPerception.passivePerception);
  });

  it('uses empty fallbacks when optional creation fields are missing', () => {
    const snap = deriveBuilderCombatSnapshot({
      ...structuredClone(INITIAL_CREATION_STATE),
      targetLevel: 0,
      asiBonuses: {},
      classFeatures: [],
      secondaryClasses: undefined,
      backgroundEquipment: [{ refId: 'it-armure', name: 'Cuir' } as never],
    });
    expect(snap.totalCharacterLevel).toBe(1);
    expect(snap.hitPointsMax).toBeGreaterThan(0);
  });
});
