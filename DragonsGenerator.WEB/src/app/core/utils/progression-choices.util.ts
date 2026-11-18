export { PROGRESSION_MAX_LEVEL } from './progression-choices/shared';
export type {
  ProgressionChoiceDef,
  ProgressionChoiceOption,
} from './progression-choices/shared';
export { featureUnlockLevel } from './progression-choices/shared';
export {
  asiLevelsForClass,
  countAsiSlots,
  extractProgressionChoices,
  classNeedsAsi,
} from './progression-choices/extract';
export { warlockArcanumSpellLevels, spellProgressionMilestones } from './progression-choices/spells';
export {
  extractExpertiseChoices,
  extractWeaponProficiencyChoices,
  extractToolProficiencyChoices,
  classBonusLanguageCount,
  classRootRequiredExoticLanguageCount,
  classRootRequiredBaseLanguageCount,
  subclassFixedToolProficiencies,
} from './progression-choices/proficiencies';
export type { SubclassBonusProficiencies, SubclassSkillChoicePool } from './progression-choices/subclass-bonus';
export {
  subclassBonusProficiencies,
  subclassBonusResistances,
  extractSubclassSkillProficiencyChoices,
} from './progression-choices/subclass-bonus';
export type { ClassBonusSenses } from './progression-choices/senses';
export { classBonusSenses, classRootSavingThrowGrants } from './progression-choices/senses';
export { collectProgressionPicksFromAnswers } from './progression-choices/picks';
export type { MulticlassPrerequisites, MulticlassProficiencies } from './progression-multiclass.util';
export {
  multiclassPrerequisitesMet,
  multiclassPrerequisitesPossibleAtMaxBuy,
  multiclassPrerequisiteLabel,
  multiclassProficiencies,
  combinedCasterLevel,
  MULTICLASS_SPELL_SLOTS_TABLE,
  multiclassSpellSlotsForCasterLevel,
} from './progression-multiclass.util';
