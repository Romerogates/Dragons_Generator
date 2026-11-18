import { isWizardStepValid } from '../character-wizard-validation.util';
import { base } from './spec-helpers';

describe('character-wizard-validation steps complete', () => {
  it('asiChoicesComplete defaults a missing asiChoices array to empty (always valid)', () => {
    expect(
      isWizardStepValid(6, { ...base, pointsRemaining: 0, asiChoices: undefined as never }, { needsMagicStep: false }),
    ).toBeTrue();
  });
  it('asiChoicesComplete requires Talent flexible spends (4 pts) like abilities-step', () => {
    const incompleteTalent = {
      ...base,
      pointsRemaining: 0,
      asiChoices: [
        {
          level: 4,
          mode: 'feat' as const,
          featId: 'feat-talent',
          featTalentSpends: [],
        },
      ],
    };
    expect(isWizardStepValid(6, incompleteTalent, { needsMagicStep: false })).toBeFalse();

    const completeTalent = {
      ...incompleteTalent,
      asiChoices: [
        {
          level: 4,
          mode: 'feat' as const,
          featId: 'feat-talent',
          featTalentSpends: [
            { id: 't1', type: 'skill' as const, skillId: 'skill-arcanes' },
            { id: 't2', type: 'skill' as const, skillId: 'skill-histoire' },
            { id: 't3', type: 'tool' as const, toolId: 'tl-alchimiste' },
            { id: 't4', type: 'weapon' as const, weaponId: 'wp-dague' },
          ],
        },
      ],
    };
    expect(isWizardStepValid(6, completeTalent, { needsMagicStep: false })).toBeTrue();
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
  it('languagesStepComplete requires exotic and base remaining among bonus picks', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Elfique'],
          bonusLanguageCount: 2,
          requiredExoticLanguageCount: 1,
          requiredBaseLanguageCount: 1,
          speciesLanguages: [],
          civilizationLanguages: [],
          backgroundLanguages: [],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Draconique'],
          bonusLanguageCount: 2,
          requiredExoticLanguageCount: 1,
          requiredBaseLanguageCount: 1,
          speciesLanguages: [],
          civilizationLanguages: [],
          backgroundLanguages: [],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });
});
