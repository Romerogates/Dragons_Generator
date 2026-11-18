import type { AbilityScores, FeatureInstance } from '../models/Character/character';
import type { ExtendedCharacterCreation, SecondaryClassSelection } from '../models/Character/character-builder.types';
import { computeCharacterArmorClass } from './character-combat.util';
import {
  computeAbilityModifiersFromScores,
  computeFinalAbilities,
  computeHitPointsMax,
  computePassivePerception,
  computeSecondaryClassesHitPoints,
} from './character-abilities.util';
import { proficiencyBonusForLevel } from './character-progression.util';
import { creationNeedsMagicStep } from './class-spellcasting.util';

export function secondaryClassesTotalLevel(classes: SecondaryClassSelection[] | undefined): number {
  return (classes ?? []).reduce((sum, sc) => sum + (sc.level || 0), 0);
}

export function totalCharacterLevel(targetLevel: number, secondaryTotal: number): number {
  return Math.min(20, (targetLevel || 1) + secondaryTotal);
}

export function deriveFinalAbilities(creation: ExtendedCharacterCreation): AbilityScores {
  return computeFinalAbilities(creation.baseAbilities, creation.racialBonuses, creation.asiBonuses ?? {});
}

export function deriveHitPointsMax(
  creation: ExtendedCharacterCreation,
  constitutionMod: number,
): number {
  const primary = computeHitPointsMax({
    targetLevel: creation.targetLevel || 1,
    hpAtLevel1: creation.hpAtLevel1,
    hpPerLevelAverage: creation.hpPerLevelAverage,
    hitDie: creation.hitDie,
    constitutionMod,
    classId: creation.classId,
    subclassId: creation.subclassId,
    subspeciesId: creation.subspeciesId,
    classFeatures: creation.classFeatures ?? [],
  });
  return primary + computeSecondaryClassesHitPoints(creation.secondaryClasses ?? [], constitutionMod);
}

export function deriveBaseArmorClass(
  creation: ExtendedCharacterCreation,
  modifiers: AbilityScores,
): number {
  const allEquipment = [...creation.selectedEquipment, ...(creation.backgroundEquipment ?? [])];
  return computeCharacterArmorClass(allEquipment, modifiers, {
    classId: creation.classId,
    subclassId: creation.subclassId,
    classFeatures: creation.classFeatures as FeatureInstance[] | undefined,
  });
}

export function derivePassivePerception(
  creation: ExtendedCharacterCreation,
  wisdomMod: number,
  proficiencyBonus: number,
): number {
  const hasPerception =
    creation.selectedSkills.includes('skill-perception') ||
    creation.backgroundSkills.includes('skill-perception');
  return computePassivePerception(wisdomMod, hasPerception, proficiencyBonus);
}

export function deriveWoundThreshold(hitPointsMax: number): number {
  return Math.ceil(hitPointsMax / 2);
}

export function deriveBuilderCombatSnapshot(creation: ExtendedCharacterCreation): {
  finalAbilities: AbilityScores;
  abilityModifiers: AbilityScores;
  secondaryClassesTotalLevel: number;
  totalCharacterLevel: number;
  hitPointsMax: number;
  proficiencyBonus: number;
  woundThreshold: number;
  baseArmorClass: number;
  initiative: number;
  passivePerception: number;
  needsMagicStep: boolean;
} {
  const finalAbilities = deriveFinalAbilities(creation);
  const abilityModifiers = computeAbilityModifiersFromScores(finalAbilities);
  const secondaryTotal = secondaryClassesTotalLevel(creation.secondaryClasses);
  const totalLevel = totalCharacterLevel(creation.targetLevel || 1, secondaryTotal);
  const proficiencyBonus = proficiencyBonusForLevel(totalLevel);
  const hitPointsMax = deriveHitPointsMax(creation, abilityModifiers.constitution);
  return {
    finalAbilities,
    abilityModifiers,
    secondaryClassesTotalLevel: secondaryTotal,
    totalCharacterLevel: totalLevel,
    hitPointsMax,
    proficiencyBonus,
    woundThreshold: deriveWoundThreshold(hitPointsMax),
    baseArmorClass: deriveBaseArmorClass(creation, abilityModifiers),
    initiative: abilityModifiers.dexterite,
    passivePerception: derivePassivePerception(creation, abilityModifiers.sagesse, proficiencyBonus),
    needsMagicStep: creationNeedsMagicStep(creation),
  };
}
