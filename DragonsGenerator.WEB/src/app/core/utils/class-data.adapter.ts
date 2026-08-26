import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Ability } from '@core/models/CharacterClasses/character-class';
import { normalizeSkillId } from './skill.utils';
import { normalizeItemRef } from './equipment.utils';

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

function normalizeFeaturesDetails(features: any[]): any[] {
  return (features ?? []).map((f) => ({
    ...f,
    desc: f.desc ?? f.flavor?.summary ?? '',
    level: f.level ?? f.unlocks_at_level ?? 1,
    rechargeType: mapRecharge(f.recharge),
    uses: f.uses ?? undefined,
  }));
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

function normalizeStartingEquipment(se: unknown, topLevelPools: any[] = []): unknown[] {
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

  const pools = (obj['choice_pools'] as any[]) ?? [];
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

function extractChoiceLevel(pool: any): number {
  if (typeof pool?.level_unlocked === 'number') return pool.level_unlocked;
  if (typeof pool?.unlocked_at_level === 'number') return pool.unlocked_at_level;
  const id = String(pool?.id ?? '');
  const fromId = id.match(/lvl(\d+)/i) ?? id.match(/niv-?(\d+)/i);
  if (fromId) return parseInt(fromId[1], 10);
  return 1;
}

/** Convertit choice_pools de sous-classe en sub_choices consommables par le wizard. */
function normalizeSubChoices(sub: any): any[] {
  if (Array.isArray(sub?.sub_choices) && sub.sub_choices.length > 0) {
    return sub.sub_choices.map((sc: any) => ({
      ...sc,
      count: sc.count ?? sc.quantity ?? 1,
      level_required: sc.level_required ?? sc.level_unlocked ?? 1,
      label: sc.label ?? sc.name ?? 'Choix',
      options: sc.options ?? sc.pool ?? [],
    }));
  }

  return (sub?.choice_pools ?? [])
    .filter((pool: any) => {
      const t = String(pool?.type ?? '');
      // Outils / langues : gérés plus loin. skill_proficiency sous-classe (ex. collège des conteurs) reste ici.
      return !['tool_proficiency', 'language', 'language_proficiency'].includes(t);
    })
    .map((pool: any) => ({
      id: pool.id,
      type: pool.type ?? 'option',
      count: pool.quantity ?? 1,
      level_required: extractChoiceLevel(pool),
      label: pool.name ?? 'Choix',
      options: pool.pool ?? [],
    }));
}

function normalizeSubclasses(subclasses: any): any {
  if (!subclasses) return subclasses;

  const levelUnlocked =
    subclasses.level_unlocked ?? subclasses.unlocked_at_level ?? subclasses.subclass_level_unlocked ?? 3;

  return {
    ...subclasses,
    level_unlocked: levelUnlocked,
    options: (subclasses.options ?? []).map((sub: any) => ({
      ...sub,
      desc: sub.desc ?? sub.flavor?.summary ?? '',
      // Ne pas filtrer ici : le wizard filtre selon targetLevel à l'application.
      features: normalizeFeaturesDetails(sub.features_details ?? sub.features ?? []),
      sub_choices: normalizeSubChoices(sub),
    })),
  };
}

/** Adapte le schema 3.0 API vers le format attendu par le wizard. */
export function normalizeCharacterClass(cls: CharacterClass): CharacterClass {
  const d = cls.data as Record<string, unknown>;

  if (d['proficiencies'] && Array.isArray(d['starting_equipment'])) {
    return {
      ...cls,
      data: {
        ...d,
        hit_die: parseHitDie(d['hit_die']),
        primary_abilities: mapSavingThrows(
          (d['primary_abilities'] as string[]) ?? [],
        ),
      } as CharacterClass['data'],
    };
  }

  const choicePools = (d['choice_pools'] as any[]) ?? [];
  const skillPool = choicePools.find((p) => p.type === 'skill_proficiency');
  const fallback = DEFAULT_SKILL_POOLS[cls.id];

  const rawOptions: string[] = skillPool?.pool ?? fallback?.options ?? [];
  const skillOptions = rawOptions.map((id: string) =>
    id === 'any' || id === 'any-skills' || id === 'skill-any' ? 'any' : normalizeSkillId(id),
  );
  const skillCount = skillPool?.quantity ?? fallback?.count ?? 0;

  return {
    ...cls,
    data: {
      ...d,
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
      features_details: normalizeFeaturesDetails(d['features_details'] as any[]),
      subclasses: normalizeSubclasses(d['subclasses']),
      starting_equipment: normalizeStartingEquipment(
        d['starting_equipment'],
        choicePools,
      ) as CharacterClass['data']['starting_equipment'],
    } as CharacterClass['data'],
  };
}

export function normalizeCharacterClasses(classes: CharacterClass[]): CharacterClass[] {
  return classes.map(normalizeCharacterClass);
}
