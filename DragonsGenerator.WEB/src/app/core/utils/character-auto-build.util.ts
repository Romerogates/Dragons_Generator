import type { Background } from '@core/models/Backgrounds/background';
import type { Equipment } from '@core/models/Equipments/equipment';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Civilisation } from '@core/models/Civilisations/civilisations';
import type { Language } from '@core/models/Languages/language';
import type { Spell } from '@core/models/Spells/spell';
import type { Species, Subspecies, CreationChoice } from '@core/models/Species/species';
import type { Skill } from '@core/models/Skills/skill';
import type {
  Ability,
  AbilityKey,
  EquipmentInstance,
  EquipmentSlot,
  FeatureInstance,
  SpellcastingKind,
  Size,
} from '@core/models/Character/character';
import type {
  BackgroundSelection,
  CivilizationSelection,
  ClassSelection,
  SpeciesSelection,
} from '@core/services/character-builder.service';
import { apiAsiToPartialScores, apiCodeToAbilityKey, mergePartialScores } from '@core/utils/ability-mapping';
import { annotateAuraDesc } from '@core/utils/aura-range.util';
import {
  CATEGORY_FILTERS,
  isMasteredProficiencyChoice,
  masteredProficiencyChoiceLabel,
  normalizeEquipments,
  resolveEquipmentRefId,
} from '@core/utils/equipment.utils';
import { extractScalarResources, extractSpellSlotsFromResources, resolveFeatureUses } from '@core/utils/feature-uses.util';
import {
  classBonusLanguageCount,
  classBonusSenses,
  classRootSavingThrowGrants,
  extractProgressionChoices,
  extractToolProficiencyChoices,
  extractWeaponProficiencyChoices,
  featureUnlockLevel,
  subclassBonusProficiencies,
  subclassBonusResistances,
} from '@core/utils/progression-choices.util';
import {
  speciesResistancesFromTraits,
  speciesTraitBonusProficiencies,
} from '@core/utils/species-proficiencies.util';
import { buildSkillMap, normalizeSkillId, type SkillInfo } from '@core/utils/skill.utils';
import { pickRandom } from '@core/utils/pregen-random.util';
import { proficiencyBonusForLevel } from '@core/services/character-builder.service';

export interface EquipmentCatalogItem {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  cost: { v: number | null; u: string };
  wKg: number | null;
  data: Record<string, unknown>;
}

export const CLASS_SPELLCASTING: Record<string, { kind: SpellcastingKind; ability: Ability } | null> = {
  'cls-barbare': null,
  'cls-barde': { kind: 'bard', ability: 'Charisme' },
  'cls-druide': { kind: 'druid', ability: 'Sagesse' },
  'cls-ensorceleur': { kind: 'sorcerer', ability: 'Charisme' },
  'cls-guerrier': null,
  'cls-lettre': null,
  'cls-magicien': { kind: 'wizard', ability: 'Intelligence' },
  'cls-moine': null,
  'cls-paladin': { kind: 'paladin', ability: 'Charisme' },
  'cls-pretre': { kind: 'cleric', ability: 'Sagesse' },
  'cls-rodeur': { kind: 'ranger', ability: 'Sagesse' },
  'cls-roublard': null,
  'cls-sorcier': { kind: 'warlock', ability: 'Charisme' },
};

const SPELLCASTING_FROM_LEVEL: Record<string, number> = {
  'cls-paladin': 2,
  'cls-rodeur': 2,
};

const SPELL_QUOTAS: Record<
  string,
  { cantrips: number; knownSpells: number; grimoireSpells: number; preparedSpells: number }
> = {
  wizard: { cantrips: 3, knownSpells: 0, grimoireSpells: 6, preparedSpells: 0 },
  bard: { cantrips: 2, knownSpells: 4, grimoireSpells: 0, preparedSpells: 0 },
  druid: { cantrips: 2, knownSpells: 0, grimoireSpells: 0, preparedSpells: 2 },
  sorcerer: { cantrips: 4, knownSpells: 2, grimoireSpells: 0, preparedSpells: 0 },
  cleric: { cantrips: 3, knownSpells: 0, grimoireSpells: 0, preparedSpells: 2 },
  warlock: { cantrips: 2, knownSpells: 2, grimoireSpells: 0, preparedSpells: 0 },
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
const ABILITY_LABEL_TO_KEY: Record<string, AbilityKey> = {
  Force: 'force',
  Dextérité: 'dexterite',
  Constitution: 'constitution',
  Intelligence: 'intelligence',
  Sagesse: 'sagesse',
  Charisme: 'charisme',
};

export function pickRandomSubset<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return picked;
}

function isFightingStylePool(pool: Record<string, unknown>): boolean {
  const t = String(pool['type'] ?? '');
  const id = String(pool['id'] ?? '');
  return (
    t === 'fighting_style' ||
    /style.*combat|combat.*style|fighting.?style/i.test(id + t) ||
    (t === 'feature_option' && /style|combat|fighting/i.test(id))
  );
}

function resolveSpellcasting(cls: CharacterClass, level: number): { kind: SpellcastingKind; ability: Ability } | null {
  const fromLevel = SPELLCASTING_FROM_LEVEL[cls.id] ?? 1;
  if (level < fromLevel) return null;
  return CLASS_SPELLCASTING[cls.id] ?? null;
}

function autoSpeciesChoiceAnswers(species: Species, sub: Subspecies | null): Record<string, string[]> {
  const answers: Record<string, string[]> = {};
  const choices = [...(species.creationChoices ?? []), ...(sub?.creationChoices ?? [])];
  for (const choice of choices) {
    if (choice.type === 'ability_score_increase') {
      const opts = flattenChoiceOptions(choice);
      const count = choice.choiceCount ?? 1;
      answers[choice.id] = pickRandomSubset(opts, count);
      continue;
    }
    if (choice.type === 'single_select' || choice.type === 'multi_select') {
      const opts = flattenChoiceOptions(choice);
      if (!opts.length) continue;
      const count = choice.type === 'multi_select' ? (choice.choiceCount ?? 1) : 1;
      answers[choice.id] = pickRandomSubset(opts, count);
    }
  }
  return answers;
}

function flattenChoiceOptions(choice: CreationChoice): string[] {
  const raw = choice.options;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((o) => {
        if (typeof o === 'string') return o;
        if (o && typeof o === 'object' && 'id' in o) return String((o as { id: string }).id);
        return null;
      })
      .filter((x): x is string => !!x && x !== 'any');
  }
  return [];
}

function asiFromChoiceAnswers(species: Species, sub: Subspecies | null, answers: Record<string, string[]>): Partial<Record<AbilityKey, number>> {
  const result: Partial<Record<AbilityKey, number>> = {};
  const choices = [...(species.creationChoices ?? []), ...(sub?.creationChoices ?? [])];
  for (const choice of choices) {
    if (choice.type !== 'ability_score_increase') continue;
    const picks = answers[choice.id] ?? [];
    const value = choice.valuePerChoice ?? 1;
    for (const code of picks) {
      const key = apiCodeToAbilityKey(code);
      if (!key) continue;
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

export function buildAutoSpeciesSelection(species: Species, targetLevel = 1, spells: Spell[] = []): SpeciesSelection {
  const playableSubs = (species.subspecies ?? []).filter((s) => s.playable);
  const sub: Subspecies | null = playableSubs.length ? pickRandom(playableSubs) : null;
  const choiceAnswers = autoSpeciesChoiceAnswers(species, sub);
  const baseAsi = apiAsiToPartialScores(species.baseStats.abilityScoreIncrease);
  const subAsi = sub ? apiAsiToPartialScores(sub.abilityScoreIncrease) : {};
  const choiceAsi = asiFromChoiceAnswers(species, sub, choiceAnswers);
  const racialBonuses = mergePartialScores(baseAsi, subAsi, choiceAsi);

  const traits = [...(species.traits ?? []), ...(sub?.traits ?? [])].map((t) => ({
    refId: t.id,
    name: t.name,
    desc: t.desc,
    source: 'species' as const,
    sourceDetail: sub ? `${species.name} (${sub.name})` : species.name,
    level: 1,
  }));

  const allChoices = [...(species.creationChoices ?? []), ...(sub?.creationChoices ?? [])];
  const bonusLanguageCount = allChoices
    .filter((c) => c.type === 'language' || (c.type === 'single_select' && String(c.name).toLowerCase().includes('langue')))
    .reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);
  const bonusSkillCount = allChoices.filter((c) => c.type === 'skill_proficiency' || c.type === 'skill').reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);
  const bonusToolCount = allChoices.filter((c) => c.type === 'tool_proficiency' || c.type === 'tool').reduce((sum, c) => sum + (c.choiceCount ?? 1), 0);

  const racialSpellGrants = allChoices
    .filter((c) => c.spellList || c.type === 'spell')
    .map((c) => ({
      choiceId: c.id,
      label: c.name,
      desc: c.desc ?? '',
      pool: flattenChoiceOptions(c),
      spellLevel: c.spellLevel ?? 0,
      spellcastingAbility: c.spellcastingAbility ?? 'Intelligence',
    }))
    .filter((g) => g.pool.length > 0);

  const rawTraits = [...(species.traits ?? []), ...(sub?.traits ?? [])];
  const traitBonus = speciesTraitBonusProficiencies(rawTraits);
  const lineageId =
    choiceAnswers['choice-lignee-draconique']?.[0] ?? choiceAnswers['choice-heritage-draconique']?.[0];
  const resistances = speciesResistancesFromTraits(rawTraits, species, sub, lineageId);

  const spellMap = new Map(spells.map((s) => [s.id, s]));
  const innateSpells: SpeciesSelection['innateSpells'] = [];
  for (const trait of rawTraits) {
    const mech = trait.mechanics as Record<string, unknown> | undefined;
    if (!mech || mech['type'] !== 'innate_spellcasting') continue;
    const innate = mech['innate_spells'];
    if (!Array.isArray(innate)) continue;
    for (const entry of innate) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const unlockLevel = Number(e['unlocks_at_level'] ?? 1);
      if (unlockLevel > targetLevel) continue;
      const spellId = e['spell_id'];
      if (typeof spellId !== 'string' || !spellId.trim()) continue;
      const raw = spellMap.get(spellId);
      const castLevel = Number(e['cast_as_spell_level'] ?? raw?.level ?? 0);
      const recharge = typeof e['recharge'] === 'string' ? (e['recharge'] as string) : 'at_will';
      const rechargeLabel =
        recharge === 'at_will'
          ? 'à volonté'
          : recharge === 'long_rest'
            ? '1× / repos long'
            : recharge === 'short_rest'
              ? '1× / repos court'
              : recharge;
      innateSpells.push({
        refId: spellId,
        name: raw?.name ?? spellId.replace(/^spl-/, '').replace(/-/g, ' '),
        level: castLevel,
        prepared: true,
        alwaysPrepared: true,
        effectSummary: `Inné (${rechargeLabel}) · ${(raw?.description ?? '').slice(0, 100)}`,
      });
    }
  }

  return {
    speciesId: species.id,
    speciesName: species.name,
    subspeciesId: sub?.id ?? null,
    subspeciesName: sub?.name ?? null,
    racialBonuses,
    traits,
    speed: species.baseStats.speedM,
    size: (species.baseStats.size ?? 'M') as Size,
    languages: [...(species.languages?.fixed ?? []), ...(sub?.languages?.fixed ?? [])],
    bonusLanguageCount,
    bonusSkillCount,
    bonusToolCount,
    resistances,
    hasDarkvision: (species.baseStats.darkvisionM ?? 0) > 0,
    darkvisionRadius: species.baseStats.darkvisionM ?? 0,
    bonusSkills: traitBonus.skills,
    bonusWeapons: traitBonus.weapons,
    bonusArmor: traitBonus.armor,
    bonusTools: traitBonus.tools,
    innateSpells,
    choiceAnswers,
    racialSpellGrants,
  };
}

export function buildAutoCivilizationSelection(civ: Civilisation): CivilizationSelection {
  return {
    civilizationId: civ.id,
    civilizationName: civ.name,
    languages: civ.linguistics.officialLanguages.map((l) => l.label),
    writingSystems: civ.linguistics.writingSystems.map((w) => w.label),
  };
}

function rollPersonalityTable(
  tables: Background['data']['personalityTables'],
  key: 'traits' | 'ideals' | 'bonds' | 'flaws',
): string | undefined {
  const table = tables?.[key];
  if (!table?.entries?.length) return undefined;
  return pickRandom(table.entries)?.text;
}

export function buildAutoBackgroundSelection(bg: Background, skillMap: Record<string, SkillInfo>): BackgroundSelection {
  const data = bg.data;
  if (!data.preset) {
    throw new Error('Custom backgrounds not supported for auto-generation');
  }

  const fixedSkills = (data.proficiencies?.skills?.fixed ?? []).map(normalizeSkillId);
  const skillOpts = (data.proficiencies?.skills?.options ?? []) as string[];
  const skillChoose = data.proficiencies?.skills?.chooseCount ?? 0;
  let extraSkills: string[] = [];
  if (skillChoose > 0) {
    const pool =
      !skillOpts.length || skillOpts.includes('any')
        ? Object.keys(skillMap)
        : skillOpts.map(normalizeSkillId);
    extraSkills = pickRandomSubset(
      pool.filter((id) => !fixedSkills.includes(id)),
      skillChoose,
    );
  }

  const bgTools: string[] = [];
  for (const group of data.proficiencies?.tools?.choose ?? []) {
    const opts = (group.options ?? []).map((opt) => {
      if (typeof opt === 'string') return opt;
      if (opt.id) return opt.id;
      if (opt.type === 'instrument') return 'instrument-any';
      if (opt.type === 'gameSet') return 'gameSet-any';
      if (opt.type === 'vehicle') return 'vehicle-any';
      return 'tool-any';
    });
    bgTools.push(...pickRandomSubset(opts, group.chooseCount ?? 1));
  }

  const fixedEquipment: EquipmentInstance[] = (data.equipment?.fixed ?? []).map((item) => ({
    instanceId: crypto.randomUUID(),
    refId: item.id,
    name: item.name,
    qty: item.qty ?? 1,
    location: 'backpack',
    equipped: false,
    wKg: null,
  }));

  const choiceSlots: EquipmentSlot[] = (data.equipment?.choose ?? []).map((choice, i) => ({
    slot: 100 + i,
    description: choice.name ?? "Choix d'équipement",
    alternatives: (choice.pool ?? []).map((item: { id: string; qty?: number }) => [
      { id: item.id, qty: item.qty ?? 1 },
    ]),
  }));

  return {
    backgroundId: bg.id,
    backgroundName: bg.name,
    backgroundPreset: true,
    skills: [...fixedSkills, ...extraSkills],
    tools: bgTools,
    proficiencies: data.proficiencies,
    languages: [],
    bonusLanguageCount: data.proficiencies?.languages?.choiceCount ?? 0,
    equipment: fixedEquipment,
    equipmentSlots: choiceSlots,
    currency: {
      cuivre: 0,
      argent: 0,
      or: data.equipment?.currency?.or ?? 0,
      platine: 0,
    },
    privilegeId: data.privilege.id,
    privilegeName: data.privilege.name,
    privilegeDesc: data.privilege.desc,
    selectedHandicaps: [],
    handicapCompensationType: null,
    backgroundText: data.flavor?.summary ?? bg.name,
    traits: rollPersonalityTable(data.personalityTables, 'traits'),
    ideal: rollPersonalityTable(data.personalityTables, 'ideals'),
    bonds: rollPersonalityTable(data.personalityTables, 'bonds'),
    flaws: rollPersonalityTable(data.personalityTables, 'flaws'),
  };
}

export function primaryAbilityKeys(cls: CharacterClass): AbilityKey[] {
  const spell = resolveSpellcasting(cls, 1);
  const keys: AbilityKey[] = [];
  for (const label of cls.data.primary_abilities ?? []) {
    const key = ABILITY_LABEL_TO_KEY[label];
    if (key) keys.push(key);
  }
  if (spell?.ability) {
    const key = ABILITY_LABEL_TO_KEY[spell.ability];
    if (key && !keys.includes(key)) keys.unshift(key);
  }
  if (!keys.length) keys.push('force', 'dexterite');
  return keys;
}

export function buildStandardAbilityScores(primaryKeys: AbilityKey[]): Record<AbilityKey, number> {
  const scores: Record<AbilityKey, number> = {
    force: 8,
    dexterite: 8,
    constitution: 8,
    intelligence: 8,
    sagesse: 8,
    charisme: 8,
  };
  const arr = [...STANDARD_ARRAY];
  const order: AbilityKey[] = [
    ...primaryKeys,
    'constitution',
    'dexterite',
    'force',
    'intelligence',
    'sagesse',
    'charisme',
  ];
  const seen = new Set<AbilityKey>();
  for (const key of order) {
    if (seen.has(key) || !arr.length) continue;
    seen.add(key);
    scores[key] = arr.shift()!;
  }
  for (const key of Object.keys(scores) as AbilityKey[]) {
    if (scores[key] === 8 && arr.length) scores[key] = arr.shift()!;
  }
  return scores;
}

const SAVE_CODE_TO_LABEL: Record<string, Ability> = {
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme',
};

interface AutoSubclassOption {
  id: string;
  name: string;
  desc?: string;
  features?: { id: string; name: string; desc: string; level?: number; [k: string]: unknown }[];
  sub_choices?: {
    id: string;
    type: string;
    count?: number;
    level_required?: number;
    label?: string;
    options?: string[];
    option_labels?: Record<string, string>;
    option_descs?: Record<string, string>;
  }[];
}

/** Sélectionne aléatoirement une sous-classe pour un pregen, si la classe en propose et que le
 * niveau cible l'autorise. Retourne aussi les réponses aux sous-choix (ancêtre draconique, domaine…). */
function pickAutoSubclass(
  cls: CharacterClass,
  level: number,
): { sub: AutoSubclassOption | null; classChoiceAnswers: Record<string, string[]> } {
  const raw = cls.data.subclasses as unknown;
  if (!raw) return { sub: null, classChoiceAnswers: {} };
  const options = (Array.isArray(raw) ? raw : ((raw as { options?: unknown[] }).options ?? [])) as AutoSubclassOption[];
  const levelUnlocked = Array.isArray(raw)
    ? 1
    : Number(
        (raw as { level_unlocked?: number; unlocked_at_level?: number }).level_unlocked ??
          (raw as { unlocked_at_level?: number }).unlocked_at_level ??
          3,
      );
  if (!options.length || level < levelUnlocked) return { sub: null, classChoiceAnswers: {} };

  const sub = pickRandom(options);
  if (!sub) return { sub: null, classChoiceAnswers: {} };

  const classChoiceAnswers: Record<string, string[]> = {};
  for (const sc of sub.sub_choices ?? []) {
    if ((sc.level_required ?? 1) > level) continue;
    if (!sc.options?.length) continue;
    classChoiceAnswers[sc.id] = pickRandomSubset(sc.options, sc.count || 1);
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
    name: feat.name,
    desc: annotateAuraDesc(feat as never, level),
    source: 'class',
    sourceDetail: cls.name,
    level: feat.level ?? level,
    uses: resolveFeatureUses(feat, cls, level, profBonus),
  };
}

function pickCombatStyles(cls: CharacterClass, level: number): FeatureInstance[] {
  const pools = ((cls.data as { choice_pools?: Record<string, unknown>[] }).choice_pools ?? []) as Record<
    string,
    unknown
  >[];
  const pool = pools.find((p) => isFightingStylePool(p));
  if (!pool) return [];
  const unlock = 1;
  if (unlock > level) return [];
  const styleIds = (pool['pool'] as string[]) ?? [];
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
  const data = cls.data as Record<string, unknown>;

  const { sub, classChoiceAnswers: subChoiceAnswers } = pickAutoSubclass(cls, level);
  for (const feat of sub?.features ?? []) {
    if (featureUnlockLevel(feat as Record<string, unknown>) > level) continue;
    features.push({
      refId: feat.id,
      name: feat.name,
      desc: feat.desc,
      source: 'class',
      sourceDetail: `${cls.name} · ${sub!.name}`,
      level: featureUnlockLevel(feat as Record<string, unknown>),
      uses: resolveFeatureUses(feat, cls, level, profBonus),
    });
  }

  const activeChoices = extractProgressionChoices(cls, level).filter((c) => !c.deferred && c.options.length);
  const classChoiceAnswers: Record<string, string[]> = { ...subChoiceAnswers };
  const extraFeatures: FeatureInstance[] = [];

  // Sous-choix de sous-classe (ancêtre draconique, domaine, totem…) : matérialiser en features.
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
        level: feat ? featureUnlockLevel(feat as Record<string, unknown>) : (sc?.level_required ?? 1),
        uses: feat ? resolveFeatureUses(feat, cls, level, profBonus) : undefined,
      });
    }
  }

  for (const choice of activeChoices) {
    const picks = pickRandomSubset(
      choice.options.map((o) => o.id),
      choice.count || 1,
    );
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
      extraFeatures.push({
        refId: fid,
        name: feat.name,
        desc: feat.desc,
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
    ...new Set([
      ...(prof.saving_throws ?? []),
      ...bonusSaveCodes.map((code) => SAVE_CODE_TO_LABEL[code]).filter((a): a is Ability => !!a),
    ]),
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
    startingEquipmentSlots: cls.data.starting_equipment ?? [],
    classProgressionResources: extractScalarResources(progAtLevel?.resources),
    classBonusLanguageCount: classBonusLanguageCount(cls, level, undefined, sub?.id) + subBonus.bonusLanguages,
    classRequiredExoticLanguageCount: subBonus.requiredExoticLanguages,
    classResistances,
    classDarkvisionRadius: classSenses.darkvisionRadius,
    classHasBlindsight: classSenses.hasBlindsight,
    classBlindsightRadius: classSenses.blindsightRadius,
    classSpellSlots: extractSpellSlotsFromResources(progAtLevel?.resources),
  };

  return { selection, classChoiceAnswers, extraFeatures };
}

export function autoPickClassSkills(
  skillOptions: string[],
  chooseCount: number,
  skillMap: Record<string, SkillInfo>,
  taken: Set<string>,
): string[] {
  const pool =
    !skillOptions.length || skillOptions.some((o) => o === 'any' || o === 'any-skills')
      ? Object.keys(skillMap)
      : skillOptions.map(normalizeSkillId);
  return pickRandomSubset(
    pool.filter((id) => !taken.has(normalizeSkillId(id))),
    chooseCount,
  ).map(normalizeSkillId);
}

export function autoResolveClassProficiencies(
  cls: CharacterClass,
  weaponCatalog: { id: string; costPo: number }[],
  toolCatalog: { id: string }[],
  existingWeapons: string[],
  existingTools: string[],
): { weapons: string[]; tools: string[]; answers: Record<string, string[]> } {
  const answers: Record<string, string[]> = {};
  const extraWeapons: string[] = [];
  const extraTools: string[] = [];
  const weaponBase = new Set(existingWeapons);

  for (const choice of extractWeaponProficiencyChoices(cls, 1)) {
    const maxPrice = choice.meta?.['maxPricePo'] as number | undefined;
    const pool = weaponCatalog
      .filter((w) => !weaponBase.has(w.id) && (maxPrice == null || w.costPo <= maxPrice))
      .map((w) => w.id);
    const picks = pickRandomSubset(pool, choice.count || 1);
    answers[choice.id] = picks;
    extraWeapons.push(...picks);
    picks.forEach((id) => weaponBase.add(id));
  }

  const toolBase = new Set(existingTools);
  for (const choice of extractToolProficiencyChoices(cls, 1)) {
    const pool = toolCatalog.filter((t) => !toolBase.has(t.id)).map((t) => t.id);
    const picks = pickRandomSubset(pool, choice.count || 1);
    answers[choice.id] = picks;
    extraTools.push(...picks);
    picks.forEach((id) => toolBase.add(id));
  }

  return { weapons: extraWeapons, tools: extraTools, answers };
}

export function resolveBgToolToConcrete(
  toolRef: string,
  toolCatalog: EquipmentCatalogItem[],
): string {
  if (toolRef.startsWith('tl-')) return toolRef;
  if (toolRef.includes('instrument')) {
    const inst = toolCatalog.filter((t) => t.type === 'TOOL' && (t.subtype === 'instrument' || t.id.includes('tl-')));
    return pickRandom(inst)?.id ?? 'tl-luth';
  }
  if (toolRef.includes('game')) {
    const games = toolCatalog.filter((t) => t.id.includes('des') || t.id.includes('echecs') || t.subtype === 'gaming_set');
    return pickRandom(games)?.id ?? 'tl-des';
  }
  const tools = toolCatalog.filter((t) => t.type === 'TOOL');
  return pickRandom(tools)?.id ?? toolRef;
}

export function buildBackgroundToolSlots(
  bgTools: string[],
  toolCatalog: EquipmentCatalogItem[],
): EquipmentSlot[] {
  const slots: EquipmentSlot[] = [];
  let slotIndex = 200;
  for (const tool of bgTools) {
    if (tool.includes('any') || tool.includes('instrument') || tool.includes('game')) {
      const cat =
        tool.includes('instrument') ? 'category-musical-instruments'
        : tool.includes('game') ? 'category-gaming-sets'
        : 'category-tools';
      slots.push({
        slot: slotIndex++,
        description: 'Outil (historique)',
        alternatives: [[{ id: cat, qty: 1 }]],
      });
    } else {
      slots.push({
        slot: slotIndex++,
        description: 'Outil (historique)',
        fixed: [{ id: resolveBgToolToConcrete(tool, toolCatalog), qty: 1 }],
      });
    }
  }
  return slots;
}

function resolveCatalogItem(
  ref: { id: string; qty: number },
  catalog: Map<string, EquipmentCatalogItem>,
  weaponProfs: string[],
  toolProfs: string[],
): { isCategory: boolean; equipment: EquipmentCatalogItem | null; categoryItems: EquipmentCatalogItem[]; categoryLabel: string | null } {
  const resolvedId = resolveEquipmentRefId(ref.id);
  if (isMasteredProficiencyChoice(resolvedId)) {
    const isWeapon = resolvedId === 'wp-mastered-choice';
    const profIds = isWeapon ? weaponProfs : [...new Set(toolProfs)];
    const items = profIds
      .map((id) => catalog.get(resolveEquipmentRefId(id)))
      .filter((e): e is EquipmentCatalogItem => !!e);
    return {
      isCategory: true,
      equipment: null,
      categoryItems: items,
      categoryLabel: masteredProficiencyChoiceLabel(resolvedId),
    };
  }
  const filter = CATEGORY_FILTERS[resolvedId];
  if (filter) {
    const items = filter.ids
      ? filter.ids.map((id) => catalog.get(id)).filter((e): e is EquipmentCatalogItem => !!e)
      : [...catalog.values()].filter(
          (eq) =>
            eq.type === filter.type &&
            (!filter.subtypes || filter.subtypes.includes(eq.subtype!)),
        );
    return { isCategory: true, equipment: null, categoryItems: items, categoryLabel: filter.label };
  }
  return {
    isCategory: false,
    equipment: catalog.get(resolvedId) ?? null,
    categoryItems: [],
    categoryLabel: null,
  };
}

function toEquipmentInstance(
  eq: EquipmentCatalogItem,
  qty: number,
): EquipmentInstance {
  const data = eq.data ?? {};
  const isArmor = eq.type === 'ARMOR';
  const isShield = isArmor && eq.subtype === 'SHIELD';
  const isWeapon = eq.type === 'WEAPON';
  let customData: Record<string, unknown> | undefined;
  if (isWeapon) {
    customData = {
      isWeapon: true,
      damage: (data as Record<string, unknown>)['dmg_d'] ?? (data as Record<string, unknown>)['damage_dice'],
      damageType: (data as Record<string, unknown>)['dmg_t'] ?? (data as Record<string, unknown>)['damage_type'],
      properties: (data as Record<string, unknown>)['props'] ?? (data as Record<string, unknown>)['properties'] ?? [],
      subtype: eq.subtype,
    };
  } else if (isArmor) {
    customData = {
      isArmor: !isShield,
      isShield,
      ac: (data as Record<string, unknown>)['ac'] ?? (data as Record<string, unknown>)['ac_base'] ?? (isShield ? 2 : 10),
      dexModifier: (data as Record<string, unknown>)['dex_modifier'],
      maxDexBonus: (data as Record<string, unknown>)['max_dex_bonus'] ?? null,
      stealthDis: (data as Record<string, unknown>)['stealth_dis'] ?? false,
      subtype: eq.subtype,
    };
  }
  return {
    instanceId: crypto.randomUUID(),
    refId: eq.id,
    name: eq.name,
    qty,
    location: isArmor ? 'equipped' : 'at_hand',
    equipped: isArmor,
    wKg: eq.wKg,
    customData,
  };
}

export function buildAutoEquipment(
  slots: EquipmentSlot[],
  catalogItems: EquipmentCatalogItem[],
  weaponProfs: string[],
  toolProfs: string[],
): EquipmentInstance[] {
  const catalog = new Map(catalogItems.map((e) => [e.id, e]));
  const result: EquipmentInstance[] = [];

  for (const slot of slots) {
    const isFixed = !!slot.fixed?.length && !slot.alternatives?.length;
    if (isFixed) {
      for (const ref of slot.fixed ?? []) {
        const resolved = resolveCatalogItem(ref, catalog, weaponProfs, toolProfs);
        if (resolved.isCategory) {
          const pick = pickRandom(resolved.categoryItems);
          if (pick) result.push(toEquipmentInstance(pick, ref.qty));
        } else if (resolved.equipment) {
          result.push(toEquipmentInstance(resolved.equipment, ref.qty));
        }
      }
      continue;
    }
    const alt = pickRandom(slot.alternatives ?? []);
    if (!alt) continue;
    for (const ref of alt) {
      const resolved = resolveCatalogItem(ref, catalog, weaponProfs, toolProfs);
      if (resolved.isCategory) {
        const pick = pickRandom(resolved.categoryItems);
        if (pick) result.push(toEquipmentInstance(pick, ref.qty));
      } else if (resolved.equipment) {
        result.push(toEquipmentInstance(resolved.equipment, ref.qty));
      }
    }
  }
  return result;
}

export function buildAutoSpellcastingDetails(
  cls: CharacterClass,
  spells: Spell[],
  racialGrants: SpeciesSelection['racialSpellGrants'],
  speciesChoiceAnswers: Record<string, string[]>,
): Record<string, unknown> | null {
  const spellInfo = resolveSpellcasting(cls, 1);
  if (!spellInfo?.kind) return null;
  const quota = SPELL_QUOTAS[spellInfo.kind];
  if (!quota) return { cantrips: [], spells: [] };

  const classSpells = spells.filter((s) => s.classes?.includes(cls.id) || s.classes?.some((c) => c.includes(cls.id.replace('cls-', ''))));
  const cantripPool = classSpells.filter((s) => s.level === 0);
  const level1Pool = classSpells.filter((s) => s.level === 1);

  const cantripIds = pickRandomSubset(cantripPool.map((s) => s.id), quota.cantrips);
  const racialCantrips = racialGrants
    .filter((g) => g.spellLevel === 0)
    .map((g) => {
      const fromAnswers = speciesChoiceAnswers[g.choiceId]?.[0];
      return fromAnswers ?? pickRandom(g.pool);
    })
    .filter((x): x is string => !!x);

  const allCantripIds = [...new Set([...racialCantrips, ...cantripIds])];
  const spellPickCount = quota.knownSpells || quota.grimoireSpells || quota.preparedSpells;
  const spellIds = pickRandomSubset(level1Pool.map((s) => s.id), spellPickCount);

  const spellMap = new Map(spells.map((s) => [s.id, s]));
  return {
    cantrips: allCantripIds.map((id) => {
      const raw = spellMap.get(id);
      return {
        refId: id,
        name: raw?.name ?? id,
        level: 0,
        prepared: true,
        effectSummary: raw?.description?.slice(0, 120) ?? '',
      };
    }),
    spells: spellIds.map((id) => {
      const raw = spellMap.get(id);
      return {
        refId: id,
        name: raw?.name ?? id,
        level: 1,
        prepared: true,
        effectSummary: raw?.description?.slice(0, 120) ?? '',
      };
    }),
  };
}

export function pickBonusLanguages(
  languages: Language[],
  locked: Set<string>,
  count: number,
): string[] {
  const pool = languages
    .filter((l) => l.category === 'base' && !locked.has(l.name) && !l.speakers?.isExtinct)
    .map((l) => l.name);
  return pickRandomSubset(pool, count);
}

export function normalizeEquipmentCatalog(raw: Equipment[]): EquipmentCatalogItem[] {
  return normalizeEquipments(raw) as unknown as EquipmentCatalogItem[];
}

export function createSkillMapFromList(skills: Skill[]): Record<string, SkillInfo> {
  return buildSkillMap(skills);
}

export function pickPlayableSpecies(all: Species[]): Species[] {
  return all.filter((s) => {
    const subs = s.subspecies ?? [];
    if (!subs.length) return true;
    return subs.some((sub) => sub.playable);
  });
}

export function pickPresetBackgrounds(all: Background[]): Background[] {
  return all.filter((b) => b.data?.preset !== false && b.id !== 'bg-custom');
}
