import type { Ability, CharacterClass, FeatureDetail, Subclass } from '@core/models/CharacterClasses/character-class';
import type {
  AbilityScores,
  FeatureInstance,
  SpellcastingKind,
} from '@core/models/Character/character';
import { annotateAuraDesc } from './aura-range.util';
import {
  extractScalarResources,
  resolveFeatureUses,
  type FeatureUsesInput,
} from './feature-uses.util';
import { proficiencyBonusForLevel } from './character-progression.util';

export function isConcreteStyleRef(id: string): boolean {
  if (!id) return false;
  if (id.includes('style-de-combat')) return false;
  return id.startsWith('style-') || id.startsWith('feat-style-');
}

type ClassFeatureDetail = FeatureUsesInput &
  FeatureDetail & {
    level?: number;
  };

export interface ClassFeatureRefreshInput {
  classId: string;
  subclassId: string | null;
  hasSpellcasting: boolean;
  spellcastingKind: SpellcastingKind | null;
  spellcastingAbility: Ability | null;
  existingClassFeatures: FeatureInstance[];
}

export interface ClassFeatureRefreshResult {
  classFeatures: FeatureInstance[];
  classProgressionResources: Record<string, number | string | null>;
  hasSpellcasting: boolean;
  spellcastingKind: SpellcastingKind | null;
  spellcastingAbility: Ability | null;
}

function listSubclassOptions(data: CharacterClass['data']): Subclass[] {
  const raw = data.subclasses;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.options ?? [];
}

export { listSubclassOptions };

export function buildClassFeaturesForLevel(
  cls: CharacterClass,
  input: ClassFeatureRefreshInput,
  targetLevel: number,
): ClassFeatureRefreshResult {
  const features: FeatureInstance[] = [];
  const progression = cls.data.progression ?? [];
  const details = (cls.data.features_details ?? []) as ClassFeatureDetail[];
  const profBonus = proficiencyBonusForLevel(targetLevel);

  for (const prog of progression) {
    if (prog.level < 1 || prog.level > targetLevel) continue;
    for (const id of prog.features ?? []) {
      const feat = details.find((f) => f.id === id);
      if (!feat || features.some((f) => f.refId === feat.id)) continue;
      features.push({
        refId: feat.id,
        name: feat.name,
        desc: annotateAuraDesc(feat, targetLevel),
        source: 'class',
        sourceDetail: `${cls.name} ${prog.level}`,
        level: prog.level,
        uses: resolveFeatureUses(feat, cls, targetLevel, profBonus),
      });
    }
  }

  const sub = input.subclassId
    ? listSubclassOptions(cls.data).find((o) => o.id === input.subclassId)
    : null;
  if (sub?.features) {
    for (const feat of sub.features as ClassFeatureDetail[]) {
      if ((feat.level ?? 1) > targetLevel) continue;
      if (features.some((f) => f.refId === feat.id)) continue;
      features.push({
        refId: feat.id,
        name: feat.name,
        desc: annotateAuraDesc(feat, targetLevel),
        source: 'subclass',
        sourceDetail: `${sub.name} ${feat.level ?? 1}`,
        level: feat.level,
        uses: resolveFeatureUses(feat, cls, targetLevel, profBonus),
      });
    }
  }

  const combatStyles = input.existingClassFeatures.filter((f) =>
    isConcreteStyleRef(f.refId ?? ''),
  );

  let hasSpellcasting = input.hasSpellcasting;
  let spellcastingKind = input.spellcastingKind;
  let spellcastingAbility = input.spellcastingAbility;
  if (input.classId === 'cls-paladin' && targetLevel >= 2) {
    hasSpellcasting = true;
    spellcastingKind = 'paladin';
    spellcastingAbility = 'Charisme';
  } else if (input.classId === 'cls-rodeur' && targetLevel >= 2) {
    hasSpellcasting = true;
    spellcastingKind = 'ranger';
    spellcastingAbility = 'Sagesse';
  } else if (
    (input.classId === 'cls-paladin' || input.classId === 'cls-rodeur') &&
    targetLevel < 2
  ) {
    hasSpellcasting = false;
    spellcastingKind = null;
    spellcastingAbility = null;
  }

  const progAtLevel = progression.find((p) => p.level === targetLevel);
  const classProgressionResources = extractScalarResources(progAtLevel?.resources);

  return {
    classFeatures: [...features, ...combatStyles],
    classProgressionResources,
    hasSpellcasting,
    spellcastingKind,
    spellcastingAbility,
  };
}
