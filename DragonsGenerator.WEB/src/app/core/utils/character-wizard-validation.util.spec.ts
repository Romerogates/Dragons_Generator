import type { CharacterCreation } from '@core/models/Character/character';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import {
  isWizardStepValid,
  racialSpellsComplete,
} from './character-wizard-validation.util';

const base = INITIAL_CREATION_STATE as CharacterCreation;

describe('character-wizard-validation.util', () => {
  it('racialSpellsComplete requires each grant to be picked', () => {
    const c = {
      ...base,
      racialSpellGrants: [{ choiceId: 'elf-cantrip', label: '', desc: '', pool: [], spellLevel: 0, spellcastingAbility: 'INT' }],
      speciesChoiceAnswers: {},
    };
    expect(racialSpellsComplete(c)).toBeFalse();
    expect(
      racialSpellsComplete({
        ...c,
        speciesChoiceAnswers: { 'elf-cantrip': ['sp-light'] },
      }),
    ).toBeTrue();
    expect(
      racialSpellsComplete({
        ...c,
        speciesChoiceAnswers: { 'elf-cantrip': ['any_wizard_cantrip'] },
      }),
    ).toBeFalse();
  });

  it('isWizardStepValid always accepts the level step (default value always set)', () => {
    expect(isWizardStepValid(1, base, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(1, { ...base, targetLevel: 12 }, { needsMagicStep: false })).toBeTrue();
  });

  it('isWizardStepValid gates species, class and languages', () => {
    expect(isWizardStepValid(2, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(2, { ...base, speciesId: 'sp-humain' }, { needsMagicStep: false }),
    ).toBeTrue();
    expect(isWizardStepValid(5, { ...base, classId: 'cls-guerrier' }, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-guerrier', hitDie: 10 },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(isWizardStepValid(7, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        7,
        {
          ...base,
          classId: 'cls-guerrier',
          skillChooseCount: 2,
          selectedSkills: ['skill-athletisme', 'skill-intimidation'],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(9, { ...base, languages: ['Commun'] }, { needsMagicStep: false }),
    ).toBeTrue();
  });

  it('isWizardStepValid handles magic step identity vs spellcasting', () => {
    const withMagic = {
      ...base,
      speciesId: 'sp-elf',
      hasSpellcasting: true,
      spellcastingDetails: { cantrips: ['sp-light'] },
      name: 'Aldric',
    };
    expect(isWizardStepValid(10, withMagic, { needsMagicStep: true })).toBeTrue();
    expect(
      isWizardStepValid(10, { ...withMagic, spellcastingDetails: {} }, { needsMagicStep: true }),
    ).toBeFalse();
    expect(
      isWizardStepValid(10, { ...base, name: 'Aldric' }, { needsMagicStep: false }),
    ).toBeTrue();
  });

  it('isWizardStepValid requires bonus languages to be picked', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun'],
          bonusLanguageCount: 1,
          speciesLanguages: ['Commun'],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Elfique'],
          bonusLanguageCount: 1,
          speciesLanguages: ['Commun'],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid counts background languages as locked', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Gobelin'],
          bonusLanguageCount: 2,
          speciesLanguages: ['Commun'],
          backgroundLanguages: ['Gobelin'],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects incomplete ASI choices', () => {
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'plus2', primary: null, secondary: null, featId: null }],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'plus2', primary: 'force', secondary: null, featId: null }],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'feat', primary: null, secondary: null, featId: 'feat-alert' }],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'feat', primary: null, secondary: null, featId: null }],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [
            { level: 8, mode: 'plus1plus1', primary: 'force', secondary: 'dexterite', featId: null },
          ],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [
            { level: 8, mode: 'plus1plus1', primary: 'force', secondary: 'force', featId: null },
          ],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid gates abilities, equipment and languages', () => {
    expect(isWizardStepValid(6, { ...base, pointsRemaining: 3 }, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(6, { ...base, pointsRemaining: 0 }, { needsMagicStep: false }),
    ).toBeTrue();
    expect(isWizardStepValid(8, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        8,
        { ...base, selectedEquipment: [{ instanceId: '1', refId: 'wp-dagger', name: 'Dague', qty: 1 }] as never },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid covers optional steps and unknown step', () => {
    expect(isWizardStepValid(7, { ...base, classId: 'cls-guerrier' }, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(11, base, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(12, base, { needsMagicStep: true })).toBeTrue();
    expect(isWizardStepValid(99, base, { needsMagicStep: false })).toBeFalse();
    expect(racialSpellsComplete({ ...base, racialSpellGrants: [] })).toBeTrue();
  });

  it('isWizardStepValid requires identity on step 11 when magic step active', () => {
    expect(isWizardStepValid(11, { ...base, name: '' }, { needsMagicStep: true })).toBeFalse();
    expect(isWizardStepValid(11, { ...base, name: 'Hero' }, { needsMagicStep: true })).toBeTrue();
  });

  it('isWizardStepValid locks the Druide/Roublard class languages out of the bonus count', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          classId: 'cls-druide',
          languages: ['Langue des druides'],
          bonusLanguageCount: 1,
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          classId: 'cls-roublard',
          languages: ['Commun', 'Argot des voleurs', 'Gobelin'],
          bonusLanguageCount: 1,
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid case 10 (magic step) falls back to cantrips when hasSpellcasting is false', () => {
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: false, spellcastingDetails: { cantrips: ['sp-light'] } },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: false, spellcastingDetails: { cantrips: [] } },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: false, spellcastingDetails: undefined as never },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects an empty languages list even with no bonus needed', () => {
    expect(isWizardStepValid(9, { ...base, languages: [] }, { needsMagicStep: false })).toBeFalse();
  });

  it('isWizardStepValid requires a classId even if hitDie is already set', () => {
    expect(
      isWizardStepValid(5, { ...base, classId: null, hitDie: 10 }, { needsMagicStep: false }),
    ).toBeFalse();
  });

  it('racialSpellsComplete defaults missing grants/answers collections to empty', () => {
    expect(racialSpellsComplete({ racialSpellGrants: undefined as never, speciesChoiceAnswers: undefined as never })).toBeTrue();
  });

  it('asiChoicesComplete defaults a missing asiChoices array to empty (always valid)', () => {
    expect(
      isWizardStepValid(6, { ...base, pointsRemaining: 0, asiChoices: undefined as never }, { needsMagicStep: false }),
    ).toBeTrue();
  });

  it('languagesStepComplete defaults missing species/civilization/background language lists to empty', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun'],
          bonusLanguageCount: 1,
          speciesLanguages: undefined as never,
          civilizationLanguages: undefined as never,
          backgroundLanguages: undefined as never,
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid blocks the magic step when a racial spell grant is still unresolved', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: false,
          spellcastingDetails: { cantrips: ['sp-light'] },
          racialSpellGrants: [
            { choiceId: 'elf-cantrip', label: '', desc: '', pool: ['sp-light'], spellLevel: 0, spellcastingAbility: 'INT' },
          ],
          speciesChoiceAnswers: {},
        },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('skillsStepComplete accepts a class with no skill choice once skills are already populated', () => {
    expect(
      isWizardStepValid(
        7,
        {
          ...base,
          classId: 'cls-moine',
          skillChooseCount: 0,
          speciesBonusSkillCount: 0,
          selectedSkills: ['skill-acrobaties'],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });
});
