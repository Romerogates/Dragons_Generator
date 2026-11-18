/**
 * Types et helpers partagés des choix de progression de classe.
 */
import type { CharacterClass, FeatureDetail } from '@core/models/CharacterClasses/character-class';
import { metamagicLabel } from '../../data/metamagic-labels.data';
import { labelForGameId } from '../game-id-labels';

export const PROGRESSION_MAX_LEVEL = 20;

export interface ClassChoicePool {
  id?: string;
  type?: string;
  name?: string;
  quantity?: number;
  pool?: unknown[];
  options?: unknown[];
  unlocked_at_level?: number;
  unlock_level?: number;
  level_unlocked?: number;
  unlocked_at_levels?: number[];
  constraint_max_price_po?: number;
  fixed_features?: string[];
}

interface ProgressionChoicePoolActive {
  type?: string;
  quantity?: number;
  cumulative_total?: number;
  pool?: unknown[];
  label?: string;
  name?: string;
}

interface ProgressionSpellChoice {
  count?: number;
  quantity?: number;
  label?: string;
  name?: string;
}

interface ExtendedProgressionLevel {
  level: number;
  features?: string[];
  choice_pools_active?: ProgressionChoicePoolActive[];
  invocation_choices?: { count?: number }[];
  resources?: Record<string, number | string>;
  spell_choices?: ProgressionSpellChoice[];
  pact_boon_choices?: PactBoonChoice[];
  skill_choices?: SkillChoiceEntry[];
  level_up_choice_pools?: LevelUpChoicePool[];
}

interface PactBoonChoice {
  id?: string;
  pool?: string[];
  options?: string[];
  label?: string;
  count?: number;
  quantity?: number;
}

interface SkillChoiceEntry {
  id?: string;
  type?: string;
  label?: string;
  name?: string;
  quantity?: number;
  count?: number;
}

interface LevelUpChoicePool extends ClassChoicePool {
  pool_ref?: string;
}

type ProgressionClassData = CharacterClass['data'] & {
  choice_pools?: ClassChoicePool[];
  progression?: ExtendedProgressionLevel[];
  features_details?: FeatureDetail[];
};

interface MetamagicFeatureDetail extends FeatureDetail {
  mechanics?: {
    metamagic_options?: {
      id: string;
      name: string;
      effect?: string;
      cost_arcane_points?: unknown;
    }[];
  };
}

export function progressionData(cls: CharacterClass): ProgressionClassData {
  return cls.data as ProgressionClassData;
}

export interface ProgressionChoiceOption {
  id: string;
  name: string;
  desc: string;
}

export interface ProgressionChoiceDef {
  id: string;
  type: string;
  label: string;
  count: number;
  options: ProgressionChoiceOption[];
  deferred?: boolean;
  fixedFeatureIds?: string[];
  meta?: Record<string, unknown>;
}

export function unlockLevelOf(pool: ClassChoicePool): number {
  if (typeof pool?.unlocked_at_level === 'number') return pool.unlocked_at_level;
  if (typeof pool?.level_unlocked === 'number') return pool.level_unlocked;
  if (typeof pool?.unlock_level === 'number') return pool.unlock_level;
  if (Array.isArray(pool?.unlocked_at_levels) && pool.unlocked_at_levels.length) {
    return Math.min(...pool.unlocked_at_levels.map(Number));
  }
  const id = String(pool?.id ?? '');
  const m = id.match(/niv-?(\d+)/i) ?? id.match(/lvl(\d+)/i) ?? id.match(/lv(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return 1;
}

export function poolActiveAtLevel(pool: ClassChoicePool, level: number): boolean {
  if (Array.isArray(pool?.unlocked_at_levels) && pool.unlocked_at_levels.length) {
    return pool.unlocked_at_levels.some((l: number) => Number(l) <= level);
  }
  return unlockLevelOf(pool) <= level;
}

export function poolQuantityAtLevel(pool: ClassChoicePool, level: number): number {
  if (Array.isArray(pool?.unlocked_at_levels) && pool.unlocked_at_levels.length) {
    const hits = pool.unlocked_at_levels.filter((l: number) => Number(l) <= level).length;
    return Math.max(hits, pool.quantity ?? 1);
  }
  return pool.quantity ?? 1;
}

export function prettyId(id: string): string {
  if (id.startsWith('meta-')) return metamagicLabel(id);
  const labeled = labelForGameId(id);
  if (labeled && labeled !== id) return labeled;
  const pretty = id
    .replace(/^(feat-|style-|meta-|invoc-|ennemi-|terrain-|dragon-|pact-boon-|arcane-)/, '')
    .replace(/-/g, ' ');
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export function optionsFromPoolIds(
  ids: unknown[],
  details: {
    id: string;
    name?: string;
    desc?: string;
    description?: string;
    flavor?: { summary?: string };
  }[],
): ProgressionChoiceOption[] {
  const descOf = (feat: (typeof details)[number] | undefined) =>
    feat?.desc || feat?.description || feat?.flavor?.summary || '';
  return ids.map((raw) => {
    if (typeof raw === 'string') {
      const feat = details.find((f) => f.id === raw);
      return {
        id: raw,
        name: feat?.name ?? prettyId(raw),
        desc: descOf(feat),
      };
    }
    if (raw && typeof raw === 'object') {
      const obj = raw as { id?: string; name?: string; damage_type?: string };
      const id = obj.id ?? 'unknown';
      const feat = details.find((f) => f.id === id);
      const dmg = obj.damage_type ? ` (dégâts : ${obj.damage_type})` : '';
      return {
        id,
        name: (obj.name || feat?.name || prettyId(id)) + dmg,
        desc: descOf(feat),
      };
    }
    return { id: 'unknown', name: 'Option', desc: '' };
  });
}

export function metamagicOptions(cls: CharacterClass): ProgressionChoiceOption[] {
  const details = progressionData(cls).features_details ?? [];
  const feat = details.find((f) => f.id === 'feat-metamagie') as MetamagicFeatureDetail | undefined;
  const opts = feat?.mechanics?.metamagic_options as
    | { id: string; name: string; effect?: string; cost_arcane_points?: unknown }[]
    | undefined;
  if (opts?.length) {
    return opts.map((o) => ({
      id: o.id,
      name: o.name,
      desc: `${o.effect ?? ''} (coût : ${o.cost_arcane_points ?? '?'})`.trim(),
    }));
  }
  return [];
}

export function featureUnlockLevel(feat: Record<string, unknown> | undefined | null): number {
  const raw = (feat?.['level'] ?? feat?.['unlocks_at_level']) as unknown;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export type SubclassFeatureLike = Record<string, unknown> & {
  level?: number;
  mechanics?: Record<string, unknown>;
};

export function dedupeStrings(arr?: (string | undefined | null)[]): string[] {
  return [
    ...new Set(
      (arr ?? []).filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim()),
    ),
  ];
}

export function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return dedupeStrings(raw as string[]);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

export function dedupeSubclassFeatures(sub: {
  features?: SubclassFeatureLike[];
  features_details?: SubclassFeatureLike[];
}): SubclassFeatureLike[] {
  const byId = new Map<string, SubclassFeatureLike>();
  for (const feat of [...(sub.features ?? []), ...(sub.features_details ?? [])]) {
    const id = String(feat?.['id'] ?? '');
    const key = id || `anon-${byId.size}`;
    if (!byId.has(key)) byId.set(key, feat);
  }
  return [...byId.values()];
}
