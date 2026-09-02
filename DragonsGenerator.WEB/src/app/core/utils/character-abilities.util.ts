import type { AbilityScores, AsiChoiceSlot, FeatureInstance } from '@core/models/Character/character';
import {
  ABILITY_POINT_COSTS,
  getAbilityModifier,
} from '@core/models/Character/character';

export function computeFinalAbilities(
  base: AbilityScores,
  racialBonuses: Partial<AbilityScores>,
  asiBonuses: Partial<AbilityScores>,
): AbilityScores {
  const clamp = (n: number) => Math.min(20, n);
  return {
    force: clamp(base.force + (racialBonuses.force ?? 0) + (asiBonuses.force ?? 0)),
    dexterite: clamp(base.dexterite + (racialBonuses.dexterite ?? 0) + (asiBonuses.dexterite ?? 0)),
    constitution: clamp(
      base.constitution + (racialBonuses.constitution ?? 0) + (asiBonuses.constitution ?? 0),
    ),
    intelligence: clamp(
      base.intelligence + (racialBonuses.intelligence ?? 0) + (asiBonuses.intelligence ?? 0),
    ),
    sagesse: clamp(base.sagesse + (racialBonuses.sagesse ?? 0) + (asiBonuses.sagesse ?? 0)),
    charisme: clamp(base.charisme + (racialBonuses.charisme ?? 0) + (asiBonuses.charisme ?? 0)),
  };
}

export function computeAbilityModifiersFromScores(scores: AbilityScores): AbilityScores {
  return {
    force: getAbilityModifier(scores.force),
    dexterite: getAbilityModifier(scores.dexterite),
    constitution: getAbilityModifier(scores.constitution),
    intelligence: getAbilityModifier(scores.intelligence),
    sagesse: getAbilityModifier(scores.sagesse),
    charisme: getAbilityModifier(scores.charisme),
  };
}

export interface HitPointsInput {
  targetLevel: number;
  hpAtLevel1: number;
  hpPerLevelAverage: number;
  hitDie: number;
  constitutionMod: number;
  classId: string | null;
  subclassId: string | null;
  classFeatures: FeatureInstance[];
}

export function computeHitPointsMax(input: HitPointsInput): number {
  const level = Math.min(20, Math.max(1, input.targetLevel || 1));
  const hp1 = input.hpAtLevel1 > 0 ? input.hpAtLevel1 : input.hitDie || 8;
  const hpAvg =
    input.hpPerLevelAverage > 0 ? input.hpPerLevelAverage : Math.floor((input.hitDie || 8) / 2) + 1;
  let hp = hp1 + input.constitutionMod + (level - 1) * (hpAvg + input.constitutionMod);

  const hasDraconic =
    input.subclassId === 'subcls-lignee-draconique' ||
    input.classFeatures.some((f) => f.refId === 'feat-resistance-draconique');
  if (hasDraconic && input.classId === 'cls-ensorceleur') {
    hp += level;
  }
  return hp;
}

export function computePassivePerception(
  wisdomMod: number,
  hasPerceptionProficiency: boolean,
  proficiencyBonus: number,
): number {
  return 10 + wisdomMod + (hasPerceptionProficiency ? proficiencyBonus : 0);
}

export function aggregateAsiChoices(slots: AsiChoiceSlot[]): {
  bonuses: Partial<AbilityScores>;
  featIds: string[];
} {
  const bonuses: Partial<AbilityScores> = {};
  const featIds: string[] = [];
  for (const slot of slots) {
    if (slot.mode === 'feat' && slot.featId) {
      featIds.push(slot.featId);
      continue;
    }
    if (slot.mode === 'plus2' && slot.primary) {
      bonuses[slot.primary] = (bonuses[slot.primary] ?? 0) + 2;
    } else if (slot.mode === 'plus1plus1' && slot.primary && slot.secondary) {
      bonuses[slot.primary] = (bonuses[slot.primary] ?? 0) + 1;
      bonuses[slot.secondary] = (bonuses[slot.secondary] ?? 0) + 1;
    }
  }
  return { bonuses, featIds };
}

export function abilityPointCostForScore(score: number): number {
  return ABILITY_POINT_COSTS[score] ?? 0;
}

export function canAffordAbilityScore(
  currentScore: number,
  nextScore: number,
  pointsRemaining: number,
): boolean {
  const currentCost = abilityPointCostForScore(currentScore);
  const nextCost = abilityPointCostForScore(nextScore);
  return pointsRemaining + currentCost - nextCost >= 0;
}
