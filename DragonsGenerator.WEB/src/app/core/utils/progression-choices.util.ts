/**
 * Extraction des choix de progression de classe jusqu'à un niveau max (défaut 20).
 * Expertise / ASI sont marqués deferred (gérés ailleurs dans le wizard).
 */

import type { CharacterClass, FeatureDetail } from '@core/models/CharacterClasses/character-class';
import { invocationsForLevel, PACT_BOONS } from '../data/warlock-invocations.data';
import { metamagicLabel } from '../data/metamagic-labels.data';
import { labelForGameId } from './game-id-labels';

export const PROGRESSION_MAX_LEVEL = 20;

interface ClassChoicePool {
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

function progressionData(cls: CharacterClass): ProgressionClassData {
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
  /** Si true : ne pas afficher dans class-step (expertise → skills, ASI → abilities). */
  deferred?: boolean;
  /** Features fixes à injecter (ex. Empressement du lettré). */
  fixedFeatureIds?: string[];
  /** Métadonnées (ex. niveau de sort d'arcane). */
  meta?: Record<string, unknown>;
}

const ROOT_SKIP_TYPES = new Set([
  'skill_proficiency',
  'tool_proficiency',
  'language_proficiency',
  'language',
  'equipment',
  'starting_equipment',
  'weapon_proficiency',
  'subclass',
  'fighting_style',
]);

const ASI_FEATURE_RE = /augmentation.*caracteristique|feat-asi/i;

function isFightingStylePool(pool: ClassChoicePool): boolean {
  const t = String(pool?.type ?? '');
  const id = String(pool?.id ?? '');
  return (
    t === 'fighting_style' ||
    /style.*combat|combat.*style|fighting.?style/i.test(id + t) ||
    (t === 'feature_option' && /style|combat|fighting/i.test(id))
  );
}

function unlockLevelOf(pool: ClassChoicePool): number {
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

function poolActiveAtLevel(pool: ClassChoicePool, level: number): boolean {
  if (Array.isArray(pool?.unlocked_at_levels) && pool.unlocked_at_levels.length) {
    return pool.unlocked_at_levels.some((l: number) => Number(l) <= level);
  }
  return unlockLevelOf(pool) <= level;
}

/** Quantité effective : pour unlocked_at_levels, 1 choix par palier atteint. */
function poolQuantityAtLevel(pool: ClassChoicePool, level: number): number {
  if (Array.isArray(pool?.unlocked_at_levels) && pool.unlocked_at_levels.length) {
    const hits = pool.unlocked_at_levels.filter((l: number) => Number(l) <= level).length;
    return Math.max(hits, pool.quantity ?? 1);
  }
  return pool.quantity ?? 1;
}

function prettyId(id: string): string {
  if (id.startsWith('meta-')) return metamagicLabel(id);
  const labeled = labelForGameId(id);
  if (labeled && labeled !== id) return labeled;
  const pretty = id
    .replace(/^(feat-|style-|meta-|invoc-|ennemi-|terrain-|dragon-|pact-boon-|arcane-)/, '')
    .replace(/-/g, ' ');
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

function optionsFromPoolIds(
  ids: unknown[],
  details: { id: string; name?: string; desc?: string; flavor?: { summary?: string } }[],
): ProgressionChoiceOption[] {
  return ids.map((raw) => {
    if (typeof raw === 'string') {
      const feat = details.find((f) => f.id === raw);
      return {
        id: raw,
        name: feat?.name ?? prettyId(raw),
        desc: feat?.desc || feat?.flavor?.summary || '',
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
        desc: feat?.desc || feat?.flavor?.summary || '',
      };
    }
    return { id: 'unknown', name: 'Option', desc: '' };
  });
}

function metamagicOptions(cls: CharacterClass): ProgressionChoiceOption[] {
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

function isAsiFeatureId(id: string): boolean {
  return ASI_FEATURE_RE.test(id);
}

/** Niveaux où la classe gagne un ASI (dans la progression ≤ level). */
export function asiLevelsForClass(cls: CharacterClass, level: number, maxLevel = PROGRESSION_MAX_LEVEL): number[] {
  const data = progressionData(cls);
  if (!data.progression) return [];
  const effective = Math.min(Math.max(1, level), maxLevel);
  const levels: number[] = [];
  for (const prog of data.progression) {
    if (prog.level < 1 || prog.level > effective) continue;
    const feats: string[] = prog.features ?? [];
    if (feats.some((id) => isAsiFeatureId(String(id)))) {
      levels.push(prog.level);
    }
  }
  return levels;
}

export function countAsiSlots(cls: CharacterClass, level: number, maxLevel = PROGRESSION_MAX_LEVEL): number {
  return asiLevelsForClass(cls, level, maxLevel).length;
}

/**
 * Choix interactifs de classe jusqu'à `maxLevel` (inclus), hors skills/équipement/style déjà gérés.
 */
export function extractProgressionChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  ctx?: { pactBoonId?: string | null },
): ProgressionChoiceDef[] {
  const data = progressionData(cls);
  if (!data) return [];
  const effective = Math.min(Math.max(1, level), maxLevel);
  const details = data.features_details ?? [];
  const choices: ProgressionChoiceDef[] = [];
  const seen = new Set<string>();

  const push = (c: ProgressionChoiceDef) => {
    if (seen.has(c.id)) return;
    if (!c.deferred && (!c.options || c.options.length === 0)) return;
    seen.add(c.id);
    choices.push(c);
  };

  // --- Root choice_pools ---
  for (const pool of data.choice_pools ?? []) {
    if (!poolActiveAtLevel(pool, effective)) continue;

    const type = String(pool.type ?? 'option');
    const qty = poolQuantityAtLevel(pool, effective);

    if (type === 'weapon_proficiency' || type === 'tool_proficiency') {
      push({
        id: pool.id ?? `choice-${type}`,
        type,
        label:
          pool.name ??
          (type === 'weapon_proficiency' ? 'Armes maîtrisées' : "Maîtrises d'outils"),
        count: qty,
        options: [],
        deferred: true,
        meta: {
          poolIds: pool.pool ?? pool.options ?? [],
          maxPricePo:
            typeof pool.constraint_max_price_po === 'number'
              ? pool.constraint_max_price_po
              : undefined,
        },
      });
      continue;
    }

    if (isFightingStylePool(pool)) continue;
    if (ROOT_SKIP_TYPES.has(type)) continue;

    if (type === 'expertise' || type === 'expertise_proficiency') {
      push({
        id: pool.id ?? `choice-${type}`,
        type,
        label: pool.name ?? 'Expertise',
        count: qty,
        options: [],
        deferred: true,
      });
      continue;
    }

    const rawPool = pool.pool ?? pool.options ?? [];
    push({
      id: pool.id ?? `choice-${type}`,
      type,
      label: pool.name ?? 'Choix de classe',
      count: qty,
      options: optionsFromPoolIds(rawPool, details),
      fixedFeatureIds: pool.fixed_features ?? [],
    });
  }

  // --- Progression lines ≤ effective ---
  for (const prog of data.progression ?? []) {
    if (prog.level < 1 || prog.level > effective) continue;

    // Métamagie (cumul : un seul choix avec le total au niveau cible)
    for (const active of prog.choice_pools_active ?? []) {
      if (active.type === 'spell_known' || active.type === 'subclass') continue;
      if (active.type === 'metamagic') {
        const total =
          typeof active.cumulative_total === 'number'
            ? active.cumulative_total
            : (active.quantity ?? 2);
        const opts = metamagicOptions(cls).length
          ? metamagicOptions(cls)
          : optionsFromPoolIds(active.pool ?? [], details);
        const entry: ProgressionChoiceDef = {
          id: 'choice-metamagic-cumulative',
          type: 'metamagic',
          label: `Métamagie (${total})`,
          count: total,
          options: opts,
        };
        const metaIdx = choices.findIndex((c) => c.type === 'metamagic');
        if (metaIdx >= 0) {
          choices[metaIdx] = entry;
          seen.add(entry.id);
        } else {
          push(entry);
        }
      }
    }

    // Invocations (cumul)
    if ((prog.invocation_choices ?? []).length > 0) {
      const totalKnown =
        typeof prog.resources?.['invocations_known'] === 'number'
          ? Number(prog.resources['invocations_known'])
          : (prog.invocation_choices?.[0]?.count ?? 2);
      const entry: ProgressionChoiceDef = {
        id: 'choice-invocations-cumulative',
        type: 'invocation',
        label: `Manifestations occultes (${totalKnown})`,
        count: totalKnown,
        options: invocationsForLevel(effective, ctx?.pactBoonId ?? null).map((o) => ({
          id: o.id,
          name: o.name,
          desc: o.desc,
        })),
      };
      const existing = choices.findIndex((c) => c.type === 'invocation');
      if (existing >= 0) {
        choices[existing] = entry;
        seen.add(entry.id);
      } else {
        push(entry);
      }
    }

    // Pact boon
    for (const pb of prog.pact_boon_choices ?? []) {
      const poolIds: string[] = pb.pool ?? pb.options ?? [];
      push({
        id: pb.id ?? 'choice-pact-boon',
        type: 'pact_boon',
        label: pb.label ?? 'Faveur du pacte',
        count: pb.count ?? pb.quantity ?? 1,
        options: (poolIds.length ? poolIds : PACT_BOONS.map((p) => p.id)).map((id) => {
          const boon = PACT_BOONS.find((p) => p.id === id);
          return {
            id,
            name: boon?.name ?? prettyId(id),
            desc: boon?.desc ?? '',
          };
        }),
      });
    }

    // Expertise (barde skill_choices)
    for (const sc of prog.skill_choices ?? []) {
      if (sc.type === 'expertise' || sc.type === 'expertise_proficiency') {
        push({
          id: sc.id ?? `choice-expertise-${prog.level}`,
          type: 'expertise',
          label: sc.label ?? sc.name ?? `Expertise (niv. ${prog.level})`,
          count: sc.quantity ?? sc.count ?? 2,
          options: [],
          deferred: true,
        });
      }
    }

    // level_up_choice_pools (rôdeur terrain / ennemi)
    for (const lup of prog.level_up_choice_pools ?? []) {
      let pool = lup;
      if (lup.pool_ref) {
        const ref =
          (data.choice_pools ?? []).find((p) => p.id === lup.pool_ref) ?? null;
        if (ref) {
          pool = { ...ref, id: lup.id, name: lup.name ?? ref.name, quantity: lup.quantity ?? 1 };
        }
      }
      const rawPool = pool.pool ?? [];
      push({
        id: pool.id ?? `choice-${String(pool.type ?? 'option')}`,
        type: String(pool.type ?? 'option'),
        label: pool.name ?? `Choix de progression (niv. ${prog.level})`,
        count: pool.quantity ?? 1,
        options: optionsFromPoolIds(rawPool, details),
      });
    }
  }

  // --- ASI deferred : un slot par niveau ASI ---
  const asiLvls = asiLevelsForClass(cls, effective, maxLevel);
  if (asiLvls.length) {
    push({
      id: 'choice-asi-slots',
      type: 'asi',
      label: `Augmentation de caractéristique (${asiLvls.length}× : niv. ${asiLvls.join(', ')})`,
      count: asiLvls.length,
      options: [],
      deferred: true,
      meta: { levels: asiLvls },
    });
  }

  // --- Arcanes : gérées dans magic-step (sélecteur de sorts réels) ---

  // Ordre UX
  const priority = (c: ProgressionChoiceDef): number => {
    if (c.type === 'pact_boon') return 10;
    if (c.type === 'enemy_type') return 20;
    if (c.type === 'terrain_preference') return 30;
    if (c.type === 'metamagic') return 40;
    if (c.type === 'feature_selection') return 50;
    if (c.type === 'invocation') return 60;
    if (c.type === 'asi') return 90;
    if (c.deferred) return 95;
    return 75;
  };
  choices.sort((a, b) => priority(a) - priority(b));

  return choices;
}

/** Niveaux de sort d'Arcane débloqués pour un sorcier au niveau donné. */
export function warlockArcanumSpellLevels(characterLevel: number): number[] {
  const slots: number[] = [];
  if (characterLevel >= 11) slots.push(6);
  if (characterLevel >= 13) slots.push(7);
  if (characterLevel >= 15) slots.push(8);
  if (characterLevel >= 17) slots.push(9);
  return slots;
}

/** Jalons d'apprentissage de sorts (niv. 1–20) pour l'étape Magie. */
export function spellProgressionMilestones(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): { level: number; count: number; label: string }[] {
  const data = progressionData(cls);
  if (!data.progression) return [];
  const effective = Math.min(Math.max(1, level), maxLevel);
  const out: { level: number; count: number; label: string }[] = [];
  for (const prog of data.progression) {
    if (prog.level < 1 || prog.level > effective) continue;
    for (const sc of prog.spell_choices ?? []) {
      out.push({
        level: prog.level,
        count: sc.count ?? sc.quantity ?? 1,
        label: sc.label ?? sc.name ?? 'Sort appris',
      });
    }
    for (const active of prog.choice_pools_active ?? []) {
      if (active.type === 'spell_known') {
        out.push({
          level: prog.level,
          count: active.quantity ?? active.cumulative_total ?? 1,
          label: active.label ?? active.name ?? 'Sort connu',
        });
      }
      if (active.type === 'cantrip') {
        out.push({
          level: prog.level,
          count: active.quantity ?? 1,
          label: active.label ?? 'Tour de magie',
        });
      }
    }
  }
  return out.sort((a, b) => a.level - b.level);
}

export function extractExpertiseChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): ProgressionChoiceDef[] {
  return extractProgressionChoices(cls, level, maxLevel).filter(
    (c) => c.deferred && (c.type === 'expertise' || c.type === 'expertise_proficiency'),
  );
}

export function extractWeaponProficiencyChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): ProgressionChoiceDef[] {
  const fromRoot = extractProgressionChoices(cls, level, maxLevel).filter(
    (c) => c.deferred && c.type === 'weapon_proficiency',
  );
  const fromSubclass = extractSubclassWeaponProficiencyChoices(cls, level, maxLevel, subclassId);
  const seen = new Set(fromRoot.map((c) => c.id));
  return [...fromRoot, ...fromSubclass.filter((c) => !seen.has(c.id))];
}

/** Armes de sous-classe (ex. Mage de Guerre) différées vers l'étape Savoirs. */
function extractSubclassWeaponProficiencyChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): ProgressionChoiceDef[] {
  if (!subclassId) return [];
  const data = progressionData(cls);
  const subs = data.subclasses as
    | { options?: { id?: string; choice_pools?: ClassChoicePool[] }[] }
    | { id?: string; choice_pools?: ClassChoicePool[] }[]
    | undefined;
  if (!subs) return [];

  const options = Array.isArray(subs) ? subs : (subs.options ?? []);
  const sub = options.find((o) => o.id === subclassId);
  if (!sub?.choice_pools?.length) return [];

  const effective = Math.min(Math.max(1, level), maxLevel);
  const out: ProgressionChoiceDef[] = [];
  for (const pool of sub.choice_pools) {
    if (String(pool.type ?? '') !== 'weapon_proficiency') continue;
    if (!poolActiveAtLevel(pool, effective)) continue;
    out.push({
      id: pool.id ?? `choice-weapon-${subclassId}`,
      type: 'weapon_proficiency',
      label: pool.name ?? 'Armes maîtrisées',
      count: poolQuantityAtLevel(pool, effective),
      options: [],
      deferred: true,
      meta: {
        poolIds: pool.pool ?? pool.options ?? [],
        maxPricePo:
          typeof pool.constraint_max_price_po === 'number'
            ? pool.constraint_max_price_po
            : undefined,
      },
    });
  }
  return out;
}

export function extractToolProficiencyChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): ProgressionChoiceDef[] {
  const fromRoot = extractProgressionChoices(cls, level, maxLevel).filter(
    (c) => c.deferred && c.type === 'tool_proficiency',
  );
  const fromSubclass = extractSubclassToolProficiencyChoices(cls, level, maxLevel, subclassId);
  const seen = new Set(fromRoot.map((c) => c.id));
  return [...fromRoot, ...fromSubclass.filter((c) => !seen.has(c.id))];
}

/** Outils de sous-classe (ex. Espion matériel de jeu) différés vers Savoirs. */
function extractSubclassToolProficiencyChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): ProgressionChoiceDef[] {
  if (!subclassId) return [];
  const data = progressionData(cls);
  const subs = data.subclasses as
    | {
        options?: {
          id?: string;
          choice_pools?: ClassChoicePool[];
          features?: { id?: string; level?: number; mechanics?: Record<string, unknown> }[];
          features_details?: { id?: string; level?: number; mechanics?: Record<string, unknown> }[];
        }[];
      }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return [];

  const effective = Math.min(Math.max(1, level), maxLevel);
  const out: ProgressionChoiceDef[] = [];

  for (const pool of sub.choice_pools ?? []) {
    if (String(pool.type ?? '') !== 'tool_proficiency') continue;
    if (!poolActiveAtLevel(pool, effective)) continue;
    out.push({
      id: pool.id ?? `choice-tool-${subclassId}`,
      type: 'tool_proficiency',
      label: pool.name ?? "Maîtrises d'outils",
      count: poolQuantityAtLevel(pool, effective),
      options: [],
      deferred: true,
      meta: { poolIds: pool.pool ?? pool.options ?? [] },
    });
  }

  const feats = [...(sub.features ?? []), ...(sub.features_details ?? [])];
  for (const feat of feats) {
    const featLevel = Number(feat.level ?? 1);
    if (featLevel > effective) continue;
    const choice = feat.mechanics?.['grants_tool_proficiency_choice'] as
      | { type?: string; pool?: unknown[]; quantity?: number }
      | undefined;
    if (!choice) continue;
    out.push({
      id: `choice-tool-${feat.id ?? subclassId}`,
      type: 'tool_proficiency',
      label: "Matériel de jeu (Espion)",
      count: choice.quantity ?? 1,
      options: [],
      deferred: true,
      meta: { poolIds: choice.pool ?? [] },
    });
  }

  return out;
}

/** Langues supplémentaires de classe (ex. Lettré ×3, Espion) → étape Langues. */
export function classBonusLanguageCount(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): number {
  const pools = progressionData(cls).choice_pools;
  const effective = Math.min(Math.max(1, level), maxLevel);
  let total = 0;
  if (pools?.length) {
    for (const pool of pools) {
      const type = String(pool.type ?? '');
      if (type !== 'language_proficiency' && type !== 'language') continue;
      if (!poolActiveAtLevel(pool, effective)) continue;
      total += poolQuantityAtLevel(pool, effective);
    }
  }
  total += subclassBonusLanguageCount(cls, effective, subclassId);
  return total;
}

function subclassBonusLanguageCount(
  cls: CharacterClass,
  level: number,
  subclassId?: string | null,
): number {
  if (!subclassId) return 0;
  const data = progressionData(cls);
  const subs = data.subclasses as
    | {
        options?: {
          id?: string;
          features?: { level?: number; mechanics?: Record<string, unknown> }[];
          features_details?: { level?: number; mechanics?: Record<string, unknown> }[];
        }[];
      }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return 0;

  let total = 0;
  const feats = [...(sub.features ?? []), ...(sub.features_details ?? [])];
  for (const feat of feats) {
    const bonuses = feat.mechanics?.['language_bonus'] as
      | { at_level?: number; quantity?: number }[]
      | undefined;
    if (!Array.isArray(bonuses)) continue;
    for (const b of bonuses) {
      if ((b.at_level ?? 99) <= level) total += b.quantity ?? 1;
    }
  }
  return total;
}

/** Outils fixes accordés par une sous-classe (ex. Espion déguisement / faussaire). */
export function subclassFixedToolProficiencies(
  cls: CharacterClass,
  level: number,
  subclassId?: string | null,
): string[] {
  if (!subclassId) return [];
  const data = progressionData(cls);
  const subs = data.subclasses as
    | {
        options?: {
          id?: string;
          features?: { level?: number; mechanics?: Record<string, unknown> }[];
          features_details?: { level?: number; mechanics?: Record<string, unknown> }[];
        }[];
      }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return [];

  const tools: string[] = [];
  const feats = [...(sub.features ?? []), ...(sub.features_details ?? [])];
  for (const feat of feats) {
    if ((feat.level ?? 1) > level) continue;
    const granted = feat.mechanics?.['grants_tool_proficiencies'];
    if (Array.isArray(granted)) {
      for (const id of granted) {
        if (typeof id === 'string' && id.trim()) tools.push(id.trim());
      }
    }
  }
  return [...new Set(tools)];
}

export function classNeedsAsi(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): boolean {
  return countAsiSlots(cls, level, maxLevel) > 0;
}
