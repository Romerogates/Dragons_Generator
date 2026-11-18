import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import type { ClassSelection, SecondaryClassSelection, SpeciesSelection } from '@core/models/Character/character-builder.types';
import { stripProgressionChoiceFeatures } from './character-proficiencies.util';
import {
  addSecondaryClassSelection,
  applyBackgroundSelection,
  applyCivilizationSelection,
  applyClassProgressionChoices,
  applyClassSelection,
  applySpeciesSelection,
  clearBackgroundSelection,
  clearCivilizationSelection,
  clearClassSelection,
  clearSpeciesSelection,
  removeSecondaryClassSelection,
} from './character-builder-creation.util';

function species(partial: Partial<SpeciesSelection> = {}): SpeciesSelection {
  return {
    speciesId: 'sp-elfe',
    speciesName: 'Elfe',
    subspeciesId: null,
    subspeciesName: null,
    racialBonuses: { dexterite: 2 },
    traits: [],
    speed: 9,
    size: 'M',
    languages: ['Commun', 'Elfique'],
    bonusLanguageCount: 0,
    bonusSkillCount: 0,
    bonusToolCount: 0,
    bonusToolPoolIds: [],
    bonusToolChoiceLabel: '',
    resistances: [],
    hasDarkvision: true,
    darkvisionRadius: 18,
    bonusSkills: [],
    bonusWeapons: [],
    bonusArmor: [],
    bonusTools: [],
    innateSpells: [],
    choiceAnswers: {},
    racialSpellGrants: [],
    ...partial,
  };
}

function cls(partial: Partial<ClassSelection> = {}): ClassSelection {
  return {
    classId: 'cls-guerrier',
    className: 'Guerrier',
    hitDie: 10,
    hasSpellcasting: false,
    spellcastingKind: null,
    spellcastingAbility: null,
    savingThrows: ['Force', 'Constitution'],
    armorProficiencies: ['ar-legere'],
    weaponProficiencies: ['wp-cat-simple'],
    toolProficiencies: [],
    skillOptions: ['skill-athletisme'],
    skillChooseCount: 2,
    classFeatures: [{ refId: 'feat-second-souffle', name: 'Second souffle', desc: '', source: 'class' }],
    startingEquipmentSlots: [],
    ...partial,
  };
}

describe('character-builder-creation.util', () => {
  it('applies and clears species language bonuses', () => {
    const withSpecies = applySpeciesSelection(structuredClone(INITIAL_CREATION_STATE), species({ bonusLanguageCount: 1 }));
    expect(withSpecies.speciesId).toBe('sp-elfe');
    expect(withSpecies.bonusLanguageCount).toBe(1);
    expect(withSpecies.languages).toContain('Elfique');
    const cleared = clearSpeciesSelection(withSpecies);
    expect(cleared.speciesId).toBeNull();
    expect(cleared.bonusLanguageCount).toBe(0);
  });

  it('applies class selection and resets downstream unless preserveProgress', () => {
    const base = { ...structuredClone(INITIAL_CREATION_STATE), selectedSkills: ['skill-athletisme'] };
    const applied = applyClassSelection(base, cls({ classBonusLanguageCount: 2 }));
    expect(applied.classId).toBe('cls-guerrier');
    expect(applied.selectedSkills).toEqual([]);
    expect(applied.bonusLanguageCount).toBe(2);
    const preserved = applyClassSelection(
      { ...applied, selectedSkills: ['skill-athletisme'] },
      cls(),
      { preserveProgress: true },
    );
    expect(preserved.selectedSkills).toEqual(['skill-athletisme']);
  });

  it('clears class and secondary classes together', () => {
    const withClass = applyClassSelection(structuredClone(INITIAL_CREATION_STATE), cls());
    const withSecondary = addSecondaryClassSelection(withClass, {
      classId: 'cls-roublard',
      className: 'Roublard',
      level: 1,
    } as SecondaryClassSelection);
    expect(withSecondary.secondaryClasses?.length).toBe(1);
    expect(addSecondaryClassSelection(withSecondary, withSecondary.secondaryClasses![0])).toBe(withSecondary);
    const removed = removeSecondaryClassSelection(withSecondary, 0);
    expect(removed.secondaryClasses).toEqual([]);
    expect(clearClassSelection(withSecondary).classId).toBeNull();
  });

  it('applies civilization and background then clears them', () => {
    const withCiv = applyCivilizationSelection(structuredClone(INITIAL_CREATION_STATE), {
      civilizationId: 'civ-cyfand',
      civilizationName: 'Cyfand',
      languages: ['Cyfand'],
      writingSystems: [],
    });
    expect(withCiv.civilizationId).toBe('civ-cyfand');
    expect(clearCivilizationSelection(withCiv).civilizationId).toBeNull();
    const withBg = applyBackgroundSelection(structuredClone(INITIAL_CREATION_STATE), {
      backgroundId: 'bg-erudit',
      backgroundName: 'Érudit',
      backgroundPreset: true,
      skills: ['skill-histoire'],
      tools: [],
      languages: [],
      bonusLanguageCount: 1,
      equipmentSlots: [],
      equipment: [],
      currency: { cuivre: 0, argent: 0, or: 10, platine: 0 },
      privilegeId: null,
      privilegeName: null,
      privilegeDesc: null,
      selectedHandicaps: [],
      handicapCompensationType: null,
      backgroundText: 'Un savant',
    });
    expect(withBg.backgroundId).toBe('bg-erudit');
    expect(withBg.bonusLanguageCount).toBe(1);
    expect(clearBackgroundSelection(withBg).backgroundId).toBeNull();
  });

  it('skips duplicate secondary classes and ignores a bad remove index', () => {
    const primary = applyClassSelection(structuredClone(INITIAL_CREATION_STATE), cls());
    expect(addSecondaryClassSelection(primary, { classId: 'cls-guerrier', className: 'Guerrier', level: 1 } as SecondaryClassSelection)).toBe(primary);
    expect(removeSecondaryClassSelection(primary, 9)).toBe(primary);
    const withHpFallback = applyClassSelection(structuredClone(INITIAL_CREATION_STATE), cls({ hpAtLevel1: 0, hpPerLevelAverage: 0 }));
    expect(withHpFallback.hpAtLevel1).toBe(10);
    expect(withHpFallback.hpPerLevelAverage).toBe(6);
  });

  it('fills species optional arrays and ignores missing background skills', () => {
    const applied = applySpeciesSelection(
      { ...structuredClone(INITIAL_CREATION_STATE), speciesBonusLangApplied: undefined, bonusLanguageCount: 0 },
      species({
        bonusSkills: undefined,
        bonusWeapons: undefined,
        bonusArmor: undefined,
        bonusTools: undefined,
        innateSpells: undefined,
        bonusToolPoolIds: undefined,
        bonusToolChoiceLabel: undefined,
      }),
    );
    expect(applied.speciesFixedSkills).toEqual([]);
    expect(applied.speciesBonusToolChoiceLabel).toBe('');
    expect(clearSpeciesSelection({ ...applied, speciesBonusLangApplied: undefined }).speciesId).toBeNull();
    const bg = applyBackgroundSelection(structuredClone(INITIAL_CREATION_STATE), {
      backgroundId: 'bg-x',
      backgroundName: 'X',
      backgroundPreset: true,
      skills: undefined,
      tools: [],
      languages: [],
      bonusLanguageCount: 0,
      equipmentSlots: [],
      equipment: [],
      currency: { cuivre: 0, argent: 0, or: 0, platine: 0 },
      privilegeId: null,
      privilegeName: null,
      privilegeDesc: null,
      selectedHandicaps: [],
      handicapCompensationType: null,
      backgroundText: '',
    } as never);
    expect(bg.backgroundSkills).toEqual([]);
    expect(bg.background).toBe(INITIAL_CREATION_STATE.background);
  });

  it('merges progression extras after stripping previous picks', () => {
    const withClass = applyClassSelection(structuredClone(INITIAL_CREATION_STATE), cls());
    const next = applyClassProgressionChoices(
      withClass,
      {
        classChoiceAnswers: { metamagic: ['mm-soigneuse'] },
        metamagicOptions: ['mm-soigneuse'],
        extraFeatures: [{ refId: 'mm-soigneuse', name: 'Soigneuse', desc: '', source: 'class' }],
      },
      stripProgressionChoiceFeatures,
    );
    expect(next.metamagicOptions).toEqual(['mm-soigneuse']);
    expect(next.classFeatures.some((f) => f.refId === 'mm-soigneuse')).toBeTrue();
    const noExtras = applyClassProgressionChoices(
      { ...withClass, classFeatures: undefined as never, metamagicOptions: undefined as never, eldritchInvocations: undefined as never },
      { classChoiceAnswers: {} },
      stripProgressionChoiceFeatures,
    );
    expect(noExtras.metamagicOptions).toEqual([]);
    expect(addSecondaryClassSelection({ ...INITIAL_CREATION_STATE, secondaryClasses: undefined }, {
      classId: 'cls-barde',
      className: 'Barde',
      level: 1,
    } as SecondaryClassSelection).secondaryClasses?.length).toBe(1);
    expect(
      removeSecondaryClassSelection({ ...INITIAL_CREATION_STATE, secondaryClasses: undefined }, 0).secondaryClasses,
    ).toBeUndefined();
  });
});
