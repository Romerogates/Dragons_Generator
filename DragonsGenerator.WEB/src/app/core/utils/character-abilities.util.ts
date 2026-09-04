import type {
  AbilityKey,
  AbilityScores,
  AsiChoiceSlot,
  FeatureInstance,
  SpellInstance,
} from '@core/models/Character/character';
import {
  ABILITY_POINT_COSTS,
  ABILITY_KEYS,
  getAbilityModifier,
} from '@core/models/Character/character';
import type { Spell } from '@core/models/Spells/spell';
import {
  featAsiValue,
  featBonusArmorProficiencies,
  featBonusToolProficiencies,
  featDarkvisionRadius,
  resolveFeatAsiAbilityKey,
  type RawFeatData,
} from '@core/utils/feat-benefits.util';

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

/** Inverse de `computeFinalAbilities` (sans clamp) : scores de point-buy à partir du total sauvegardé. */
export function subtractPartialScores(
  total: AbilityScores,
  ...parts: Partial<AbilityScores>[]
): AbilityScores {
  const next: AbilityScores = { ...total };
  for (const part of parts) {
    for (const key of ABILITY_KEYS) {
      next[key] = next[key] - (part[key] ?? 0);
    }
  }
  return next;
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
  /** Sous-espèce, pour les bonus de PV/niveau raciaux (ex. Nain bâtisseur). */
  subspeciesId?: string | null;
}

/** Sous-espèces accordant un bonus de PV max fixe à chaque niveau (trait `hp_per_level_bonus`). */
const SPECIES_HP_PER_LEVEL_BONUS: Record<string, number> = {
  'sp-nain-batisseur': 1, // Trait "Robustesse naine"
};

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

  const speciesBonus = input.subspeciesId ? SPECIES_HP_PER_LEVEL_BONUS[input.subspeciesId] : undefined;
  if (speciesBonus) hp += speciesBonus * level;

  return hp;
}

/**
 * PV apportés par les classes de multiclassage (RAW : jamais de "PV max au niveau 1" — cette
 * ligne n'existe que pour la toute première classe/niveau 1 du personnage, déjà comptée par
 * `computeHitPointsMax` ci-dessus). Chaque niveau de chaque classe secondaire ajoute
 * `hpPerLevelAverage + modificateur de Constitution`.
 */
export function computeSecondaryClassesHitPoints(
  secondaryClasses: { level: number; hitDie: number; hpPerLevelAverage: number }[],
  constitutionMod: number,
): number {
  return secondaryClasses.reduce((sum, entry) => {
    const level = Math.max(0, entry.level || 0);
    const avg =
      entry.hpPerLevelAverage > 0
        ? entry.hpPerLevelAverage
        : Math.floor((entry.hitDie || 8) / 2) + 1;
    return sum + level * (avg + constitutionMod);
  }, 0);
}

export function computePassivePerception(
  wisdomMod: number,
  hasPerceptionProficiency: boolean,
  proficiencyBonus: number,
): number {
  return 10 + wisdomMod + (hasPerceptionProficiency ? proficiencyBonus : 0);
}

export function aggregateAsiChoices(
  slots: AsiChoiceSlot[],
  ctx?: {
    feats?: Map<string, RawFeatData>;
    spellcastingAbility?: AbilityKey | null;
    spells?: Map<string, Spell>;
  },
): {
  bonuses: Partial<AbilityScores>;
  featIds: string[];
  featDarkvisionRadius: number;
  featBonusArmor: string[];
  featBonusTools: string[];
  featResistances: string[];
  /** Système "Talent" (don `don-talent`, 4 points flexibles) : agrégats des dépenses choisies. */
  talentBonusSkills: string[];
  talentExpertiseSkills: string[];
  talentBonusWeapons: string[];
  talentSavingThrows: string[];
  talentBonusLanguageCount: number;
  talentRequiredExoticLanguages: number;
  talentBonusCantrips: SpellInstance[];
} {
  const bonuses: Partial<AbilityScores> = {};
  const featIds: string[] = [];
  let darkvisionRadius = 0;
  const bonusArmor = new Set<string>();
  const bonusTools = new Set<string>();
  const resistances = new Set<string>();
  const talentSkills = new Set<string>();
  const talentExpertise = new Set<string>();
  const talentWeapons = new Set<string>();
  const talentSaves = new Set<string>();
  let talentBonusLanguageCount = 0;
  let talentRequiredExoticLanguages = 0;
  const talentCantrips: SpellInstance[] = [];

  for (const slot of slots) {
    if (slot.mode === 'feat' && slot.featId) {
      featIds.push(slot.featId);
      const feat = ctx?.feats?.get(slot.featId);
      if (feat) {
        const value = featAsiValue(feat);
        if (value > 0) {
          const key = resolveFeatAsiAbilityKey(
            feat,
            ctx?.spellcastingAbility ?? null,
            slot.featAbilityChoice,
          );
          if (key) bonuses[key] = (bonuses[key] ?? 0) + value;
        }
        darkvisionRadius = Math.max(darkvisionRadius, featDarkvisionRadius(feat));
        featBonusArmorProficiencies(feat).forEach((id) => bonusArmor.add(id));
        featBonusToolProficiencies(feat).forEach((id) => bonusTools.add(id));
        if (slot.featResistanceChoice) resistances.add(slot.featResistanceChoice);
      }

      // Don "Talent" (système à 4 points flexibles) : chaque dépense choisie applique son propre
      // bénéfice mécanique (compétence, outil, arme, langues, JS, +1 carac, armure, expertise…).
      for (const spend of slot.featTalentSpends ?? []) {
        switch (spend.type) {
          case 'skill':
            if (spend.skillId) talentSkills.add(spend.skillId);
            break;
          case 'tool':
            if (spend.toolId) bonusTools.add(spend.toolId);
            break;
          case 'weapon':
            if (spend.weaponId) talentWeapons.add(spend.weaponId);
            break;
          case 'languages_common':
            talentBonusLanguageCount += 2;
            break;
          case 'saving_throw':
            if (spend.savingThrow) talentSaves.add(spend.savingThrow);
            break;
          case 'language_exotic':
            talentBonusLanguageCount += 1;
            talentRequiredExoticLanguages += 1;
            break;
          case 'ability_score':
            if (spend.abilityKey) bonuses[spend.abilityKey] = (bonuses[spend.abilityKey] ?? 0) + 1;
            break;
          case 'armor':
            if (spend.armorTier) bonusArmor.add(spend.armorTier);
            break;
          case 'expertise':
            if (spend.expertiseSkillId) talentExpertise.add(spend.expertiseSkillId);
            break;
          case 'cantrips':
            for (const spellId of spend.cantripIds ?? []) {
              const raw = ctx?.spells?.get(spellId);
              talentCantrips.push({
                refId: spellId,
                name: raw?.name ?? spellId.replace(/^spl-/, '').replace(/-/g, ' '),
                level: 0,
                prepared: true,
                alwaysPrepared: true,
                effectSummary: `Talent (sort mineur) · ${(raw?.description ?? '').slice(0, 100)}`,
              });
            }
            break;
          case 'attack_bonus':
            // Bonus situationnel aux jets d'attaque avec une catégorie d'arme : non modélisé dans
            // le moteur de combat actuel (pas de calcul par catégorie), conservé à titre indicatif
            // dans `featTalentSpends` pour affichage seulement.
            break;
        }
      }
      continue;
    }
    if (slot.mode === 'plus2' && slot.primary) {
      bonuses[slot.primary] = (bonuses[slot.primary] ?? 0) + 2;
    } else if (slot.mode === 'plus1plus1' && slot.primary && slot.secondary) {
      bonuses[slot.primary] = (bonuses[slot.primary] ?? 0) + 1;
      bonuses[slot.secondary] = (bonuses[slot.secondary] ?? 0) + 1;
    }
  }
  return {
    bonuses,
    featIds,
    featDarkvisionRadius: darkvisionRadius,
    featBonusArmor: [...bonusArmor],
    featBonusTools: [...bonusTools],
    featResistances: [...resistances],
    talentBonusSkills: [...talentSkills],
    talentExpertiseSkills: [...talentExpertise],
    talentBonusWeapons: [...talentWeapons],
    talentSavingThrows: [...talentSaves],
    talentBonusLanguageCount,
    talentRequiredExoticLanguages,
    talentBonusCantrips: talentCantrips,
  };
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
