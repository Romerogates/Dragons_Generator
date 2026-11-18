import type { Ability, FeatureInstance } from '@core/models/Character/character';
import type { CharacterClass, Subclass } from '@core/models/CharacterClasses/character-class';
import type { ClassSelection } from '@core/services/character-builder.service';
import { annotateAuraDesc } from '@core/utils/aura-range.util';
import { coerceEquipmentSlots } from '@core/utils/class-data.adapter';
import { extractScalarResources, extractSpellSlotsFromResources, resolveFeatureUses } from '@core/utils/feature-uses.util';
import {
  classBonusLanguageCount,
  classRootRequiredExoticLanguageCount,
  classRootRequiredBaseLanguageCount,
  classBonusSenses,
  classRootSavingThrowGrants,
  extractProgressionChoices,
  featureUnlockLevel,
  subclassBonusProficiencies,
  subclassBonusResistances,
} from '@core/utils/progression-choices.util';
import { pickRandom } from '@core/utils/pregen-random.util';
import { proficiencyBonusForLevel } from '@core/services/character-builder.service';
import { pickRandomSubset } from './random';
import { SAVE_CODE_TO_LABEL, isFightingStylePool, resolveSpellcasting } from './shared';
import { listSubclassOptions, subclassUnlockLevel } from '@core/utils/character-class-features.util';

function pickAutoSubclass(
  cls: CharacterClass,
  level: number,
): { sub: Subclass | null; classChoiceAnswers: Record<string, string[]> } {
  const raw = cls.data.subclasses;
  if (!raw) return { sub: null, classChoiceAnswers: {} };
  const options = listSubclassOptions(cls.data);
  const levelUnlocked = subclassUnlockLevel(raw);
  if (!options.length || level < levelUnlocked) return { sub: null, classChoiceAnswers: {} };

  const sub = pickRandom(options);
  if (!sub) return { sub: null, classChoiceAnswers: {} };

  const classChoiceAnswers: Record<string, string[]> = {};
  for (const sc of sub.sub_choices ?? []) {
    if ((sc.level_required ?? 1) > level) continue;
    if (!sc.options?.length) continue;
    if (!sc.id) continue;
    classChoiceAnswers[sc.id] = pickRandomSubset((sc.options ?? []).map(String), sc.count || 1);
  }

  return { sub, classChoiceAnswers };
}

function resolveClassFeature(
  cls: CharacterClass,
  featureId: string,
  level: number,
  profBonus: number,
): FeatureInstance | null {
  const feat = cls.data.features_details?.find((f) => f.id === featureId);
  if (!feat) return null;
  if (
    (feat as { resolves_to_choice_pool?: string }).resolves_to_choice_pool ||
    /style-de-combat(?!-supplementaire)/i.test(feat.id) ||
    feat.id.includes('style-de-combat')
  ) {
    return null;
  }
  return {
    refId: feat.id,
    name: feat.name ?? feat.id,
    desc: annotateAuraDesc(feat, level),
    source: 'class',
    sourceDetail: cls.name,
    level: feat.level ?? level,
    uses: resolveFeatureUses(feat, cls, level, profBonus),
  };
}

function pickCombatStyles(cls: CharacterClass, level: number): FeatureInstance[] {
  const pools = cls.data.choice_pools ?? [];
  const pool = pools.find((p) => isFightingStylePool(p));
  if (!pool) return [];
  const unlock = 1;
  if (unlock > level) return [];
  const rawPool = pool.pool;
  const styleIds = Array.isArray(rawPool) ? rawPool.map(String) : [];
  const picked = pickRandomSubset(styleIds, 1);
  const details = cls.data.features_details ?? [];
  return picked.map((id) => {
    const feat = details.find((f) => f.id === id);
    const name = (feat?.name ?? id).replace(/^Style de combat\s*:\s*/i, '').trim();
    return {
      refId: id,
      name: `Style : ${name}`,
      desc: feat?.desc ?? 'Style de combat martial.',
      source: 'class' as const,
      sourceDetail: `${cls.name} ${unlock}`,
      level: unlock,
    };
  });
}

export function buildAutoClassSelection(cls: CharacterClass, level = 1): {
  selection: ClassSelection;
  classChoiceAnswers: Record<string, string[]>;
  extraFeatures: FeatureInstance[];
} {
  const prof = cls.data.proficiencies;
  const profBonus = proficiencyBonusForLevel(level);
  const spellInfo = resolveSpellcasting(cls, level);
  const features: FeatureInstance[] = [];
  const progression = cls.data.progression ?? [];

  for (const prog of progression) {
    if (prog.level > level) continue;
    for (const fid of prog.features ?? []) {
      const feat = resolveClassFeature(cls, fid, prog.level, profBonus);
      if (feat) features.push(feat);
    }
  }

  features.push(...pickCombatStyles(cls, level));

  const progAtLevel = progression.find((p) => p.level === level);
  const data = cls.data;

  const { sub, classChoiceAnswers: subChoiceAnswers } = pickAutoSubclass(cls, level);
  for (const feat of sub?.features ?? []) {
    if (featureUnlockLevel(feat) > level) continue;
    features.push({
      refId: feat.id,
      name: feat.name ?? feat.id,
      desc: annotateAuraDesc(feat, level),
      source: 'class',
      sourceDetail: `${cls.name} · ${sub!.name}`,
      level: featureUnlockLevel(feat),
      uses: resolveFeatureUses(feat, cls, level, profBonus),
    });
  }

  const activeChoices = extractProgressionChoices(cls, level).filter((c) => !c.deferred && c.options.length);
  const classChoiceAnswers: Record<string, string[]> = { ...subChoiceAnswers };
  const extraFeatures: FeatureInstance[] = [];

  for (const [scId, picks] of Object.entries(subChoiceAnswers)) {
    const sc = sub?.sub_choices?.find((s) => s.id === scId);
    for (const pickId of picks) {
      const feat = cls.data.features_details?.find((f) => f.id === pickId);
      extraFeatures.push({
        refId: pickId,
        name: feat?.name ?? sc?.option_labels?.[pickId] ?? pickId,
        desc: feat?.desc ?? sc?.option_descs?.[pickId] ?? '',
        source: 'class',
        sourceDetail: `${cls.name} · ${sub?.name ?? ''}`,
        level: feat ? featureUnlockLevel(feat) : (sc?.level_required ?? 1),
        uses: feat ? resolveFeatureUses(feat, cls, level, profBonus) : undefined,
      });
    }
  }

  for (const choice of activeChoices) {
    const taken = new Set(
      Object.entries(classChoiceAnswers)
        .filter(([id]) => {
          const peer = activeChoices.find((c) => c.id === id);
          return peer?.type === 'feature_selection' && choice.type === 'feature_selection';
        })
        .flatMap(([, ids]) => ids),
    );
    for (const peer of activeChoices) {
      if (peer.type !== 'feature_selection' || peer.id === choice.id) continue;
      for (const fid of peer.fixedFeatureIds ?? []) taken.add(fid);
    }
    const pool = choice.options.map((o) => o.id).filter((id) => !taken.has(id));
    const picks = pickRandomSubset(pool, choice.count || 1);
    classChoiceAnswers[choice.id] = picks;
    for (const pickId of picks) {
      const opt = choice.options.find((o) => o.id === pickId);
      const feat = cls.data.features_details?.find((f) => f.id === pickId);
      extraFeatures.push({
        refId: pickId,
        name: feat?.name ?? opt?.name ?? pickId,
        desc: feat?.desc ?? opt?.desc ?? '',
        source: 'class',
        sourceDetail: `${cls.name} · ${choice.label}`,
        level: feat?.level ?? 1,
        uses: feat ? resolveFeatureUses(feat, cls, level, profBonus) : undefined,
      });
    }
    for (const fid of choice.fixedFeatureIds ?? []) {
      const feat = cls.data.features_details?.find((f) => f.id === fid);
      if (!feat) continue;
      if (extraFeatures.some((f) => f.refId === fid)) continue;
      extraFeatures.push({
        refId: fid,
        name: feat.name ?? fid,
        desc: feat.desc ?? '',
        source: 'class',
        sourceDetail: `${cls.name} · ${choice.label}`,
        level: feat.level ?? 1,
        uses: resolveFeatureUses(feat, cls, level, profBonus),
      });
    }
  }

  const subBonus = subclassBonusProficiencies(cls, sub?.id, level);
  const baseArmor = Array.isArray(prof.armor) ? prof.armor : [];
  const baseWeapons = Array.isArray(prof.weapons) ? prof.weapons : [];
  const baseTools = Array.isArray(prof.tools) ? prof.tools : [];
  const bonusSaveCodes = [...subBonus.savingThrows, ...classRootSavingThrowGrants(cls, level)];
  const savingThrows = [
    ...new Set(
      [
        ...(prof.saving_throws ?? []).map((s) => String(s)),
        ...bonusSaveCodes.map((code) => SAVE_CODE_TO_LABEL[code] ?? String(code)),
      ]
        .map((token) => SAVE_CODE_TO_LABEL[token] ?? SAVE_CODE_TO_LABEL[token.toLowerCase()] ?? token)
        .filter((a): a is Ability =>
          a === 'Force' ||
          a === 'Dextérité' ||
          a === 'Constitution' ||
          a === 'Intelligence' ||
          a === 'Sagesse' ||
          a === 'Charisme',
        ),
    ),
  ];
  const classResistances = subclassBonusResistances(cls, sub?.id, level);
  const classSenses = classBonusSenses(cls, sub?.id, level, []);

  const selection: ClassSelection = {
    classId: cls.id,
    className: cls.name,
    subclassId: sub?.id,
    subclassName: sub?.name,
    hitDie: cls.data.hit_die,
    hpAtLevel1: typeof data['hp_at_level_1'] === 'number' ? data['hp_at_level_1'] : cls.data.hit_die,
    hpPerLevelAverage:
      typeof data['hp_per_level_average'] === 'number'
        ? data['hp_per_level_average']
        : Math.floor(cls.data.hit_die / 2) + 1,
    hasSpellcasting: spellInfo !== null,
    spellcastingKind: spellInfo?.kind ?? null,
    spellcastingAbility: spellInfo?.ability ?? null,
    savingThrows,
    armorProficiencies: [...new Set([...baseArmor, ...subBonus.armor])],
    weaponProficiencies: [...new Set([...baseWeapons, ...subBonus.weapons])],
    toolProficiencies: [...new Set([...baseTools, ...subBonus.tools])],
    skillOptions: Array.isArray(prof.skills?.options) ? prof.skills.options : [],
    skillChooseCount: prof.skills?.count ?? 0,
    classFeatures: features,
    startingEquipmentSlots: coerceEquipmentSlots(cls.data.starting_equipment),
    classProgressionResources: extractScalarResources(progAtLevel?.resources),
    classBonusLanguageCount: classBonusLanguageCount(cls, level, undefined, sub?.id) + subBonus.bonusLanguages,
    classRequiredExoticLanguageCount:
      subBonus.requiredExoticLanguages + classRootRequiredExoticLanguageCount(cls, level),
    classRequiredBaseLanguageCount: classRootRequiredBaseLanguageCount(cls, level),
    classResistances,
    classDarkvisionRadius: classSenses.darkvisionRadius,
    classHasBlindsight: classSenses.hasBlindsight,
    classBlindsightRadius: classSenses.blindsightRadius,
    classSpellSlots: extractSpellSlotsFromResources(progAtLevel?.resources),
  };

  return { selection, classChoiceAnswers, extraFeatures };
}
