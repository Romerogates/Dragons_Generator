import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { buildClassFeaturesForLevel, isConcreteStyleRef } from './character-class-features.util';

describe('character-class-features.util', () => {
  it('isConcreteStyleRef excludes generic combat style placeholders', () => {
    expect(isConcreteStyleRef('style-duel')).toBeTrue();
    expect(isConcreteStyleRef('style-de-combat')).toBeFalse();
    expect(isConcreteStyleRef('')).toBeFalse();
  });

  it('isConcreteStyleRef accepts feat-style prefix', () => {
    expect(isConcreteStyleRef('feat-style-defense')).toBeTrue();
  });

  it('buildClassFeaturesForLevel enables paladin spellcasting at level 2', () => {
    const cls: CharacterClass = {
      id: 'cls-paladin',
      name: 'Paladin',
      data: {
        hit_die: 10,
        primary_abilities: ['Force', 'Charisme'],
        proficiencies: {
          armor: [],
          weapons: [],
          saving_throws: ['Force', 'Charisme'],
          skills: { count: 2, options: [] },
        },
        starting_equipment: [],
        progression: [
          { level: 1, prof_bonus: 2, features: ['feat-divine-sense'] },
          { level: 2, prof_bonus: 2, features: ['feat-fighting-style'] },
        ],
        features_details: [
          { id: 'feat-divine-sense', name: 'Sens divin', desc: '…' },
          { id: 'feat-fighting-style', name: 'Style de combat', desc: '…' },
        ],
      },
    };

    const result = buildClassFeaturesForLevel(
      cls,
      {
        classId: 'cls-paladin',
        subclassId: null,
        hasSpellcasting: false,
        spellcastingKind: null,
        spellcastingAbility: null,
        existingClassFeatures: [],
      },
      2,
    );

    expect(result.hasSpellcasting).toBeTrue();
    expect(result.spellcastingKind).toBe('paladin');
    expect(result.spellcastingAbility).toBe('Charisme');
    expect(result.classFeatures.some((f) => f.refId === 'feat-divine-sense')).toBeTrue();
  });

  it('buildClassFeaturesForLevel disables paladin casting below level 2', () => {
    const cls: CharacterClass = {
      id: 'cls-paladin',
      name: 'Paladin',
      data: {
        hit_die: 10,
        primary_abilities: ['Force'],
        proficiencies: {
          armor: [],
          weapons: [],
          saving_throws: ['Force'],
          skills: { count: 2, options: [] },
        },
        starting_equipment: [],
        progression: [{ level: 1, prof_bonus: 2, features: [] }],
        features_details: [],
      },
    };

    const result = buildClassFeaturesForLevel(
      cls,
      {
        classId: 'cls-paladin',
        subclassId: null,
        hasSpellcasting: true,
        spellcastingKind: 'paladin',
        spellcastingAbility: 'Charisme',
        existingClassFeatures: [],
      },
      1,
    );

    expect(result.hasSpellcasting).toBeFalse();
    expect(result.spellcastingKind).toBeNull();
  });

  it('buildClassFeaturesForLevel keeps concrete combat styles', () => {
    const cls: CharacterClass = {
      id: 'cls-guerrier',
      name: 'Guerrier',
      data: {
        hit_die: 10,
        primary_abilities: ['Force'],
        proficiencies: {
          armor: [],
          weapons: [],
          saving_throws: ['Force'],
          skills: { count: 2, options: [] },
        },
        starting_equipment: [],
        progression: [{ level: 1, prof_bonus: 2, features: [] }],
        features_details: [],
      },
    };

    const style = {
      refId: 'style-duel',
      name: 'Duel',
      desc: '',
      source: 'class' as const,
    };

    const result = buildClassFeaturesForLevel(
      cls,
      {
        classId: 'cls-guerrier',
        subclassId: null,
        hasSpellcasting: false,
        spellcastingKind: null,
        spellcastingAbility: null,
        existingClassFeatures: [style],
      },
      1,
    );

    expect(result.classFeatures.some((f) => f.refId === 'style-duel')).toBeTrue();
  });
});
