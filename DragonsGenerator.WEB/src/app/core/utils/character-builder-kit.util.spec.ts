import {
  INITIAL_CREATION_STATE,
  type SecondaryClassSelection,
} from '../models/Character/character-builder.types';
import {
  addLanguageInCreation,
  applyAbilityScore,
  applyAbilityScoresBulk,
  applyAsiChoiceSimple,
  applyCurrencyInCreation,
  mergeClassProficienciesInCreation,
  patchSecondaryClassInCreation,
  resetAbilitiesInCreation,
  setLanguagesInCreation,
  toggleSkillInCreation,
  updateSecondaryClassLevelInCreation,
} from './character-builder-kit.util';

describe('character-builder-kit.util', () => {
  it('met à jour un niveau secondaire et ignore un index vide', () => {
    const withSec = {
      ...INITIAL_CREATION_STATE,
      secondaryClasses: [{ classId: 'cls-barde', className: 'Barde', level: 1 } as SecondaryClassSelection],
    };
    expect(updateSecondaryClassLevelInCreation(withSec, 0, 3).secondaryClasses?.[0].level).toBe(3);
    expect(updateSecondaryClassLevelInCreation(withSec, 2, 3)).toBe(withSec);
  });

  it('applique un score et refuse hors budget', () => {
    const next = applyAbilityScore(INITIAL_CREATION_STATE, 'force', 9);
    expect(next?.baseAbilities.force).toBe(9);
    expect(applyAbilityScore(INITIAL_CREATION_STATE, 'force', 20)).toBeNull();
  });

  it('reset / langues / toggle skill / ASI simple', () => {
    const spent = applyAbilityScore(INITIAL_CREATION_STATE, 'force', 10)!;
    const reset = resetAbilitiesInCreation(spent);
    expect(reset.baseAbilities.force).toBe(10);
    expect(setLanguagesInCreation(reset, ['Commun']).languages).toEqual(['Commun']);
    const withCount = { ...reset, skillChooseCount: 2, selectedSkills: [] };
    expect(toggleSkillInCreation(withCount, 'ski-a').selectedSkills).toEqual(['ski-a']);
    expect(applyAsiChoiceSimple(reset, { force: 1 }, 'feat-x').selectedFeatId).toBe('feat-x');
  });

  it('clamp scores hors plage, currency, langues et patch secondaire', () => {
    const bulk = applyAbilityScoresBulk(
      INITIAL_CREATION_STATE,
      { ...INITIAL_CREATION_STATE.baseAbilities, force: 99 },
      3,
    );
    expect(bulk.baseAbilities.force).toBe(10);
    expect(bulk.pointsRemaining).toBe(3);
    expect(applyCurrencyInCreation(bulk, { or: 12 }).currency.or).toBe(12);
    expect(addLanguageInCreation({ ...bulk, languages: ['Commun'] }, 'Elfique').languages).toContain(
      'Elfique',
    );
    const withSec = {
      ...INITIAL_CREATION_STATE,
      secondaryClasses: [{ classId: 'cls-barde', className: 'Barde', level: 1 } as SecondaryClassSelection],
    };
    expect(patchSecondaryClassInCreation(withSec, 0, { level: 2 }).secondaryClasses?.[0].level).toBe(2);
    expect(patchSecondaryClassInCreation(withSec, 9, { level: 2 })).toBe(withSec);
    const merged = mergeClassProficienciesInCreation(bulk, ['wp-epee'], ['tl-kit'], { c1: ['a'] });
    expect(merged.weaponProficiencies).toContain('wp-epee');
    expect(merged.classChoiceAnswers['c1']).toEqual(['a']);
  });
});
