import {
  CLASS_SPELLCASTING,
  SUBCLASS_SPELLCASTING,
  buildSecondaryClassSelection,
  collectCasterSources,
  creationNeedsMagicStep,
  primaryCasterSource,
  resolveClassSpellcasting,
} from './class-spellcasting.util';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { SecondaryClassSelection } from '@core/models/Character/character-builder.types';

describe('class-spellcasting.util', () => {
  it('resolveClassSpellcasting returns wizard at level 1 and paladin only from level 2', () => {
    expect(resolveClassSpellcasting('cls-magicien', 1)?.kind).toBe('wizard');
    expect(resolveClassSpellcasting('cls-paladin', 1)).toBeNull();
    expect(resolveClassSpellcasting('cls-paladin', 2)?.kind).toBe('paladin');
    expect(resolveClassSpellcasting('cls-guerrier', 5)).toBeNull();
  });

  it('resolveClassSpellcasting does not treat Élu arcanique as a PHB spellcaster', () => {
    expect(resolveClassSpellcasting('cls-guerrier', 3, 'subcls-elu-arcanique')).toBeNull();
  });

  it('creationNeedsMagicStep is true when a secondary class incants even if the primary does not', () => {
    const c = structuredClone(INITIAL_CREATION_STATE);
    c.classId = 'cls-guerrier';
    c.className = 'Guerrier';
    c.hasSpellcasting = false;
    c.spellcastingKind = null;
    c.secondaryClasses = [
      {
        classId: 'cls-magicien',
        className: 'Magicien',
        subclassId: null,
        subclassName: null,
        level: 3,
        hitDie: 6,
        hpPerLevelAverage: 4,
        hasSpellcasting: true,
        spellcastingKind: 'wizard',
        spellcastingAbility: 'Intelligence',
        armorProficiencies: [],
        weaponProficiencies: [],
        toolProficiencies: [],
        skillChooseCount: 0,
        skillOptions: [],
        classFeatures: [],
      },
    ];
    expect(creationNeedsMagicStep(c)).toBeTrue();
    const sources = collectCasterSources(c);
    expect(sources.length).toBe(1);
    expect(sources[0].classId).toBe('cls-magicien');
    expect(sources[0].isPrimary).toBeFalse();
  });

  it('CLASS_SPELLCASTING stays mutable for auto-build tests', () => {
    expect(CLASS_SPELLCASTING['cls-magicien']?.kind).toBe('wizard');
  });

  it('creationNeedsMagicStep is true for racial grants even without a caster class', () => {
    const c = structuredClone(INITIAL_CREATION_STATE);
    c.classId = 'cls-guerrier';
    c.hasSpellcasting = false;
    c.racialSpellGrants = [
      {
        choiceId: 'elf-cantrip',
        label: 'Sort mineur',
        desc: '',
        pool: ['spl-lumiere'],
        spellLevel: 0,
        spellcastingAbility: 'Intelligence',
      },
    ];
    expect(creationNeedsMagicStep(c)).toBeTrue();
    expect(collectCasterSources(c)).toEqual([]);
  });

  it('falls back to creation flags when the class id is unknown', () => {
    const c = structuredClone(INITIAL_CREATION_STATE);
    c.classId = 'cls-custom-caster';
    c.className = 'Custom';
    c.hasSpellcasting = true;
    c.spellcastingKind = 'wizard';
    c.spellcastingAbility = 'Intelligence';
    const sources = collectCasterSources(c);
    expect(sources[0]?.kind).toBe('wizard');
    expect(primaryCasterSource(c)?.classId).toBe('cls-custom-caster');
  });

  it('falls back to secondary flags when the secondary class id is unknown', () => {
    const c = structuredClone(INITIAL_CREATION_STATE);
    c.classId = 'cls-guerrier';
    c.hasSpellcasting = false;
    const sc: SecondaryClassSelection = {
      classId: 'cls-custom-sec',
      className: 'Sec',
      subclassId: null,
      subclassName: null,
      level: 2,
      hitDie: 6,
      hpPerLevelAverage: 4,
      hasSpellcasting: true,
      spellcastingKind: 'bard',
      spellcastingAbility: 'Charisme',
      armorProficiencies: [],
      weaponProficiencies: [],
      toolProficiencies: [],
      skillChooseCount: 0,
      skillOptions: [],
      classFeatures: [],
    };
    c.secondaryClasses = [sc];
    expect(collectCasterSources(c)[0]?.kind).toBe('bard');
  });

  it('skips a paladin secondary below spellcasting level', () => {
    const c = structuredClone(INITIAL_CREATION_STATE);
    c.classId = 'cls-guerrier';
    c.hasSpellcasting = false;
    c.secondaryClasses = [
      {
        classId: 'cls-paladin',
        className: 'Paladin',
        subclassId: null,
        subclassName: null,
        level: 1,
        hitDie: 10,
        hpPerLevelAverage: 6,
        hasSpellcasting: false,
        spellcastingKind: null,
        spellcastingAbility: null,
        armorProficiencies: [],
        weaponProficiencies: [],
        toolProficiencies: [],
        skillChooseCount: 0,
        skillOptions: [],
        classFeatures: [],
      },
    ];
    expect(creationNeedsMagicStep(c)).toBeFalse();
  });

  it('resolveClassSpellcasting uses subclass table when present', () => {
    SUBCLASS_SPELLCASTING['subcls-test-caster'] = {
      kind: 'wizard',
      ability: 'Intelligence',
      fromLevel: 3,
    };
    try {
      expect(resolveClassSpellcasting('cls-guerrier', 2, 'subcls-test-caster')).toBeNull();
      expect(resolveClassSpellcasting('cls-guerrier', 3, 'subcls-test-caster')?.kind).toBe('wizard');
    } finally {
      delete SUBCLASS_SPELLCASTING['subcls-test-caster'];
    }
  });

  it('buildSecondaryClassSelection copies reduced proficiencies and wizard flags', () => {
    const cls: CharacterClass = {
      id: 'cls-magicien',
      name: 'Magicien',
      data: {
        hit_die: 6,
        primary_abilities: ['Intelligence'],
        proficiencies: {
          armor: [],
          weapons: [],
          saving_throws: ['Intelligence', 'Sagesse'],
          skills: { count: 2, options: [] },
        },
        starting_equipment: [],
        progression: [{ level: 1, prof_bonus: 2, features: [] }],
        features_details: [],
        multiclass_proficiencies: { weapons: ['wp-dague'] },
      } as never,
    };
    const sel = buildSecondaryClassSelection(cls, 3, null, null);
    expect(sel.hasSpellcasting).toBeTrue();
    expect(sel.spellcastingKind).toBe('wizard');
    expect(sel.weaponProficiencies).toEqual(['wp-dague']);
    expect(sel.hpPerLevelAverage).toBe(4);
  });

  it('buildSecondaryClassSelection uses hit die fallback and null spell flags for a non-caster', () => {
    const cls: CharacterClass = {
      id: 'cls-guerrier',
      name: 'Guerrier',
      data: {
        primary_abilities: ['Force'],
        proficiencies: {
          armor: [],
          weapons: [],
          saving_throws: ['Force', 'Constitution'],
          skills: { count: 2, options: [] },
        },
        starting_equipment: [],
        progression: [{ level: 1, prof_bonus: 2, features: [] }],
        features_details: [],
      } as never,
    };
    const sel = buildSecondaryClassSelection(cls, 2, null, null);
    expect(sel.hitDie).toBe(8);
    expect(sel.hasSpellcasting).toBeFalse();
    expect(sel.spellcastingKind).toBeNull();
    expect(sel.spellcastingAbility).toBeNull();
  });

  it('covers empty primary level and missing racial grants on a blank creation', () => {
    const c = structuredClone(INITIAL_CREATION_STATE);
    c.classId = null;
    c.targetLevel = 0;
    c.racialSpellGrants = undefined as never;
    expect(creationNeedsMagicStep(c)).toBeFalse();
    expect(primaryCasterSource(c)).toBeNull();
    expect(collectCasterSources(c)).toEqual([]);
  });
});
