import type { CampaignSessionMode } from '@core/models/Campaign/campaign';

export type RollMethod = 'dice' | 'encode';

/** Choix ponctuel (mode « Autre »). */
export type RollChoice = 'dice' | 'encode';

function normalizeMode(mode?: CampaignSessionMode | null): CampaignSessionMode {
  if (mode === 'in_person' || mode === 'other' || mode === 'online') return mode;
  return 'online';
}

/**
 * Policy de jet selon le mode de session.
 * - online → dés
 * - in_person → encode MJ
 * - other → choix UI obligatoire (défaut encode si absent)
 */
export function resolveRollPolicy(
  mode: CampaignSessionMode | null | undefined,
  userChoice?: RollChoice | null,
): RollMethod {
  switch (normalizeMode(mode)) {
    case 'online':
      return 'dice';
    case 'in_person':
      return 'encode';
    case 'other':
      return userChoice === 'dice' ? 'dice' : 'encode';
  }
}

/** Tirage uniforme 1..faces. */
export function rollDie(faces: number): number {
  const n = Math.max(1, Math.floor(faces));
  return Math.floor(Math.random() * n) + 1;
}

export interface ParsedDamageDice {
  count: number;
  faces: number;
  bonus: number;
}

/** Parse "1d8+3", "2d6", "1d4-1". */
export function parseDamageDice(expr: string | undefined | null): ParsedDamageDice | null {
  if (!expr?.trim()) return null;
  const m = expr.trim().replace(/\s+/g, '').match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  return {
    count: Math.max(1, Number(m[1])),
    faces: Math.max(2, Number(m[2])),
    bonus: m[3] ? Number(m[3]) : 0,
  };
}

export function rollDamageTotal(expr: string | undefined | null, extraBonus = 0): number | null {
  const parsed = parseDamageDice(expr);
  if (!parsed) return null;
  let sum = parsed.bonus + extraBonus;
  for (let i = 0; i < parsed.count; i++) {
    sum += rollDie(parsed.faces);
  }
  return Math.max(0, sum);
}

export interface AttackResolution {
  d20: number;
  total: number;
  targetAc: number | null;
  hit: boolean | null;
  critical: boolean;
  fumble: boolean;
}

export function resolveAttackRoll(
  d20: number,
  attackBonus: number,
  targetAc?: number | null,
): AttackResolution {
  const total = d20 + attackBonus;
  const critical = d20 === 20;
  const fumble = d20 === 1;
  let hit: boolean | null = null;
  if (targetAc != null && !Number.isNaN(targetAc)) {
    hit = critical || (!fumble && total >= targetAc);
  }
  return { d20, total, targetAc: targetAc ?? null, hit, critical, fumble };
}
