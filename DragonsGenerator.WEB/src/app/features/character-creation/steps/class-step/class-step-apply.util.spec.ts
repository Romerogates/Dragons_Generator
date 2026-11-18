import { testClass } from '@testing/typed-fixtures';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import {
  buildClassProgressionChoicesFromWizard,
  buildClassSelectionFromWizard,
  isDeferredClassFeature,
} from './class-step-apply.util';

function guerrier(): CharacterClass {
  return testClass({
    id: 'cls-guerrier',
    name: 'Guerrier',
    data: {
      hit_die: 10,
      hp_at_level_1: 10,
      hp_per_level_average: 6,
      proficiencies: {
        armor: ['ar-legere'],
        weapons: ['wp-cat-simple'],
        tools: [],
        saving_throws: ['Force', 'Constitution'],
        skills: { count: 2, options: ['skill-athletisme'] },
      },
      starting_equipment: [],
      progression: [{ level: 1, prof_bonus: 2, features: ['feat-second-souffle'], resources: {} }],
      features_details: [{ id: 'feat-second-souffle', name: 'Second souffle', desc: 'Reprend son souffle.', level: 1 }],
    },
  });
}

describe('class-step-apply.util', () => {
  it('defers combat-style pool features', () => {
    expect(isDeferredClassFeature({ id: 'feat-style-de-combat-guerrier' })).toBeTrue();
    expect(isDeferredClassFeature({ id: 'feat-second-souffle' })).toBeFalse();
    expect(isDeferredClassFeature({ id: 'feat-x', resolves_to_choice_pool: 'pool-1' })).toBeTrue();
  });

  it('builds a class selection from wizard answers', () => {
    const cls = guerrier();
    const selection = buildClassSelectionFromWizard({
      cls,
      subclass: null,
      targetLevel: 1,
      proficiencyBonus: 2,
      featureDetails: cls.data.features_details as never,
      subChoices: [],
      subChoiceAnswers: new Map(),
      combatStyleIds: [],
      combatStyles: [],
      combatStyleUnlockLevel: 1,
      progChoices: [],
      progChoiceAnswers: new Map(),
      spellInfo: null,
      resolveOptionFeature: () => undefined,
    });
    expect(selection.classId).toBe('cls-guerrier');
    expect(selection.hitDie).toBe(10);
    expect(selection.classFeatures.some((f) => f.refId === 'feat-second-souffle')).toBeTrue();
    const prog = buildClassProgressionChoicesFromWizard({
      cls,
      subclass: null,
      targetLevel: 1,
      proficiencyBonus: 2,
      featureDetails: [],
      subChoices: [],
      subChoiceAnswers: new Map(),
      combatStyleIds: [],
      combatStyles: [],
      combatStyleUnlockLevel: 1,
      progChoices: [],
      progChoiceAnswers: new Map(),
      spellInfo: null,
      resolveOptionFeature: () => undefined,
    });
    expect(prog.classChoiceAnswers).toEqual({});
    expect(prog.extraFeatures).toEqual([]);
  });
});

