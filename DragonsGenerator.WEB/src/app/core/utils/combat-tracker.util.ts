import {
  ActiveCombat,
  Combatant,
  CombatHistoryEntry,
  EncounterGroup,
} from '@core/models/Campaign/campaign';

export function createCombatantId(): string {
  return crypto.randomUUID?.() ?? `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createInitiativeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function createCombatant(
  partial: Partial<Combatant> & Pick<Combatant, 'name' | 'kind'>,
): Combatant {
  return {
    id: createCombatantId(),
    initiativeBonus: 0,
    ...partial,
  };
}

export function createActiveCombat(
  combatants: Combatant[],
  options?: { label?: string; encounterId?: string },
): ActiveCombat {
  return {
    id: createCombatantId(),
    label: options?.label,
    encounterId: options?.encounterId,
    round: 1,
    turnIndex: 0,
    combatants,
  };
}

export function combatantInitiativeTotal(c: Combatant): number | null {
  if (c.initiativeRoll === undefined || c.initiativeRoll === null || Number.isNaN(c.initiativeRoll)) {
    return null;
  }
  return c.initiativeRoll + c.initiativeBonus;
}

export function isCombatantDefeated(c: Combatant): boolean {
  if (c.defeated) return true;
  return c.currentHp !== undefined && c.currentHp <= 0;
}

function turnOrderIndex(id: string, turnOrderIds?: string[]): number {
  if (!turnOrderIds?.length) return 9999;
  const idx = turnOrderIds.indexOf(id);
  return idx < 0 ? 9999 : idx;
}

/** Tri décroissant par total d'initiative ; sans jet en bas ; égalités via turnOrderIds. */
export function sortCombatants(combatants: Combatant[], turnOrderIds?: string[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    const ta = combatantInitiativeTotal(a);
    const tb = combatantInitiativeTotal(b);
    if (ta === null && tb === null) {
      const oa = turnOrderIndex(a.id, turnOrderIds);
      const ob = turnOrderIndex(b.id, turnOrderIds);
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name, 'fr');
    }
    if (ta === null) return 1;
    if (tb === null) return -1;
    if (tb !== ta) return tb - ta;
    const oa = turnOrderIndex(a.id, turnOrderIds);
    const ob = turnOrderIndex(b.id, turnOrderIds);
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, 'fr');
  });
}

/** Déplace un combattant dans l'ordre de tour (égalité d'initiative uniquement). */
export function reorderCombatantInTurnOrder(
  combat: ActiveCombat,
  combatantId: string,
  direction: -1 | 1,
): Partial<Pick<ActiveCombat, 'turnOrderIds'>> {
  const order = sortedTurnOrder(combat);
  const idx = order.findIndex((c) => c.id === combatantId);
  if (idx < 0) return {};

  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= order.length) return {};

  const a = order[idx];
  const b = order[swapIdx];
  const ta = combatantInitiativeTotal(a);
  const tb = combatantInitiativeTotal(b);
  if (ta === null || tb === null || ta !== tb) return {};

  const ids = order.map((c) => c.id);
  ids[idx] = b.id;
  ids[swapIdx] = a.id;
  return { turnOrderIds: ids };
}

export function canReorderCombatantInTurnOrder(
  combat: ActiveCombat,
  combatantId: string,
  direction: -1 | 1,
): boolean {
  return reorderCombatantInTurnOrder(combat, combatantId, direction).turnOrderIds !== undefined;
}

/** Une ligne par unité (Gobelin ×3 → Gobelin 1, 2, 3), liée à la rencontre. */
export function expandEncounterToCombatants(encounter: EncounterGroup): Combatant[] {
  const out: Combatant[] = [];
  encounter.creatures.forEach((cr, creatureIndex) => {
    for (let unitIndex = 0; unitIndex < cr.quantity; unitIndex++) {
      const base = cr.customName || cr.creatureName;
      const name = cr.quantity > 1 ? `${base} ${unitIndex + 1}` : base;
      out.push(
        createCombatant({
          name,
          kind: 'monster',
          initiativeBonus: 0,
          encounterLink: {
            encounterId: encounter.id,
            creatureIndex,
            unitIndex,
          },
          defeated: unitIndex < cr.defeated,
          currentHp: unitIndex < cr.defeated ? 0 : undefined,
        }),
      );
    }
  });
  return out;
}

/** Recalcule defeated par créature depuis les combattants liés. */
export function syncEncountersFromCombatants(
  encounters: EncounterGroup[],
  combatants: Combatant[],
): EncounterGroup[] {
  return encounters.map((enc) => ({
    ...enc,
    creatures: enc.creatures.map((cr, creatureIndex) => {
      const defeated = combatants.filter(
        (c) =>
          c.encounterLink?.encounterId === enc.id &&
          c.encounterLink.creatureIndex === creatureIndex &&
          isCombatantDefeated(c),
      ).length;
      return { ...cr, defeated: Math.min(defeated, cr.quantity) };
    }),
  }));
}

export function sortedTurnOrder(combat: ActiveCombat): Combatant[] {
  return sortCombatants(combat.combatants, combat.turnOrderIds);
}

/** Ordre de combat sans les unités mortes (suiv./préc.). */
export function activeTurnOrder(combat: ActiveCombat): Combatant[] {
  return sortedTurnOrder(combat).filter((c) => !isCombatantDefeated(c));
}

export function currentTurnCombatant(combat: ActiveCombat): Combatant | null {
  const order = activeTurnOrder(combat);
  if (!order.length) return null;
  const idx = Math.min(combat.turnIndex, order.length - 1);
  return order[idx] ?? null;
}

export function advanceTurn(
  combat: ActiveCombat,
  direction: 1 | -1,
): Pick<ActiveCombat, 'turnIndex' | 'round'> {
  const order = activeTurnOrder(combat);
  if (!order.length) return { turnIndex: 0, round: combat.round };

  const len = order.length;
  let turnIndex = combat.turnIndex + direction;
  let round = combat.round;

  if (direction === 1) {
    if (turnIndex >= len) {
      turnIndex = 0;
      round += 1;
    }
  } else if (turnIndex < 0) {
    turnIndex = len - 1;
    round = Math.max(1, round - 1);
  }

  return { turnIndex, round };
}

/** Copie manuelle (sans lien rencontre — évite double comptage kills). */
export function duplicateCombatant(source: Combatant): Combatant {
  return createCombatant({
    name: nextDuplicateName(source.name),
    kind: source.kind,
    initiativeBonus: source.initiativeBonus,
    maxHp: source.maxHp,
    currentHp: source.maxHp,
  });
}

function nextDuplicateName(name: string): string {
  const trimmed = name.trim();
  const numbered = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (numbered) {
    return `${numbered[1]} ${parseInt(numbered[2], 10) + 1}`;
  }
  if (trimmed.endsWith(' (copie)')) return trimmed;
  return trimmed ? `${trimmed} (copie)` : 'Copie';
}

export function formatCombatArchiveSummary(combat: ActiveCombat): string {
  const label = combat.label?.trim() || 'Combat';
  const lines = [`--- Fin combat : ${label} (${combat.round} manche${combat.round > 1 ? 's' : ''}) ---`];

  for (const cb of sortedTurnOrder(combat)) {
    const name = cb.name?.trim() || 'Sans nom';
    const status = isCombatantDefeated(cb) ? 'mort' : 'vivant';
    let hp = '';
    if (cb.currentHp !== undefined && cb.maxHp !== undefined) {
      hp = ` (${cb.currentHp}/${cb.maxHp} PV)`;
    } else if (cb.currentHp !== undefined) {
      hp = ` (${cb.currentHp} PV)`;
    }
    lines.push(`· ${name} : ${status}${hp}`);
  }

  return lines.join('\n');
}

export function createCombatHistoryEntry(combat: ActiveCombat): CombatHistoryEntry {
  return {
    id: combat.id,
    endedAt: new Date().toISOString(),
    label: combat.label,
    encounterId: combat.encounterId,
    round: combat.round,
    summary: formatCombatArchiveSummary(combat),
  };
}

export const COMBATANT_KIND_LABELS: Record<Combatant['kind'], string> = {
  player: 'PJ',
  monster: 'Monstre',
  npc: 'PNJ',
};
