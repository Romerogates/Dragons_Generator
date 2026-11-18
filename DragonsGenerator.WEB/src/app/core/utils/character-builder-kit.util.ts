import type {
  AbilityKey,
  AbilityScores,
  AsiChoiceSlot,
  Currency,
  EquipmentInstance,
  EquipmentSlot,
} from '../models/Character/character';
import {
  ABILITY_POINT_COSTS,
  DEFAULT_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  STARTING_POINTS,
} from '../models/Character/character';
import type {
  ExtendedCharacterCreation,
  IdentitySelection,
  SecondaryClassSelection,
} from '../models/Character/character-builder.types';
import { canAffordAbilityScore } from './character-abilities.util';
import {
  mergeToolProficiencies,
  mergeWeaponProficiencies,
  toggleSkillSelection,
} from './character-proficiencies.util';

export function updateSecondaryClassLevelInCreation(
  c: ExtendedCharacterCreation,
  index: number,
  level: number,
): ExtendedCharacterCreation {
  const list = [...(c.secondaryClasses ?? [])];
  if (!list[index]) return c;
  const clamped = Math.max(1, Math.floor(Number(level)) || 1);
  list[index] = { ...list[index], level: clamped };
  return { ...c, secondaryClasses: list };
}

export function patchSecondaryClassInCreation(
  c: ExtendedCharacterCreation,
  index: number,
  patch: Partial<Omit<SecondaryClassSelection, 'classId'>>,
): ExtendedCharacterCreation {
  const list = [...(c.secondaryClasses ?? [])];
  if (!list[index]) return c;
  list[index] = { ...list[index], ...patch };
  return { ...c, secondaryClasses: list };
}

export function mergeClassProficienciesInCreation(
  c: ExtendedCharacterCreation,
  extraWeapons: string[],
  extraTools: string[],
  choiceAnswers: Record<string, string[]>,
): ExtendedCharacterCreation {
  return {
    ...c,
    weaponProficiencies: mergeWeaponProficiencies(c.weaponProficiencies ?? [], extraWeapons),
    toolProficiencies: mergeToolProficiencies(c.toolProficiencies ?? [], extraTools),
    classChoiceAnswers: { ...c.classChoiceAnswers, ...choiceAnswers },
  };
}

export function applyAbilityScore(
  c: ExtendedCharacterCreation,
  key: AbilityKey,
  value: number,
): ExtendedCharacterCreation | null {
  if (value < MIN_ABILITY_SCORE || value > MAX_ABILITY_SCORE) return null;
  const current = c.baseAbilities[key];
  if (!canAffordAbilityScore(current, value, c.pointsRemaining)) return null;
  const currentCost = ABILITY_POINT_COSTS[current] ?? 0;
  const newCost = ABILITY_POINT_COSTS[value] ?? 0;
  return {
    ...c,
    baseAbilities: { ...c.baseAbilities, [key]: value },
    pointsRemaining: c.pointsRemaining + currentCost - newCost,
  };
}

export function applyAbilityScoresBulk(
  c: ExtendedCharacterCreation,
  scores: AbilityScores,
  pointsRemaining = 0,
): ExtendedCharacterCreation {
  const next: AbilityScores = { ...scores };
  for (const key of Object.keys(next) as AbilityKey[]) {
    const v = next[key];
    if (v < MIN_ABILITY_SCORE || v > MAX_ABILITY_SCORE) next[key] = DEFAULT_ABILITY_SCORE;
  }
  return {
    ...c,
    baseAbilities: next,
    pointsRemaining: Math.max(0, Math.floor(pointsRemaining)),
  };
}

export function resetAbilitiesInCreation(c: ExtendedCharacterCreation): ExtendedCharacterCreation {
  return {
    ...c,
    baseAbilities: {
      force: DEFAULT_ABILITY_SCORE,
      dexterite: DEFAULT_ABILITY_SCORE,
      constitution: DEFAULT_ABILITY_SCORE,
      intelligence: DEFAULT_ABILITY_SCORE,
      sagesse: DEFAULT_ABILITY_SCORE,
      charisme: DEFAULT_ABILITY_SCORE,
    },
    pointsRemaining: STARTING_POINTS,
  };
}

export function setEquipmentInCreation(
  c: ExtendedCharacterCreation,
  items: EquipmentInstance[],
  wizardPicks?: { alt: Record<string, number>; category: Record<string, string[]> } | null,
): ExtendedCharacterCreation {
  return {
    ...c,
    selectedEquipment: items,
    equipmentWizardPicks: wizardPicks ?? c.equipmentWizardPicks ?? null,
  };
}

export function setLanguagesInCreation(
  c: ExtendedCharacterCreation,
  languages: string[],
): ExtendedCharacterCreation {
  return { ...c, languages };
}

export function addLanguageInCreation(
  c: ExtendedCharacterCreation,
  language: string,
): ExtendedCharacterCreation {
  return { ...c, languages: [...new Set([...c.languages, language])] };
}

export function applyIdentityInCreation(
  c: ExtendedCharacterCreation,
  identity: IdentitySelection,
): ExtendedCharacterCreation {
  return { ...c, ...identity };
}

export function applyProficienciesInCreation(
  c: ExtendedCharacterCreation,
  classSkills: string[],
  bgSkills: string[],
  bgTools: string[],
  toolSlots: EquipmentSlot[],
): ExtendedCharacterCreation {
  return {
    ...c,
    selectedSkills: classSkills,
    backgroundSkills: bgSkills,
    backgroundTools: bgTools,
    toolEquipmentSlots: toolSlots,
  };
}

export function applyCurrencyInCreation(
  c: ExtendedCharacterCreation,
  currency: Partial<Currency>,
): ExtendedCharacterCreation {
  return { ...c, currency: { ...c.currency, ...currency } };
}

export function toggleSkillInCreation(
  c: ExtendedCharacterCreation,
  skill: string,
): ExtendedCharacterCreation {
  return {
    ...c,
    selectedSkills: toggleSkillSelection(c.selectedSkills, skill, c.skillChooseCount),
  };
}

export function applyAsiChoiceSimple(
  c: ExtendedCharacterCreation,
  bonuses: Partial<AbilityScores>,
  featId: string | null,
): ExtendedCharacterCreation {
  return {
    ...c,
    asiBonuses: bonuses,
    selectedFeatId: featId,
    selectedFeatIds: featId ? [featId] : [],
    asiChoices: [] as AsiChoiceSlot[],
  };
}
