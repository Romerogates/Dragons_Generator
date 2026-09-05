import type {
  CharacterClass,
  FeatureDetail,
  Subclass,
  SubclassCatalog,
} from '@core/models/CharacterClasses/character-class';
import type { Ability } from '@core/models/CharacterClasses/character-class';
import { normalizeSkillId } from './skill.utils';
import { normalizeItemRef } from './equipment.utils';

interface RawFeatureDetail {
  id?: string;
  name?: string;
  desc?: string;
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

interface RawSubclassOption extends Subclass {
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

function mapSavingThrows(raw: string[] | undefined): Ability[] {
  return (raw ?? [])
    .map((a) => ABILITY_MAP[a.toLowerCase()] ?? (a as Ability))
    .filter(Boolean);
}

function normalizeFeaturesDetails(features: RawFeatureDetail[]): FeatureDetail[] {
  return (features ?? []).map((f) => {
    const description =
      typeof (f as { description?: unknown }).description === 'string'
        ? (f as { description: string }).description
        : '';
    return {
      ...f,
      id: f.id ?? '',
      name: f.name ?? '',
      desc: description || f.desc || f.flavor?.summary || '',
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

function normalizeStartingEquipment(se: unknown, topLevelPools: RawChoicePool[] = []): unknown[] {
  if (Array.isArray(se)) return se;

  const slots: unknown[] = [];
  let slotNum = 1;

  const obj = se && typeof se === 'object' ? (se as Record<string, unknown>) : {};

  const fixed = obj['fixed'] as unknown[] | undefined;
  if (fixed?.length) {
    slots.push({
      slot: slotNum++,
      description: 'Équipement de départ',
      fixed: fixed.map(normalizeItemRef),
    });
  }

  const pools = (obj['choice_pools'] as RawChoicePool[]) ?? [];
  for (const pool of pools) {
    slots.push({
      slot: slotNum++,
      description: pool.name ?? "Choix d'équipement",
      alternatives: (pool.options ?? pool.pool ?? []).map(mapOptionItems),
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

function normalizeSubclasses(subclasses: RawSubclassCatalog | Subclass[] | undefined): SubclassCatalog | Subclass[] | undefined {
  if (!subclasses) return subclasses;

  if (Array.isArray(subclasses)) {
    return subclasses.map((sub) => ({
      ...sub,
      desc: sub.desc ?? (sub as RawSubclassOption).flavor?.summary ?? '',
      features: normalizeFeaturesDetails(
        (sub as RawSubclassOption).features_details ?? sub.features ?? [],
      ),
      sub_choices: normalizeSubChoices(sub as RawSubclassOption),
    }));
  }

  const catalog = subclasses as RawSubclassCatalog;
  const levelUnlocked =
    catalog.level_unlocked ?? catalog.unlocked_at_level ?? catalog.subclass_level_unlocked ?? 3;

  return {
    ...catalog,
    level_unlocked: levelUnlocked,
    options: (catalog.options ?? []).map((sub) => ({
      ...sub,
      desc: sub.desc ?? sub.flavor?.summary ?? '',
      features: normalizeFeaturesDetails(sub.features_details ?? sub.features ?? []),
      sub_choices: normalizeSubChoices(sub),
    })),
  } as SubclassCatalog;
}

/** Adapte le schema 3.0 API vers le format attendu par le wizard. */
export function normalizeCharacterClass(cls: CharacterClass): CharacterClass {
  const d = cls.data as Record<string, unknown>;

  if (d['proficiencies'] && Array.isArray(d['starting_equipment'])) {
    const flavor = normalizeClassFlavor(d['flavor']);
    return {
      ...cls,
      data: {
        ...d,
        ...(flavor ? { flavor } : {}),
        hit_die: parseHitDie(d['hit_die']),
        primary_abilities: mapSavingThrows(
          (d['primary_abilities'] as string[]) ?? [],
        ),
      } as CharacterClass['data'],
    };
  }

  const choicePools = (d['choice_pools'] as RawChoicePool[]) ?? [];
  const skillPool = choicePools.find((p) => p.type === 'skill_proficiency');
  const fallback = DEFAULT_SKILL_POOLS[cls.id];

  const rawOptions = (skillPool?.pool as string[] | undefined) ?? fallback?.options ?? [];
  const skillOptions = rawOptions.map((id: string) =>
    id === 'any' || id === 'any-skills' || id === 'skill-any' ? 'any' : normalizeSkillId(id),
  );
  const skillCount = skillPool?.quantity ?? fallback?.count ?? 0;
  const flavor = normalizeClassFlavor(d['flavor']);

  return {
    ...cls,
    data: {
      ...d,
      ...(flavor ? { flavor } : {}),
      hit_die: parseHitDie(d['hit_die']),
      primary_abilities: mapSavingThrows(
        (d['primary_abilities'] as string[]) ?? [],
      ),
      proficiencies: {
        armor: (d['armor_proficiencies'] as string[]) ?? [],
        weapons: (d['weapon_proficiencies'] as string[]) ?? [],
        saving_throws: mapSavingThrows(d['saving_throw_proficiencies'] as string[]),
        tools: (d['tool_proficiencies'] as string[]) ?? [],
        skills: {
          count: skillCount,
          options: skillOptions,
        },
      },
      features_details: normalizeFeaturesDetails((d['features_details'] as RawFeatureDetail[]) ?? []),
      subclasses: normalizeSubclasses(d['subclasses'] as RawSubclassCatalog | Subclass[] | undefined),
      starting_equipment: normalizeStartingEquipment(
        d['starting_equipment'],
        choicePools,
      ) as CharacterClass['data']['starting_equipment'],
    } as CharacterClass['data'],
  };
}

function normalizeClassFlavor(
  raw: unknown,
): { summary?: string; lore_note?: string } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
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
