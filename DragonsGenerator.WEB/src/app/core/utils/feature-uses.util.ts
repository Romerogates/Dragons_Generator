/**
 * Résolution des utilisations d'aptitudes (rage, ki, conduit divin, etc.)
 * à partir du JSON classe (uses / mechanics) et de la progression.
 */

export type FeatureUsesRecharge = 'unlimited' | 'short_rest' | 'long_rest';

export interface ResolvedFeatureUses {
  max: number;
  current: number;
  recharge: FeatureUsesRecharge;
}

export interface FeatureUsesInput {
  id?: string;
  rechargeType?: string;
  recharge?: string;
  uses?:
    | number
    | {
        formula?: string;
        base?: number;
        per_day?: number;
        per_rest?: number;
        source_column?: string;
        null_means_unlimited?: boolean;
        upgrades?: { at_level: number; value: number }[];
      };
  mechanics?: {
    points_formula?: string;
    uses_key?: string;
    upgrades?: { at_level: number; uses?: number; value?: number }[];
  };
}

export interface ClassProgressionLike {
  data?: {
    progression?: {
      level: number;
      resources?: Record<string, unknown>;
    }[];
  };
}

function mapRecharge(raw: string | undefined): FeatureUsesRecharge {
  if (raw === 'short_rest') return 'short_rest';
  if (raw === 'long_rest') return 'long_rest';
  if (raw === 'unlimited' || raw === 'at_will') return 'unlimited';
  return 'long_rest';
}

function resourceAtLevel(
  cls: ClassProgressionLike,
  level: number,
  key: string,
): unknown {
  const prog = cls.data?.progression?.find((p) => p.level === level);
  return prog?.resources?.[key];
}

function parseResourceMax(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const n = parseInt(String(val), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Extrait les ressources scalaires d'une ligne de progression. */
export function extractScalarResources(
  resources: Record<string, unknown> | undefined,
): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = {};
  for (const [k, v] of Object.entries(resources ?? {})) {
    if (v === null || typeof v === 'number' || typeof v === 'string') {
      out[k] = v as number | string | null;
    }
  }
  return out;
}

/**
 * Convertit uses / mechanics JSON en FeatureInstance.uses.
 * @param proficiencyBonus bonus de maîtrise (si formula = proficiency_bonus)
 */
export function resolveFeatureUses(
  feat: FeatureUsesInput,
  cls: ClassProgressionLike,
  level: number,
  proficiencyBonus = 2,
): ResolvedFeatureUses | undefined {
  const rechargeRaw = feat.rechargeType ?? feat.recharge;
  if (!rechargeRaw || rechargeRaw === 'passive') {
    // Ki / ressources sans recharge explicite mais avec points
    if (
      feat.id === 'feat-ki' ||
      feat.mechanics?.points_formula === 'class_level' ||
      feat.mechanics?.uses_key
    ) {
      // continue
    } else {
      return undefined;
    }
  }

  const recharge = mapRecharge(
    feat.rechargeType === 'special'
      ? 'long_rest'
      : feat.rechargeType ?? (rechargeRaw === 'at_will' ? 'unlimited' : rechargeRaw),
  );

  const rawUses = feat.uses;
  let max = 0;
  let resolved = false;

  if (typeof rawUses === 'number') {
    max = rawUses;
    resolved = true;
  } else if (rawUses && typeof rawUses === 'object') {
    if (typeof rawUses.source_column === 'string') {
      const val = resourceAtLevel(cls, level, rawUses.source_column);
      if (val === null && rawUses.null_means_unlimited) {
        return { max: 99, current: 99, recharge: 'unlimited' };
      }
      max = parseResourceMax(val);
      resolved = true;
    } else if (typeof rawUses.base === 'number') {
      max = rawUses.base;
      for (const up of rawUses.upgrades ?? []) {
        if (up.at_level <= level && typeof up.value === 'number') max = up.value;
      }
      resolved = true;
    } else if (typeof rawUses.per_day === 'number') {
      max = rawUses.per_day;
      resolved = true;
    } else if (typeof rawUses.per_rest === 'number') {
      max = rawUses.per_rest;
      resolved = true;
    } else if (typeof rawUses.formula === 'string') {
      const formula = rawUses.formula;
      if (/^\d+$/.test(formula)) {
        max = parseInt(formula, 10);
      } else if (formula.startsWith('table:')) {
        max = parseResourceMax(resourceAtLevel(cls, level, formula.replace('table:', '')));
      } else if (formula === 'proficiency_bonus') {
        max = proficiencyBonus;
      } else if (formula === 'monk_level' || formula === 'sorcerer_level' || formula === 'class_level') {
        max = level;
      } else if (formula === 'paladin_level*5') {
        max = level * 5;
      }
      resolved = true;
    }
  }

  // Ki : points = niveau de moine (table ki_points)
  if (!resolved || max === 0) {
    if (feat.id === 'feat-ki' || feat.mechanics?.points_formula === 'class_level') {
      const fromTable = resourceAtLevel(cls, level, 'ki_points');
      max = fromTable !== undefined ? parseResourceMax(fromTable) : level;
      resolved = true;
    }
  }

  // Conduit divin : mechanics.uses_key
  if (!resolved || (max === 0 && feat.mechanics?.uses_key)) {
    const key = feat.mechanics?.uses_key;
    if (key) {
      const fromTable = resourceAtLevel(cls, level, key);
      if (fromTable !== undefined) {
        max = parseResourceMax(fromTable);
        resolved = true;
      } else if (feat.mechanics?.upgrades?.length) {
        for (const up of feat.mechanics.upgrades) {
          if (up.at_level <= level) {
            max = up.uses ?? up.value ?? max;
          }
        }
        resolved = true;
      }
    }
  }

  if (!resolved && !rechargeRaw) return undefined;
  if (!resolved && rawUses == null && !feat.mechanics) return undefined;

  return { max, current: max, recharge };
}
