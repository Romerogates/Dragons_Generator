export type { Ability, EquipmentSlot } from '../CharacterClasses/character-class';

export type {
  AbilityKey,
  AbilityScores,
  AsiChoiceSlot,
  TalentSpend,
  TalentSpendType,
} from './character-ability';
export {
  ABILITY_IMPACT_DESC,
  ABILITY_KEY_TO_LABEL,
  ABILITY_KEYS,
  ABILITY_LABEL_TO_KEY,
  ABILITY_POINT_COSTS,
  DEFAULT_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  STARTING_POINTS,
  abilityKeyToLabel,
  abilityLabelToKey,
  formatModifier,
  getAbilityModifier,
} from './character-ability';

export type { CatalogRef, ClassRef, Size, SpeciesRef } from './character-refs';
export { SIZES } from './character-refs';

export type { FeatureInstance, FeatureRecharge, FeatureSource, FeatureUses } from './character-features';

export type {
  Ammunition,
  Attack,
  AttackSource,
  CarryCapacity,
  CharacterProficiencies,
  Currency,
  DeathSaves,
  Defense,
  EquipmentInstance,
  EquipmentLocation,
  HitDicePool,
  Movement,
  Senses,
  Vitality,
} from './character-sheet';

export type {
  BardSpellcasting,
  CantripTracker,
  CharacterSpellcasting,
  ClericSpellcasting,
  DivineChannel,
  DruidSpellcasting,
  FighterSpellcasting,
  OathSpellsByLevel,
  PaladinSpellcasting,
  RangerSpellcasting,
  SorcererSpellcasting,
  SoulWeapon,
  SpellInstance,
  SpellSlotPool,
  SpellcastingKind,
  WarlockSpellcasting,
  WizardSpellcasting,
} from './character-spellcasting';

export type { CorruptionTracker, Personality } from './character-personality';

export type { Character } from './character-hero';

export type { Alignment, CharacterCreation } from './character-creation';
export { ALIGNMENTS, CLASS_SPELLCASTING_KIND, CURRENT_SCHEMA_VERSION } from './character-creation';
