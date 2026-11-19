import type {
  CharacterClass,
  EquipmentSlot,
  FeatureDetail,
  ProgressionLevel,
  Proficiencies,
  Subclass,
  SubclassCatalog,
} from '@core/models/CharacterClasses/character-class';
import type { Ability } from '@core/models/CharacterClasses/character-class';
import { normalizeSkillId } from './skill.utils';
import { normalizeItemRef } from './equipment.utils';
import { tidyPlayerFacingCopy } from './catalog-display.util';

interface RawFeatureDetail {
  id?: string;
  name?: string;
  desc?: string;
  description?: string;
  flavor?: { summary?: string };
  level?: number;
  unlocks_at_level?: number;
  recharge?: string;
  uses?: unknown;
  mechanics?: { choice_quantity?: number; options?: unknown[] } & Record<string, unknown>;
}

interface RawChoicePool {
  id?: string;
  type?: string;
  name?: string;
  quantity?: number;
  pool?: unknown[];
  options?: unknown[];
  pool_filter?: unknown;
  level_unlocked?: number;
  unlocked_at_level?: number;
}

interface RawSubChoice {
  id?: string;
  type?: string;
  count?: number;
  quantity?: number;
  level_required?: number;
  level_unlocked?: number;
  label?: string;
  name?: string;
  options?: unknown[];
  pool?: unknown[];
  option_labels?: Record<string, string>;
  option_descs?: Record<string, string>;
}

interface RawSubclassOption {
  id: string;
  name?: string;
  desc?: string;
  features?: RawFeatureDetail[];
  flavor?: { summary?: string };
  features_details?: RawFeatureDetail[];
  choice_pools?: RawChoicePool[];
  sub_choices?: RawSubChoice[];
  sub_identity_choice?: RawSubChoice;
}

interface RawSubclassCatalog {
  level_unlocked?: number;
  unlocked_at_level?: number;
  subclass_level_unlocked?: number;
  options?: RawSubclassOption[];
}

const ABILITY_MAP: Record<string, Ability> = {
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme',
  for: 'Force',
  sag: 'Sagesse',
};

/** Pools de compétences manquants dans certains JSON classes (choice_pools vide). */
const DEFAULT_SKILL_POOLS: Record<string, { count: number; options: string[] }> = {
  'cls-barbare': {
    count: 2,
    options: [
      'skill-athletisme',
      'skill-dressage',
      'skill-intimidation',
      'skill-nature',
      'skill-perception',
      'skill-survie',
    ],
  },
  'cls-druide': {
    count: 2,
    options: [
      'skill-arcanes',
      'skill-dressage',
      'skill-intuition',
      'skill-medecine',
      'skill-nature',
      'skill-perception',
      'skill-religion',
      'skill-survie',
    ],
  },
};

function parseHitDie(hitDie: unknown): number {
  if (typeof hitDie === 'number') return hitDie;
  if (typeof hitDie === 'string') {
    const parts = hitDie.split('d');
    if (parts.length === 2) {
      const n = parseInt(parts[1], 10);
      return isNaN(n) ? 8 : n;
    }
  }
  return 8;
}

const ABILITY_VALUES: Ability[] = [
  'Force',
  'Dextérité',
  'Constitution',
  'Intelligence',
  'Sagesse',
  'Charisme',
];

function isAbility(v: string): v is Ability {
  return ABILITY_VALUES.some((a) => a === v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mapSavingThrows(raw: unknown): Ability[] {
  if (!Array.isArray(raw)) return [];
  const out: Ability[] = [];
  for (const a of raw) {
    const token = String(a);
    const mapped = ABILITY_MAP[token.toLowerCase()];
    if (mapped) out.push(mapped);
    else if (isAbility(token)) out.push(token);
  }
  return out;
}

function isEquipmentSlot(v: unknown): v is EquipmentSlot {
  return isRecord(v) && typeof v['slot'] === 'number';
}

function isRawChoicePool(v: unknown): v is RawChoicePool {
  return isRecord(v);
}

function readStringList(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.map(String) : undefined;
}

function readProficiencies(raw: unknown): Proficiencies {
  if (!isRecord(raw)) return {};
  const skillsRaw = raw['skills'];
  return {
    armor: readStringList(raw['armor']),
    weapons: readStringList(raw['weapons']),
    tools: readStringList(raw['tools']),
    saving_throws: mapSavingThrows(raw['saving_throws']),
    skills: isRecord(skillsRaw)
      ? {
          count: typeof skillsRaw['count'] === 'number' ? skillsRaw['count'] : undefined,
          options: readStringList(skillsRaw['options']),
        }
      : undefined,
  };
}

function readProgression(raw: unknown): ProgressionLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((p) => ({
    ...p,
    level: typeof p['level'] === 'number' ? p['level'] : 1,
    prof_bonus: typeof p['prof_bonus'] === 'number' ? p['prof_bonus'] : 2,
    features: Array.isArray(p['features']) ? p['features'].map(String) : [],
  }));
}

function normalizeFeaturesDetails(features: RawFeatureDetail[]): FeatureDetail[] {
  return (features ?? []).map((f) => {
    const description = typeof f.description === 'string' ? f.description : '';
    return {
      ...f,
      id: f.id ?? '',
      name: f.name ?? '',
      desc: tidyPlayerFacingCopy(description || f.desc || f.flavor?.summary || ''),
      level: f.level ?? f.unlocks_at_level ?? 1,
      rechargeType: mapRecharge(f.recharge),
      uses: f.uses ?? undefined,
    };
  });
}

function mapRecharge(recharge: string | undefined): string | undefined {
  if (!recharge || recharge === 'passive') return undefined;
  if (recharge === 'short_rest') return 'short_rest';
  if (recharge === 'long_rest') return 'long_rest';
  return 'special';
}

function mapOptionItems(opt: unknown): { id: string; qty: number }[] {
  // Option = string seule, tableau d'items (druide) ou { items: [...] } (guerrier/barbare)
  if (typeof opt === 'string') {
    return [normalizeItemRef(opt)];
  }
  if (Array.isArray(opt)) {
    return opt.map(normalizeItemRef);
  }
  if (opt && typeof opt === 'object') {
    const obj = opt as { items?: unknown[]; id?: string; qty?: number };
    if (Array.isArray(obj.items)) {
      return obj.items.map(normalizeItemRef);
    }
    if (obj.id) {
      return [normalizeItemRef(obj)];
    }
  }
  return [];
}

/**
 * Convertit `starting_equipment` API (objet fixed/choice_pools) ou une liste de slots
 * wizard déjà normalisée en `EquipmentSlot[]`.
 * Tolère aussi un objet brut stocké par erreur dans le brouillon (évite un spread qui crashe l'étape).
 */
export function coerceEquipmentSlots(se: unknown, topLevelPools: RawChoicePool[] = []): EquipmentSlot[] {
  if (Array.isArray(se)) return se.filter(isEquipmentSlot);

  const slots: EquipmentSlot[] = [];
  let slotNum = 1;

  const obj = isRecord(se) ? se : {};

  const fixed = obj['fixed'];
  if (Array.isArray(fixed) && fixed.length) {
    slots.push({
      slot: slotNum++,
      description: 'Équipement de départ',
      fixed: fixed.map(normalizeItemRef),
    });
  }

  const rawPools = obj['choice_pools'];
  const pools = Array.isArray(rawPools) ? rawPools.filter(isRawChoicePool) : [];
  for (const pool of pools) {
    const opts = pool.options ?? pool.pool ?? [];
    slots.push({
      slot: slotNum++,
      description: pool.name ?? "Choix d'équipement",
      alternatives: opts.map(mapOptionItems),
    });
  }

  // Moine / paladin / rôdeur / roublard / sorcier : pools au niveau racine
  for (const pool of topLevelPools) {
    const t = String(pool?.type ?? '');
    if (t !== 'starting_equipment' && t !== 'equipment') continue;
    const opts = pool.pool ?? pool.options ?? [];
    const alternatives = opts.map((opt: unknown) => mapOptionItems(opt));
    if (alternatives.length === 0) continue;
    slots.push({
      slot: slotNum++,
      description: pool.name ?? "Choix d'équipement",
      alternatives,
    });
  }

  return slots;
}

function normalizeStartingEquipment(se: unknown, topLevelPools: RawChoicePool[] = []): EquipmentSlot[] {
  return coerceEquipmentSlots(se, topLevelPools);
}

function extractChoiceLevel(pool: RawChoicePool): number {
  if (typeof pool?.level_unlocked === 'number') return pool.level_unlocked;
  if (typeof pool?.unlocked_at_level === 'number') return pool.unlocked_at_level;
  const id = String(pool?.id ?? '');
  const fromId = id.match(/lvl(\d+)/i) ?? id.match(/niv-?(\d+)/i);
  if (fromId) return parseInt(fromId[1], 10);
  return 1;
}

/** Types de pools gérés ailleurs (compétences, magie…) ou dynamiques (pool_filter sans liste statique). */
const DEFERRED_SUBCHOICE_TYPES = new Set([
  'tool_proficiency',
  'weapon_proficiency',
  'language',
  'language_proficiency',
  'spell_proficiency',
  // Ex. Barde Collège des conteurs "Maîtrises supplémentaires" (pool: ["any"], quantity 3) :
  // ce choix existe AUSSI comme mécanique de feature (mechanics.type: skill_proficiency_grant),
  // déjà câblé et proposé à l'étape Savoirs via `extractSubclassSkillProficiencyChoices`. Sans ce
  // différé, le pool racine de sous-classe générait en plus une carte "1/3" à l'étape Classe avec
  // une seule option littérale "any", non sélectionnable et bloquante.
  'skill_proficiency',
]);

/** Totems animaux de secours (Cercle des Esprits) quand le JSON n'a qu'un pool_filter. */
const DEFAULT_ANIMAL_TOTEM_OPTIONS: { id: string; name: string }[] = [
  { id: 'beast-loup', name: 'Loup' },
  { id: 'beast-ours', name: 'Ours' },
  { id: 'beast-aigle', name: 'Aigle' },
  { id: 'beast-cerf', name: 'Cerf' },
  { id: 'beast-sanglier', name: 'Sanglier' },
  { id: 'beast-panthere', name: 'Panthère' },
  { id: 'beast-serpent-constricteur', name: 'Serpent constricteur' },
  { id: 'beast-crocodile', name: 'Crocodile' },
];

function extractOptionLabels(raw: unknown[] | undefined): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!Array.isArray(raw)) return labels;
  for (const entry of raw) {
    if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      if (typeof obj['id'] === 'string' && typeof obj['name'] === 'string') {
        labels[obj['id']] = String(obj['name']).trim();
      }
    }
  }
  return labels;
}

/** Descriptions des options (ex. technique de combat "Proie du chasseur"), pour affichage fidèle aux règles. */
function extractOptionDescs(raw: unknown[] | undefined): Record<string, string> {
  const descs: Record<string, string> = {};
  if (!Array.isArray(raw)) return descs;
  for (const entry of raw) {
    if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const id = obj['id'];
      const desc = obj['description'] ?? obj['desc'];
      if (typeof id === 'string' && typeof desc === 'string' && desc.trim()) {
        descs[id] = desc.trim();
      }
    }
  }
  return descs;
}

/** Les pools API (ex. dragon_ancestry) peuvent contenir des objets { id, … } au lieu de strings. */
function normalizeSubChoiceOptionIds(raw: unknown[] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        if (typeof obj['id'] === 'string') return obj['id'].trim();
        if (typeof obj['option_id'] === 'string') return obj['option_id'].trim();
      }
      return String(entry ?? '').trim();
    })
    .filter(Boolean);
}

function isDeferredSubChoicePool(pool: RawChoicePool): boolean {
  const t = String(pool.type ?? '');
  if (DEFERRED_SUBCHOICE_TYPES.has(t)) return true;
  // animal_totem : on injecte une liste de secours plutôt que différer
  if (t === 'animal_totem') return false;
  const poolIds = normalizeSubChoiceOptionIds(pool.pool);
  return !!pool.pool_filter && poolIds.length === 0;
}

function buildSubChoiceFromRaw(sc: RawSubChoice): RawSubChoice {
  const rawOpts = sc.options ?? sc.pool ?? [];
  return {
    ...sc,
    id: sc.id,
    type: sc.type ?? 'option',
    count: sc.count ?? sc.quantity ?? 1,
    level_required: sc.level_required ?? sc.level_unlocked ?? 1,
    label: sc.label ?? sc.name ?? 'Choix',
    options: normalizeSubChoiceOptionIds(rawOpts),
    option_labels: { ...extractOptionLabels(rawOpts), ...(sc.option_labels ?? {}) },
    option_descs: { ...extractOptionDescs(rawOpts), ...(sc.option_descs ?? {}) },
  };
}

/**
 * Convertit une feature dotée de `mechanics.options` + `choice_quantity` (ex. Rôdeur Chasseur
 * "Proie du chasseur" niv. 3 : choisir 1 technique parmi 3) en sub_choice consommable par le
 * wizard. Sans cela, ce choix permanent n'était jamais proposé au joueur.
 */
function buildSubChoiceFromFeatureOptions(feat: RawFeatureDetail): RawSubChoice | null {
  const mech = feat.mechanics;
  const quantity = mech?.choice_quantity;
  const rawOpts = mech?.options;
  if (typeof quantity !== 'number' || quantity < 1) return null;
  if (!Array.isArray(rawOpts) || rawOpts.length === 0) return null;
  const ids = normalizeSubChoiceOptionIds(rawOpts);
  if (ids.length === 0) return null;
  return {
    id: `choice-feature-${feat.id}`,
    type: 'feature_option',
    count: quantity,
    level_required: feat.level ?? feat.unlocks_at_level ?? 1,
    label: feat.name ?? 'Choix',
    options: ids,
    option_labels: extractOptionLabels(rawOpts),
    option_descs: extractOptionDescs(rawOpts),
  };
}

function buildSubChoiceFromPool(pool: RawChoicePool): RawSubChoice {
  let rawOpts = pool.pool ?? pool.options ?? [];
  if (
    String(pool.type ?? '') === 'animal_totem' &&
    normalizeSubChoiceOptionIds(rawOpts).length === 0
  ) {
    rawOpts = DEFAULT_ANIMAL_TOTEM_OPTIONS;
  }
  return {
    id: pool.id,
    type: pool.type ?? 'option',
    count: pool.quantity ?? 1,
    level_required: extractChoiceLevel(pool),
    label: pool.name ?? 'Choix',
    options: normalizeSubChoiceOptionIds(rawOpts),
    option_labels: extractOptionLabels(rawOpts),
    option_descs: extractOptionDescs(rawOpts),
  };
}

/** Convertit choice_pools de sous-classe en sub_choices consommables par le wizard. */
function normalizeSubChoices(sub: RawSubclassOption): RawSubChoice[] {
  let choices: RawSubChoice[];

  if (Array.isArray(sub.sub_choices) && sub.sub_choices.length > 0) {
    choices = sub.sub_choices.map(buildSubChoiceFromRaw);
  } else {
    choices = (sub.choice_pools ?? [])
      .filter((pool) => !isDeferredSubChoicePool(pool))
      .map(buildSubChoiceFromPool);

    if (sub.sub_identity_choice) {
      choices.push(buildSubChoiceFromRaw(sub.sub_identity_choice));
    }
  }

  // Choix imbriqués dans une feature individuelle (ex. Rôdeur Chasseur : techniques de combat
  // niv. 3/7/11/15). Toujours ajoutés en plus des sources ci-dessus (sources différentes).
  for (const feat of sub.features_details ?? []) {
    const fromFeat = buildSubChoiceFromFeatureOptions(feat);
    if (fromFeat) choices.push(fromFeat);
  }

  return choices.filter((sc) => (sc.options?.length ?? 0) > 0);
}

function isRawSubclassOption(v: unknown): v is RawSubclassOption {
  return isRecord(v) && typeof v['id'] === 'string';
}

function normalizeSubclasses(subclasses: unknown): SubclassCatalog | Subclass[] | undefined {
  if (subclasses == null) return undefined;

  if (Array.isArray(subclasses)) {
    return subclasses.filter(isRawSubclassOption).map((sub) => ({
      ...sub,
      desc: tidyPlayerFacingCopy(sub.desc ?? sub.flavor?.summary ?? ''),
      features: normalizeFeaturesDetails(sub.features_details ?? sub.features ?? []),
      sub_choices: normalizeSubChoices(sub),
    }));
  }

  if (!isRecord(subclasses)) return undefined;
  const catalog = subclasses as RawSubclassCatalog;
  const rawOptions = Array.isArray(catalog.options)
    ? catalog.options.filter(isRawSubclassOption)
    : [];
  const levelUnlocked =
    (typeof catalog.level_unlocked === 'number' ? catalog.level_unlocked : undefined) ??
    (typeof catalog.unlocked_at_level === 'number' ? catalog.unlocked_at_level : undefined) ??
    (typeof catalog.subclass_level_unlocked === 'number'
      ? catalog.subclass_level_unlocked
      : undefined) ??
    3;

  return {
    unlocked_at_level:
      typeof catalog.unlocked_at_level === 'number' ? catalog.unlocked_at_level : undefined,
    level_unlocked: levelUnlocked,
    options: rawOptions.map((sub) => ({
      ...sub,
      desc: tidyPlayerFacingCopy(sub.desc ?? sub.flavor?.summary ?? ''),
      features: normalizeFeaturesDetails(sub.features_details ?? sub.features ?? []),
      sub_choices: normalizeSubChoices(sub),
    })),
  };
}

/** Adapte le schema 3.0 API vers le format attendu par le wizard. */
export function normalizeCharacterClass(cls: { id: string; name: string; data: Record<string, unknown> }): CharacterClass {
  const d = cls.data;

  if (d['proficiencies'] && Array.isArray(d['starting_equipment'])) {
    const flavor = normalizeClassFlavor(d['flavor']);
    return {
      id: cls.id,
      name: cls.name,
      data: {
        ...d,
        ...(flavor ? { flavor } : {}),
        hit_die: parseHitDie(d['hit_die']),
        primary_abilities: mapSavingThrows(d['primary_abilities']),
        proficiencies: readProficiencies(d['proficiencies']),
        starting_equipment: coerceEquipmentSlots(d['starting_equipment']),
        progression: readProgression(d['progression']),
      },
    };
  }

  const choicePoolsRaw = d['choice_pools'];
  const choicePools: RawChoicePool[] = Array.isArray(choicePoolsRaw)
    ? choicePoolsRaw.filter(isRawChoicePool)
    : [];
  const skillPool = choicePools.find((p) => p.type === 'skill_proficiency');
  const fallback = DEFAULT_SKILL_POOLS[cls.id];

  const rawOptions = Array.isArray(skillPool?.pool)
    ? skillPool.pool.map(String)
    : (fallback?.options ?? []);
  const skillOptions = rawOptions.map((id: string) =>
    id === 'any' || id === 'any-skills' || id === 'skill-any' ? 'any' : normalizeSkillId(id),
  );
  const skillCount = skillPool?.quantity ?? fallback?.count ?? 0;
  const flavor = normalizeClassFlavor(d['flavor']);

  const featuresRaw = d['features_details'];
  const subclassesRaw = d['subclasses'];
  return {
    id: cls.id,
    name: cls.name,
    data: {
      ...d,
      ...(flavor ? { flavor } : {}),
      hit_die: parseHitDie(d['hit_die']),
      primary_abilities: mapSavingThrows(d['primary_abilities']),
      proficiencies: {
        armor: Array.isArray(d['armor_proficiencies']) ? d['armor_proficiencies'].map(String) : [],
        weapons: Array.isArray(d['weapon_proficiencies']) ? d['weapon_proficiencies'].map(String) : [],
        saving_throws: mapSavingThrows(d['saving_throw_proficiencies']),
        tools: Array.isArray(d['tool_proficiencies']) ? d['tool_proficiencies'].map(String) : [],
        skills: {
          count: skillCount,
          options: skillOptions,
        },
      },
      progression: readProgression(d['progression']),
      features_details: normalizeFeaturesDetails(
        Array.isArray(featuresRaw) ? featuresRaw.filter(isRecord) : [],
      ),
      subclasses: normalizeSubclasses(
        Array.isArray(subclassesRaw)
          ? subclassesRaw.filter(isRecord)
          : isRecord(subclassesRaw)
            ? subclassesRaw
            : undefined,
      ),
      starting_equipment: normalizeStartingEquipment(d['starting_equipment'], choicePools),
    },
  };
}

function normalizeClassFlavor(
  raw: unknown,
): { summary?: string; lore_note?: string } | undefined {
  if (!isRecord(raw)) return undefined;
  const f = raw;
  const summary = typeof f['summary'] === 'string' ? f['summary'].trim() : '';
  const lore =
    (typeof f['lore_note'] === 'string' && f['lore_note']) ||
    (typeof f['loreNote'] === 'string' && f['loreNote']) ||
    '';
  if (!summary && !lore) return undefined;
  return {
    ...(summary ? { summary } : {}),
    ...(lore ? { lore_note: String(lore).trim() } : {}),
  };
}

export function normalizeCharacterClasses(classes: CharacterClass[]): CharacterClass[] {
  return classes.map(normalizeCharacterClass);
}
