import type { Attack } from '@core/models/Character/character';
import type { Combatant, CombatantAttack } from '@core/models/Campaign/campaign';

/** Convertit les attaques de fiche en snapshot combat. */
export function snapshotAttacksFromCharacter(attacks: Attack[] | undefined | null): CombatantAttack[] {
  if (!attacks?.length) return [];
  return attacks.slice(0, 6).map((a) => {
    const parsed = parseDamageExpr(a.damage);
    return {
      name: a.name,
      attackBonus: a.attackBonus ?? 0,
      damageDice: parsed.dice,
      damageBonus: parsed.bonus,
      damageType: a.damageType,
    };
  });
}

function parseDamageExpr(damage: string | undefined): { dice?: string; bonus?: number } {
  if (!damage?.trim()) return {};
  const cleaned = damage.trim().replace(/\s+/g, '');
  const m = cleaned.match(/^(\d+d\d+)([+-]\d+)?/i);
  if (!m) return { dice: cleaned };
  return {
    dice: m[2] ? `${m[1]}${m[2]}` : m[1],
    bonus: m[2] ? Number(m[2]) : 0,
  };
}

export function isAllyCombatant(c: Combatant): boolean {
  return c.kind === 'player' || c.kind === 'npc';
}

export function isEnemyCombatant(c: Combatant): boolean {
  return c.kind === 'monster';
}

export function formatCombatLogLine(parts: {
  actor: string;
  target: string;
  attackName: string;
  d20: number;
  total: number;
  ac: number | null;
  hit: boolean | null;
  damage?: number | null;
}): string {
  const vs = parts.ac != null ? ` vs CA ${parts.ac}` : '';
  const hitLabel =
    parts.hit === true ? 'touché' : parts.hit === false ? 'raté' : 'jet';
  const dmg =
    parts.hit === true && parts.damage != null ? ` → ${parts.damage} dégâts` : '';
  return `${parts.actor} → ${parts.target} (${parts.attackName}) : ${parts.d20}+…=${parts.total}${vs} ${hitLabel}${dmg}`;
}

export function appendCombatLog(existing: string[] | undefined, line: string, max = 40): string[] {
  return [...(existing ?? []), line].slice(-max);
}

export function applyHpDelta(c: Combatant, delta: number): Combatant {
  if (c.currentHp == null && c.maxHp == null) {
    return { ...c, currentHp: Math.max(0, delta) };
  }
  const max = c.maxHp ?? c.currentHp ?? 0;
  const cur = c.currentHp ?? max;
  const next = Math.max(0, Math.min(max, cur + delta));
  return {
    ...c,
    currentHp: next,
    defeated: next <= 0 ? true : c.defeated && next > 0 ? false : c.defeated,
  };
}
