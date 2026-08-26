/**
 * Extraction des choix de progression de classe jusqu'à un niveau max (défaut 20).
 * Expertise / ASI sont marqués deferred (gérés ailleurs dans le wizard).
 */

import { invocationsForLevel, PACT_BOONS } from '../data/warlock-invocations.data';
import { metamagicLabel } from '../data/metamagic-labels.data';
import { labelForGameId } from './game-id-labels';

export const PROGRESSION_MAX_LEVEL = 20;

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

function isFightingStylePool(pool: any): boolean {
  const t = String(pool?.type ?? '');
  const id = String(pool?.id ?? '');
  return (
    t === 'fighting_style' ||
    /style.*combat|combat.*style|fighting.?style/i.test(id + t) ||
    (t === 'feature_option' && /style|combat|fighting/i.test(id))
  );
}

function unlockLevelOf(pool: any): number {
  if (typeof pool?.unlocked_at_level === 'number') return pool.unlocked_at_level;
  if (typeof pool?.unlock_level === 'number') return pool.unlock_level;
  if (Array.isArray(pool?.unlocked_at_levels) && pool.unlocked_at_levels.length) {
    return Math.min(...pool.unlocked_at_levels.map(Number));
  }
  const id = String(pool?.id ?? '');
  const m = id.match(/niv-?(\d+)/i) ?? id.match(/lvl(\d+)/i) ?? id.match(/lv(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return 1;
}

function poolActiveAtLevel(pool: any, level: number): boolean {
  if (Array.isArray(pool?.unlocked_at_levels) && pool.unlocked_at_levels.length) {
    return pool.unlocked_at_levels.some((l: number) => Number(l) <= level);
  }
  return unlockLevelOf(pool) <= level;
}

/** Quantité effective : pour unlocked_at_levels, 1 choix par palier atteint. */
function poolQuantityAtLevel(pool: any, level: number): number {
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

function metamagicOptions(cls: any): ProgressionChoiceOption[] {
  const feat = (cls?.data?.features_details ?? []).find((f: any) => f.id === 'feat-metamagie');
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
export function asiLevelsForClass(cls: any, level: number, maxLevel = PROGRESSION_MAX_LEVEL): number[] {
  if (!cls?.data?.progression) return [];
  const effective = Math.min(Math.max(1, level), maxLevel);
  const levels: number[] = [];
  for (const prog of cls.data.progression) {
    if (prog.level < 1 || prog.level > effective) continue;
    const feats: string[] = prog.features ?? [];
    if (feats.some((id) => isAsiFeatureId(String(id)))) {
      levels.push(prog.level);
    }
  }
  return levels;
}

export function countAsiSlots(cls: any, level: number, maxLevel = PROGRESSION_MAX_LEVEL): number {
  return asiLevelsForClass(cls, level, maxLevel).length;
}

/**
 * Choix interactifs de classe jusqu'à `maxLevel` (inclus), hors skills/équipement/style déjà gérés.
 */
export function extractProgressionChoices(
  cls: any,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  ctx?: { pactBoonId?: string | null },
): ProgressionChoiceDef[] {
  if (!cls?.data) return [];
  const effective = Math.min(Math.max(1, level), maxLevel);
  const details = (cls.data.features_details ?? []) as any[];
  const choices: ProgressionChoiceDef[] = [];
  const seen = new Set<string>();

  const push = (c: ProgressionChoiceDef) => {
    if (seen.has(c.id)) return;
    if (!c.deferred && (!c.options || c.options.length === 0)) return;
    seen.add(c.id);
    choices.push(c);
  };

  // --- Root choice_pools ---
  for (const pool of cls.data.choice_pools ?? []) {
    if (!poolActiveAtLevel(pool, effective)) continue;
    if (ROOT_SKIP_TYPES.has(String(pool.type ?? ''))) continue;
    if (isFightingStylePool(pool)) continue;

    const type = String(pool.type ?? 'option');
    const qty = poolQuantityAtLevel(pool, effective);

    if (type === 'expertise' || type === 'expertise_proficiency') {
      push({
        id: pool.id,
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
      id: pool.id,
      type,
      label: pool.name ?? 'Choix de classe',
      count: qty,
      options: optionsFromPoolIds(rawPool, details),
      fixedFeatureIds: pool.fixed_features ?? [],
    });
  }

  // --- Progression lines ≤ effective ---
  for (const prog of cls.data.progression ?? []) {
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
        typeof prog.resources?.invocations_known === 'number'
          ? prog.resources.invocations_known
          : (prog.invocation_choices[0].count ?? 2);
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
        id: pb.id,
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
          id: sc.id,
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
          (cls.data.choice_pools ?? []).find((p: any) => p.id === lup.pool_ref) ?? null;
        if (ref) {
          pool = { ...ref, id: lup.id, name: lup.name ?? ref.name, quantity: lup.quantity ?? 1 };
        }
      }
      const rawPool = pool.pool ?? [];
      push({
        id: pool.id,
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

/** Expertise deferred pour l'étape compétences. */
/** Niveaux de sort d'Arcane débloqués pour un sorcier au niveau donné. */
export function warlockArcanumSpellLevels(characterLevel: number): number[] {
  const slots: number[] = [];
  if (characterLevel >= 11) slots.push(6);
  if (characterLevel >= 13) slots.push(7);
  if (characterLevel >= 15) slots.push(8);
  if (characterLevel >= 17) slots.push(9);
  return slots;
}

export function extractExpertiseChoices(
  cls: any,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): ProgressionChoiceDef[] {
  return extractProgressionChoices(cls, level, maxLevel).filter(
    (c) => c.deferred && (c.type === 'expertise' || c.type === 'expertise_proficiency'),
  );
}

export function classNeedsAsi(
  cls: any,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): boolean {
  return countAsiSlots(cls, level, maxLevel) > 0;
}
