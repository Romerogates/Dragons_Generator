import { testClass } from '@testing/typed-fixtures';
import {
  multiclassPrerequisitesMet,
  multiclassPrerequisiteLabel,
  multiclassPrerequisitesPossibleAtMaxBuy,
  multiclassProficiencies,
  combinedCasterLevel,
  multiclassSpellSlotsForCasterLevel,
  MULTICLASS_SPELL_SLOTS_TABLE,
} from './progression-multiclass.util';
import type { AbilityScores } from '@core/models/Character/character';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';

function makeAbilities(overrides: Partial<AbilityScores> = {}): AbilityScores {
  return {
    force: 10,
    dexterite: 10,
    constitution: 10,
    intelligence: 10,
    sagesse: 10,
    charisme: 10,
    ...overrides,
  };
}

function makeMulticlassCls(
  id: string,
  multiclass_prerequisites?: unknown,
  multiclass_proficiencies?: unknown,
): CharacterClass {
  return testClass({
    id,
    name: id,
    data: { multiclass_prerequisites, multiclass_proficiencies },
  });
}

describe('multiclassPrerequisitesMet', () => {
  it('returns true when the class has no multiclass_prerequisites field', () => {
    const cls = makeMulticlassCls('cls-magicien');
    expect(multiclassPrerequisitesMet(cls, makeAbilities())).toBe(true);
  });

  it('requires ALL abilities >= 13 for an "all" prerequisite (Paladin: Force et Charisme)', () => {
    const cls = makeMulticlassCls('cls-paladin', { all: ['str', 'cha'] });
    expect(multiclassPrerequisitesMet(cls, makeAbilities({ force: 13, charisme: 13 }))).toBe(true);
    expect(multiclassPrerequisitesMet(cls, makeAbilities({ force: 13, charisme: 12 }))).toBe(false);
  });

  it('requires AT LEAST ONE ability >= 13 for an "any" prerequisite (Guerrier: Force ou Dextérité)', () => {
    const cls = makeMulticlassCls('cls-guerrier', { any: ['str', 'dex'] });
    expect(multiclassPrerequisitesMet(cls, makeAbilities({ dexterite: 13 }))).toBe(true);
    expect(multiclassPrerequisitesMet(cls, makeAbilities())).toBe(false);
  });
});
describe('multiclassPrerequisiteLabel', () => {
  it('returns null when the class has no prerequisites', () => {
    expect(multiclassPrerequisiteLabel(makeMulticlassCls('cls-magicien'))).toBeNull();
  });

  it('formats an "all" prerequisite with "et"', () => {
    expect(multiclassPrerequisiteLabel(makeMulticlassCls('cls-paladin', { all: ['str', 'cha'] }))).toBe(
      'Force 13 et Charisme 13',
    );
  });

  it('formats an "any" prerequisite with "ou"', () => {
    expect(multiclassPrerequisiteLabel(makeMulticlassCls('cls-guerrier', { any: ['str', 'dex'] }))).toBe(
      'Force 13 ou Dextérité 13',
    );
  });
});
describe('multiclassPrerequisitesPossibleAtMaxBuy', () => {
  it('allows typical single-stat prereqs at max buy', () => {
    const cls = makeMulticlassCls('cls-roublard', { any: ['dex'] });
    expect(multiclassPrerequisitesPossibleAtMaxBuy(cls, {})).toBeTrue();
  });

  it('rejects impossible dual-stat prereqs when max buy cannot reach 13', () => {
    const cls = makeMulticlassCls('cls-impossible', { all: ['str', 'cha'] });
    expect(multiclassPrerequisitesPossibleAtMaxBuy(cls, {}, 10)).toBeFalse();
  });
});
describe('multiclassProficiencies', () => {
  it('returns an empty block when the class has no multiclass_proficiencies field (ex. Magicien)', () => {
    expect(multiclassProficiencies(makeMulticlassCls('cls-magicien'))).toEqual({
      armor: [],
      weapons: [],
      tools: [],
      skillChooseCount: 0,
      skillOptions: [],
    });
  });

  it('reads the reduced proficiencies block when present (ex. Guerrier)', () => {
    const cls = makeMulticlassCls('cls-guerrier', undefined, {
      armor: ['ar-light', 'ar-medium', 'ar-shield'],
      weapons: ['wp-cat-simple', 'wp-cat-martial'],
      tools: [],
      skillChooseCount: 0,
      skillOptions: [],
    });
    expect(multiclassProficiencies(cls).armor).toEqual(['ar-light', 'ar-medium', 'ar-shield']);
    expect(multiclassProficiencies(cls).weapons).toEqual(['wp-cat-simple', 'wp-cat-martial']);
  });
});
describe('combinedCasterLevel', () => {
  it('counts a full caster at its own level', () => {
    expect(combinedCasterLevel([{ level: 5, spellcastingKind: 'wizard' }])).toBe(5);
  });

  it('counts a half caster (Paladin/Rôdeur) as floor(level / 2)', () => {
    expect(combinedCasterLevel([{ level: 5, spellcastingKind: 'paladin' }])).toBe(2);
  });

  it('excludes the Occultiste (Magie de Pacte) from the combined total', () => {
    expect(
      combinedCasterLevel([
        { level: 5, spellcastingKind: 'wizard' },
        { level: 5, spellcastingKind: 'warlock' },
      ]),
    ).toBe(5);
  });

  it('sums full + half casters (ex. Magicien 3 / Paladin 4 → 3 + 2 = 5)', () => {
    expect(
      combinedCasterLevel([
        { level: 3, spellcastingKind: 'wizard' },
        { level: 4, spellcastingKind: 'paladin' },
      ]),
    ).toBe(5);
  });

  it('ignores non-caster classes', () => {
    expect(combinedCasterLevel([{ level: 5, spellcastingKind: null }])).toBe(0);
  });
});
describe('multiclassSpellSlotsForCasterLevel', () => {
  it('returns [] for a caster level below 1', () => {
    expect(multiclassSpellSlotsForCasterLevel(0)).toEqual([]);
  });

  it('matches the standard full-caster table at level 1 (2 emplacements niv. 1)', () => {
    expect(multiclassSpellSlotsForCasterLevel(1)).toEqual([{ level: 1, max: 2 }]);
  });

  it('matches the standard full-caster table at level 5 (4/3/2)', () => {
    expect(multiclassSpellSlotsForCasterLevel(5)).toEqual([
      { level: 1, max: 4 },
      { level: 2, max: 3 },
      { level: 3, max: 2 },
    ]);
  });

  it('clamps caster levels above 20 to the level-20 row', () => {
    expect(multiclassSpellSlotsForCasterLevel(25)).toEqual(multiclassSpellSlotsForCasterLevel(20));
  });

  it('exposes a 20-row table with 9 spell levels each', () => {
    expect(MULTICLASS_SPELL_SLOTS_TABLE.length).toBe(20);
    expect(MULTICLASS_SPELL_SLOTS_TABLE.every((row) => row.length === 9)).toBe(true);
  });
});