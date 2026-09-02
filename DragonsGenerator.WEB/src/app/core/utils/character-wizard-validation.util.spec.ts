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

  it('isWizardStepValid covers optional steps and unknown step', () => {
    expect(isWizardStepValid(6, base, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(7, base, { needsMagicStep: false })).toBeTrue();
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
