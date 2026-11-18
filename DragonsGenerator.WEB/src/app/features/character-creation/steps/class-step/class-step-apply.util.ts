import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Ability, FeatureInstance, SpellcastingKind } from '@core/models/Character/character';
import type { ClassSelection } from '@core/models/Character/character-builder.types';
import { coerceEquipmentSlots } from '@core/utils/class-data.adapter';
import { annotateAuraDesc } from '@core/utils/aura-range.util';
import { labelForGameId } from '@core/utils/game-id-labels';
import {
  resolveFeatureUses,
  extractScalarResources,
  extractSpellSlotsFromResources,
  extractPactSlotsFromResources,
} from '@core/utils/feature-uses.util';
import {
  classBonusLanguageCount,
  classRootRequiredExoticLanguageCount,
  classRootRequiredBaseLanguageCount,
  subclassFixedToolProficiencies,
  subclassBonusProficiencies,
  subclassBonusResistances,
  classBonusSenses,
  classRootSavingThrowGrants,
  type ProgressionChoiceDef,
} from '@core/utils/progression-choices.util';
import type { CombatStyleOption } from '@core/utils/class-step-combat.util';
import { ABILITY_CODE_TO_LABEL, type FeatureJson, type SubChoice, type SubclassOption } from './class-step.types';

export function isDeferredClassFeature(feat: Pick<FeatureJson, 'id' | 'resolves_to_choice_pool'>): boolean {
  return !!(
    feat.resolves_to_choice_pool ||
    /style-de-combat(?!-supplementaire)/i.test(feat.id) ||
    feat.id.includes('style-de-combat-guerrier') ||
    feat.id.includes('style-de-combat-paladin') ||
    feat.id.includes('style-de-combat-rodeur') ||
    feat.id === 'feat-style-de-combat-guerrier'
  );
}

export interface ClassApplyInput {
  cls: CharacterClass;
  subclass: SubclassOption | null;
  targetLevel: number;
  proficiencyBonus: number;
  featureDetails: FeatureJson[];
  subChoices: SubChoice[];
  subChoiceAnswers: Map<string, string[]>;
  combatStyleIds: string[];
  combatStyles: CombatStyleOption[];
  combatStyleUnlockLevel: number;
  progChoices: ProgressionChoiceDef[];
  progChoiceAnswers: Map<string, string[]>;
  spellInfo: { kind: SpellcastingKind; ability: Ability } | null;
  resolveOptionFeature: (id: string) => FeatureJson | undefined;
}

function pushUniqueFeature(features: FeatureInstance[], next: FeatureInstance): void {
  if (features.some((f) => f.refId === next.refId)) return;
  features.push(next);
}

function collectClassFeatures(input: ClassApplyInput): FeatureInstance[] {
  const { cls, subclass: sub, targetLevel, proficiencyBonus, featureDetails } = input;
  const features: FeatureInstance[] = [];
  const progression = (cls.data.progression ?? []) as {
    level: number;
    features?: string[];
    resources?: Record<string, unknown>;
  }[];

  for (const prog of progression) {
    if (prog.level < 1 || prog.level > targetLevel) continue;
    for (const id of prog.features ?? []) {
      const feat = featureDetails.find((f) => f.id === id);
      if (!feat || isDeferredClassFeature(feat)) continue;
      pushUniqueFeature(features, {
        refId: feat.id,
        name: feat.name,
        desc: annotateAuraDesc(feat, targetLevel),
        source: 'class',
        sourceDetail: `${cls.name} ${prog.level}`,
        level: prog.level,
        uses: resolveFeatureUses(feat, cls, targetLevel, proficiencyBonus),
      });
    }
  }

  if (sub) {
    (sub.features ?? [])
      .filter((f) => f.level <= targetLevel)
      .forEach((feat) => {
        if (feat.resolves_to_choice_pool) return;
        pushUniqueFeature(features, {
          refId: feat.id,
          name: feat.name,
          desc: annotateAuraDesc(feat, targetLevel),
          source: 'subclass',
          sourceDetail: `${sub.name} ${feat.level}`,
          level: feat.level,
          uses: resolveFeatureUses(feat, cls, targetLevel, proficiencyBonus),
        });
      });

    for (const sc of input.subChoices) {
      const picks = input.subChoiceAnswers.get(sc.id) ?? [];
      for (const pickId of picks) {
        const fromSub = sub.features.find((f) => f.id === pickId);
        const fromClass = featureDetails.find((f) => f.id === pickId);
        let feat: FeatureJson | undefined = fromSub ?? fromClass;
        if (!feat) {
          const allFeats = [...sub.features, ...featureDetails];
          for (const parent of allFeats) {
            const opt = parent.mechanics?.options?.find((o) => o?.id === pickId);
            if (opt) {
              feat = {
                id: pickId,
                name: opt.name ?? sc.option_labels?.[pickId] ?? labelForGameId(pickId),
                desc: opt.description ?? opt.desc ?? '',
                level: parent.level ?? sc.level_required,
              };
              break;
            }
          }
        }
        if (!feat) continue;
        pushUniqueFeature(features, {
          refId: feat.id,
          name: feat.name,
          desc: annotateAuraDesc(feat, targetLevel),
          source: 'subclass',
          sourceDetail: `${sub.name} · ${sc.label}`,
          level: feat.level || sc.level_required,
          uses: resolveFeatureUses(feat, cls, targetLevel, proficiencyBonus),
        });
      }
    }
  }

  for (const styleId of input.combatStyleIds) {
    const combatStyle = input.combatStyles.find((s) => s.id === styleId);
    if (!combatStyle) continue;
    features.push({
      refId: combatStyle.id,
      name: `Style : ${combatStyle.name}`,
      desc: combatStyle.desc,
      source: 'class',
      sourceDetail: `${cls.name} ${input.combatStyleUnlockLevel}`,
      level: input.combatStyleUnlockLevel,
    });
  }

  return features;
}

export function buildClassSelectionFromWizard(input: ClassApplyInput): ClassSelection {
  const { cls, subclass: sub, targetLevel, spellInfo } = input;
  const features = collectClassFeatures(input);
  const progression = (cls.data.progression ?? []) as {
    level: number;
    features?: string[];
    resources?: Record<string, unknown>;
  }[];
  const prof = cls.data.proficiencies;
  const progAtLevel = progression.find((p) => p.level === targetLevel);
  const classProgressionResources = extractScalarResources(progAtLevel?.resources);
  const pactSlots = extractPactSlotsFromResources(progAtLevel?.resources);
  const classSpellSlots =
    pactSlots.length > 0 ? pactSlots : extractSpellSlotsFromResources(progAtLevel?.resources);
  const baseArmor = Array.isArray(prof.armor) ? prof.armor : [];
  const subBonus = subclassBonusProficiencies(cls, sub?.id, targetLevel, baseArmor);
  const langBonus = classBonusLanguageCount(cls, targetLevel, undefined, sub?.id) + subBonus.bonusLanguages;
  const subclassTools = subclassFixedToolProficiencies(cls, targetLevel, sub?.id);
  const baseTools = Array.isArray(prof.tools) ? prof.tools : [];
  const toolProficiencies = [...new Set([...baseTools, ...subclassTools, ...subBonus.tools])];
  const baseWeapons = Array.isArray(prof.weapons) ? prof.weapons : [];
  const armorProficiencies = [...new Set([...baseArmor, ...subBonus.armor])];
  const weaponProficiencies = [...new Set([...baseWeapons, ...subBonus.weapons])];
  const bonusSaveCodes = [...subBonus.savingThrows, ...classRootSavingThrowGrants(cls, targetLevel)];
  const classResistances = subclassBonusResistances(cls, sub?.id, targetLevel);
  const allSubChoicePicks = [...input.subChoiceAnswers.values()].flat();
  const classSenses = classBonusSenses(cls, sub?.id, targetLevel, allSubChoicePicks);
  const savingThrows = [
    ...new Set([
      ...((prof.saving_throws ?? []) as Ability[]),
      ...bonusSaveCodes.map((code) => ABILITY_CODE_TO_LABEL[code]).filter((a): a is Ability => !!a),
    ]),
  ];
  const data = cls.data as Record<string, unknown>;

  return {
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
    armorProficiencies,
    weaponProficiencies,
    toolProficiencies,
    skillOptions: Array.isArray(prof.skills?.options) ? prof.skills.options : [],
    skillChooseCount: prof.skills?.count ?? 0,
    classFeatures: features,
    startingEquipmentSlots: coerceEquipmentSlots(cls.data.starting_equipment),
    classProgressionResources,
    classBonusLanguageCount: langBonus,
    classRequiredExoticLanguageCount:
      subBonus.requiredExoticLanguages + classRootRequiredExoticLanguageCount(cls, targetLevel),
    classRequiredBaseLanguageCount: classRootRequiredBaseLanguageCount(cls, targetLevel),
    classResistances,
    classDarkvisionRadius: classSenses.darkvisionRadius,
    classHasBlindsight: classSenses.hasBlindsight,
    classBlindsightRadius: classSenses.blindsightRadius,
    classSpellSlots,
  };
}

export function buildClassProgressionChoicesFromWizard(input: ClassApplyInput): {
  classChoiceAnswers: Record<string, string[]>;
  metamagicOptions: string[];
  eldritchInvocations: string[];
  pactBoon: string | null;
  extraFeatures: FeatureInstance[];
} {
  const { cls, targetLevel, proficiencyBonus } = input;
  const classChoiceAnswers: Record<string, string[]> = {};
  const metamagic: string[] = [];
  const invocations: string[] = [];
  let pactBoon: string | null = null;
  const extraFeatures: FeatureInstance[] = [];

  for (const sc of input.subChoices) {
    const picks = input.subChoiceAnswers.get(sc.id) ?? [];
    if (picks.length) classChoiceAnswers[sc.id] = picks;
  }

  for (const choice of input.progChoices) {
    const picks = input.progChoiceAnswers.get(choice.id) ?? [];
    classChoiceAnswers[choice.id] = picks;
    if (choice.type === 'metamagic') metamagic.push(...picks);
    if (choice.type === 'invocation') invocations.push(...picks);
    if (choice.type === 'pact_boon' && picks[0]) pactBoon = picks[0];

    for (const pickId of picks) {
      if (extraFeatures.some((f) => f.refId === pickId)) continue;
      const opt = choice.options.find((o) => o.id === pickId);
      const feat = input.resolveOptionFeature(pickId);
      extraFeatures.push({
        refId: pickId,
        name: feat?.name ?? opt?.name ?? labelForGameId(pickId),
        desc: feat?.desc ?? opt?.desc ?? '',
        source: 'class',
        sourceDetail: `${cls.name} · ${choice.label}`,
        level: feat?.level ?? 1,
        uses: feat ? resolveFeatureUses(feat, cls, targetLevel, proficiencyBonus) : undefined,
      });
    }

    for (const fid of choice.fixedFeatureIds ?? []) {
      if (extraFeatures.some((f) => f.refId === fid)) continue;
      const feat = input.resolveOptionFeature(fid);
      extraFeatures.push({
        refId: fid,
        name: feat?.name ?? labelForGameId(fid),
        desc: feat?.desc ?? '',
        source: 'class',
        sourceDetail: `${cls.name} · ${choice.label}`,
        level: feat?.level ?? 1,
        uses: feat ? resolveFeatureUses(feat, cls, targetLevel, proficiencyBonus) : undefined,
      });
    }
  }

  return {
    classChoiceAnswers,
    metamagicOptions: metamagic,
    eldritchInvocations: invocations,
    pactBoon,
    extraFeatures,
  };
}
