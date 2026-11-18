import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { invocationsForLevel, PACT_BOONS } from '../../data/warlock-invocations.data';
import {
  PROGRESSION_MAX_LEVEL,
  type ClassChoicePool,
  type ProgressionChoiceDef,
  metamagicOptions,
  optionsFromPoolIds,
  poolActiveAtLevel,
  poolQuantityAtLevel,
  prettyId,
  progressionData,
} from './shared';

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

export function classNeedsAsi(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): boolean {
  return countAsiSlots(cls, level, maxLevel) > 0;
}
