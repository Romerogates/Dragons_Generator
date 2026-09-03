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

  it('isWizardStepValid gates species, class and languages', () => {
    expect(isWizardStepValid(1, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(1, { ...base, speciesId: 'sp-humain' }, { needsMagicStep: false }),
    ).toBeTrue();
    expect(isWizardStepValid(4, { ...base, classId: 'cls-guerrier' }, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        4,
        { ...base, classId: 'cls-guerrier', hitDie: 10 },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(isWizardStepValid(6, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        6,
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
      isWizardStepValid(8, { ...base, languages: ['Commun'] }, { needsMagicStep: false }),
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
    expect(isWizardStepValid(9, withMagic, { needsMagicStep: true })).toBeTrue();
    expect(
      isWizardStepValid(9, { ...withMagic, spellcastingDetails: {} }, { needsMagicStep: true }),
    ).toBeFalse();
    expect(
      isWizardStepValid(9, { ...base, name: 'Aldric' }, { needsMagicStep: false }),
    ).toBeTrue();
  });

  it('isWizardStepValid requires bonus languages to be picked', () => {
    expect(
      isWizardStepValid(
        8,
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
        8,
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
        8,
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
        5,
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
        5,
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
        5,
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
        5,
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
        5,
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
        5,
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
    expect(isWizardStepValid(5, { ...base, pointsRemaining: 3 }, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(5, { ...base, pointsRemaining: 0 }, { needsMagicStep: false }),
    ).toBeTrue();
    expect(isWizardStepValid(7, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        7,
        { ...base, selectedEquipment: [{ instanceId: '1', refId: 'wp-dagger', name: 'Dague', qty: 1 }] as never },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid covers optional steps and unknown step', () => {
    expect(isWizardStepValid(6, { ...base, classId: 'cls-guerrier' }, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(10, base, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(11, base, { needsMagicStep: true })).toBeTrue();
    expect(isWizardStepValid(99, base, { needsMagicStep: false })).toBeFalse();
    expect(racialSpellsComplete({ ...base, racialSpellGrants: [] })).toBeTrue();
  });

  it('isWizardStepValid requires identity on step 10 when magic step active', () => {
    expect(isWizardStepValid(10, { ...base, name: '' }, { needsMagicStep: true })).toBeFalse();
    expect(isWizardStepValid(10, { ...base, name: 'Hero' }, { needsMagicStep: true })).toBeTrue();
  });
});
