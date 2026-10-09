import type {
  ActiveCombat,
  CampaignData,
  Combatant,
  CombatantAttack,
} from '@core/models/Campaign/campaign';
import { appendCombatLog, applyHpDelta } from './combat-action.util';
import type { AttackResolution } from './combat-roll.util';
import {
  advanceTurn,
  canReorderCombatantInTurnOrder,
  createCombatant,
  createInitiativeCode,
  currentTurnCombatant,
  freezeTurnOrderIds,
  moveCombatantToTurnIndex,
  reorderCombatantInTurnOrder,
  syncEncountersFromCombatants,
} from './combat-tracker.util';

export function combatOpeningInitiativeCollection(combat: ActiveCombat): ActiveCombat {
  return {
    ...combat,
    collectingInitiative: true,
    initiativeCode: combat.initiativeCode || createInitiativeCode(),
  };
}

export function combatClosingInitiativeCollection(combat: ActiveCombat): ActiveCombat {
  return {
    ...combat,
    collectingInitiative: false,
    turnOrderIds: freezeTurnOrderIds(combat),
    turnIndex: 0,
  };
}

export function combatWithAppended(combat: ActiveCombat, added: Combatant[]): ActiveCombat {
  return { ...combat, combatants: [...combat.combatants, ...added] };
}

export function combatAfterRemoveCombatant(combat: ActiveCombat, combatantId: string): ActiveCombat {
  const combatants = combat.combatants.filter((c) => c.id !== combatantId);
  const turnOrderIds = combat.turnOrderIds?.filter((id) => id !== combatantId);
  const turnIndex = Math.min(combat.turnIndex, Math.max(0, combatants.length - 1));
  return { ...combat, combatants, turnOrderIds, turnIndex };
}

export function mapCombatant(
  combat: ActiveCombat,
  combatantId: string,
  map: (c: Combatant) => Combatant,
): ActiveCombat {
  return {
    ...combat,
    combatants: combat.combatants.map((c) => (c.id === combatantId ? map(c) : c)),
  };
}

export function defaultAllyCombatant(): Combatant {
  return createCombatant({ name: 'Allié', kind: 'npc', armorClass: 10, initiativeBonus: 0 });
}

export function defaultEnemyCombatant(): Combatant {
  return createCombatant({
    name: 'Adversaire',
    kind: 'monster',
    armorClass: 10,
    initiativeBonus: 0,
  });
}

export function parseOptionalHp(raw: string | number): number | undefined {
  if (raw === '' || raw === undefined) return undefined;
  return +raw;
}

export function defeatedFromHp(currentHp: number | undefined, previous: boolean): boolean {
  if (currentHp !== undefined && currentHp <= 0) return true;
  if (currentHp !== undefined && currentHp > 0) return false;
  return previous;
}

export function clampCurrentHpToMax(
  currentHp: number | undefined,
  maxHp: number | undefined,
): number | undefined {
  if (maxHp != null && currentHp != null && currentHp > maxHp) return maxHp;
  return currentHp;
}

export function combatantAfterHpRaw(current: Combatant, raw: string | number): Combatant {
  const currentHp = parseOptionalHp(raw);
  return {
    ...current,
    currentHp,
    defeated: defeatedFromHp(currentHp, current.defeated ?? false),
  };
}

export function combatantAfterMaxHpRaw(current: Combatant, raw: string | number): {
  maxHp: number | undefined;
  currentHp: number | undefined;
} {
  const maxHp = raw === '' || raw === undefined ? undefined : Math.max(0, +raw);
  return { maxHp, currentHp: clampCurrentHpToMax(current.currentHp, maxHp) };
}

export function combatantAfterDefeatedToggle(c: Combatant, defeated: boolean): Combatant {
  return {
    ...c,
    defeated,
    currentHp: defeated ? 0 : (c.maxHp ?? c.currentHp),
  };
}

export function conditionsFromRaw(raw: string): string[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const conditions = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  return conditions.length ? conditions : undefined;
}

export function nextConditionsToggle(
  current: string[] | undefined,
  condition: string,
): string[] | undefined {
  const next = new Set(current ?? []);
  if (next.has(condition)) next.delete(condition);
  else next.add(condition);
  return next.size ? [...next] : undefined;
}

export function conditionsWithout(
  current: string[] | undefined,
  condition: string,
): string[] | undefined {
  if (!current?.length) return current;
  const conditions = current.filter((c) => c !== condition);
  return conditions.length ? conditions : undefined;
}

export function withAddedAttack(c: Combatant): Combatant {
  return {
    ...c,
    attacks: [...(c.attacks ?? []), { name: 'Attaque', attackBonus: 0, damageDice: '1d6' }],
  };
}

export function withRemovedAttack(c: Combatant, index: number): Combatant {
  if (!c.attacks?.length) return c;
  const attacks = c.attacks.filter((_, i) => i !== index);
  return { ...c, attacks: attacks.length ? attacks : undefined };
}

export function withPatchedAttack(
  c: Combatant,
  index: number,
  patch: Partial<CombatantAttack>,
): Combatant {
  if (!c.attacks?.length) return c;
  const attacks = c.attacks.map((a, i) => (i === index ? { ...a, ...patch } : a));
  return { ...c, attacks };
}

export const GENERIC_COMBAT_ATTACK: CombatantAttack = {
  name: 'Attaque',
  attackBonus: 0,
  damageDice: '1d6',
};

export function attackAt(turn: Combatant, index: number): CombatantAttack {
  return turn.attacks?.[index] ?? GENERIC_COMBAT_ATTACK;
}

export function combatAfterAdvanceTurn(
  combat: ActiveCombat,
  direction: 1 | -1,
): { combat: ActiveCombat; nextName: string | null } {
  const patch = advanceTurn(combat, direction);
  const next = { ...combat, ...patch };
  return { combat: next, nextName: currentTurnCombatant(next)?.name?.trim() || null };
}

export function combatAfterReorderTurn(
  combat: ActiveCombat,
  combatantId: string,
  direction: -1 | 1,
): ActiveCombat | null {
  if (!canReorderCombatantInTurnOrder(combat, combatantId, direction)) return null;
  const patch = reorderCombatantInTurnOrder(combat, combatantId, direction);
  if (!patch.turnOrderIds) return null;
  return { ...combat, ...patch };
}

export function combatAfterDropTurn(
  combat: ActiveCombat,
  combatantId: string,
  toIndex: number,
): ActiveCombat | null {
  const patch = moveCombatantToTurnIndex(combat, combatantId, toIndex);
  if (!patch.turnOrderIds) return null;
  return { ...combat, ...patch };
}

export function attackMissLabel(resolution: AttackResolution): string {
  if (resolution.fumble) return 'Échec critique';
  if (resolution.hit === false) return 'Raté';
  return `Jet ${resolution.total} (pas de CA cible)`;
}

export function attackTouchLabel(
  targetName: string,
  resolution: AttackResolution,
): string {
  const touch = resolution.critical ? `Critique ! touche ${targetName}` : `touche ${targetName}`;
  return `${touch} (${resolution.total} vs CA ${resolution.targetAc ?? '?'}) — lancez les dégâts.`;
}

/** Une écriture : PV + journal + sync rencontres. */
export function campaignDataAfterDmDamage(
  data: CampaignData,
  sessionId: string,
  combat: ActiveCombat,
  targetId: string,
  damage: number,
  logLine: string,
): CampaignData {
  const combatants = combat.combatants.map((cb) =>
    cb.id === targetId ? applyHpDelta(cb, -damage) : cb,
  );
  const nextCombat = { ...combat, combatants };
  const encounters = syncEncountersFromCombatants(data.encounters, combatants);
  const sessions = (data.sessions ?? []).map((s) =>
    s.id === sessionId
      ? {
          ...s,
          activeCombat: nextCombat,
          combatLog: appendCombatLog(s.combatLog, logLine),
        }
      : s,
  );
  return { ...data, sessions, encounters };
}
