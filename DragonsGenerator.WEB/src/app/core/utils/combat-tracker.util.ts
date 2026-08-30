import {
  ActiveCombat,
  Combatant,
  EncounterGroup,
} from '@core/models/Campaign/campaign';

export function createCombatantId(): string {
  return crypto.randomUUID?.() ?? `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

/** Tri décroissant par total d'initiative ; sans jet en bas. */
export function sortCombatants(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    const ta = combatantInitiativeTotal(a);
    const tb = combatantInitiativeTotal(b);
    if (ta === null && tb === null) return a.name.localeCompare(b.name, 'fr');
    if (ta === null) return 1;
    if (tb === null) return -1;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name, 'fr');
  });
}

/** Une ligne par unité (Gobelin ×3 → Gobelin 1, 2, 3). */
export function expandEncounterToCombatants(encounter: EncounterGroup): Combatant[] {
  const out: Combatant[] = [];
  for (const cr of encounter.creatures) {
    for (let i = 0; i < cr.quantity; i++) {
      const base = cr.customName || cr.creatureName;
      const name = cr.quantity > 1 ? `${base} ${i + 1}` : base;
      out.push(createCombatant({ name, kind: 'monster', initiativeBonus: 0 }));
    }
  }
  return out;
}

export function sortedTurnOrder(combat: ActiveCombat): Combatant[] {
  return sortCombatants(combat.combatants);
}

export function currentTurnCombatant(combat: ActiveCombat): Combatant | null {
  const order = sortedTurnOrder(combat);
  if (!order.length) return null;
  const idx = Math.min(combat.turnIndex, order.length - 1);
  return order[idx] ?? null;
}

export const COMBATANT_KIND_LABELS: Record<Combatant['kind'], string> = {
  player: 'PJ',
  monster: 'Monstre',
  npc: 'PNJ',
};
