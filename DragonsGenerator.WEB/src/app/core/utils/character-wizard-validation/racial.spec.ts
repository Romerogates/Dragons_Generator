import { racialSpellsComplete } from '../character-wizard-validation.util';
import { base } from './spec-helpers';

describe('character-wizard-validation racial', () => {
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
  it('racialSpellsComplete defaults missing grants/answers collections to empty', () => {
    expect(racialSpellsComplete({ racialSpellGrants: undefined as never, speciesChoiceAnswers: undefined as never })).toBeTrue();
  });
  it('racialSpellsComplete rejects unresolved wizard cantrip placeholders', () => {
    expect(
      racialSpellsComplete({
        racialSpellGrants: [
          { choiceId: 'g1', label: '', desc: '', pool: [], spellLevel: 0, spellcastingAbility: 'INT' },
        ],
        speciesChoiceAnswers: { g1: ['any_wizard_cantrip'] },
      }),
    ).toBeFalse();
  });
  it('racialSpellsComplete treats missing speciesChoiceAnswers as empty picks', () => {
    expect(
      racialSpellsComplete({
        racialSpellGrants: [
          { choiceId: 'g1', label: '', desc: '', pool: ['spl-a'], spellLevel: 0, spellcastingAbility: 'INT' },
        ],
        speciesChoiceAnswers: {},
      }),
    ).toBeFalse();
  });
});
