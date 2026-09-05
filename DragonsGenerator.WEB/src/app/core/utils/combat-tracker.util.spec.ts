import {
  canReorderCombatantInTurnOrder,
  createActiveCombat,
  createCombatantId,
  createCombatHistoryEntry,
  createCombatant,
  combatantInitiativeTotal,
  advanceTurn,
  currentTurnCombatant,
  duplicateCombatant,
  expandEncounterToCombatants,
  formatCombatArchiveSummary,
  isCombatantDefeated,
  sortCombatants,
  syncEncountersFromCombatants,
  activeTurnOrder,
  reorderCombatantInTurnOrder,
} from './combat-tracker.util';
import type { EncounterGroup } from '@core/models/Campaign/campaign';

describe('combat-tracker.util', () => {
  const sampleEncounter: EncounterGroup = {
    id: 'e1',
    name: 'Grotte',
    creatures: [
      {
        creatureId: 'gob',
        creatureName: 'Gobelin',
        challengeRating: '1/4',
        xp: 50,
        quantity: 3,
        defeated: 0,
      },
      {
        creatureId: 'boss',
        creatureName: 'Chef',
        customName: 'Klarg',
        challengeRating: '1',
        xp: 200,
        quantity: 1,
        defeated: 0,
      },
    ],
  };

  it('expandEncounterToCombatants creates one row per unit with encounterLink', () => {
    const rows = expandEncounterToCombatants(sampleEncounter);
    expect(rows.length).toBe(4);
    expect(rows[0].name).toBe('Gobelin 1');
    expect(rows[0].encounterLink).toEqual({ encounterId: 'e1', creatureIndex: 0, unitIndex: 0 });
    expect(rows[2].encounterLink?.unitIndex).toBe(2);
    expect(rows[3].name).toBe('Klarg');
    expect(rows.every((r) => r.kind === 'monster')).toBe(true);
  });

  it('expandEncounterToCombatants pre-marks units already defeated on encounter', () => {
    const enc: EncounterGroup = {
      ...sampleEncounter,
      creatures: [{ ...sampleEncounter.creatures[0], defeated: 2 }],
    };
    const rows = expandEncounterToCombatants(enc);
    expect(isCombatantDefeated(rows[0])).toBe(true);
    expect(isCombatantDefeated(rows[1])).toBe(true);
    expect(isCombatantDefeated(rows[2])).toBe(false);
  });

  it('syncEncountersFromCombatants updates defeated counts from combat rows', () => {
    const rows = expandEncounterToCombatants(sampleEncounter);
    rows[0].defeated = true;
    rows[0].currentHp = 0;
    rows[2].defeated = true;

    const synced = syncEncountersFromCombatants([sampleEncounter], rows);
    expect(synced[0].creatures[0].defeated).toBe(2);
    expect(synced[0].creatures[1].defeated).toBe(0);
  });

  it('activeTurnOrder excludes defeated combatants', () => {
    const a = createCombatant({ name: 'A', kind: 'player', initiativeRoll: 20, initiativeBonus: 0 });
    const b = createCombatant({ name: 'B', kind: 'monster', initiativeRoll: 15, initiativeBonus: 0, defeated: true, currentHp: 0 });
    const combat = createActiveCombat([a, b]);
    expect(activeTurnOrder(combat).map((c) => c.name)).toEqual(['A']);
  });

  it('advanceTurn skips defeated and wraps rounds', () => {
    const a = createCombatant({ name: 'A', kind: 'player', initiativeRoll: 20, initiativeBonus: 0 });
    const b = createCombatant({ name: 'B', kind: 'player', initiativeRoll: 10, initiativeBonus: 0 });
    let combat = createActiveCombat([a, b]);
    expect(advanceTurn(combat, 1)).toEqual({ turnIndex: 1, round: 1 });
    combat = { ...combat, turnIndex: 1 };
    expect(advanceTurn(combat, 1)).toEqual({ turnIndex: 0, round: 2 });
  });

  it('duplicateCombatant increments numbered names', () => {
    const src = createCombatant({ name: 'Gobelin 2', kind: 'monster', initiativeBonus: 1, maxHp: 7 });
    const copy = duplicateCombatant(src);
    expect(copy.name).toBe('Gobelin 3');
    expect(copy.encounterLink).toBeUndefined();
    expect(copy.initiativeBonus).toBe(1);
  });

  it('formatCombatArchiveSummary lists combatants', () => {
    const a = createCombatant({ name: 'Théo', kind: 'player', currentHp: 12, maxHp: 20 });
    const b = createCombatant({ name: 'Gobelin', kind: 'monster', defeated: true, currentHp: 0 });
    const combat = createActiveCombat([a, b], { label: 'Grotte' });
    const text = formatCombatArchiveSummary(combat);
    expect(text).toContain('Fin combat : Grotte');
    expect(text).toContain('Théo : vivant (12/20 PV)');
    expect(text).toContain('Gobelin : mort');
  });

  it('sortCombatants orders by total initiative descending', () => {
    const a = createCombatant({ name: 'A', kind: 'player', initiativeBonus: 2, initiativeRoll: 10 });
    const b = createCombatant({ name: 'B', kind: 'monster', initiativeBonus: 0, initiativeRoll: 18 });
    const c = createCombatant({ name: 'C', kind: 'npc', initiativeBonus: 3 });
    const sorted = sortCombatants([a, b, c]);
    expect(sorted.map((x) => x.name)).toEqual(['B', 'A', 'C']);
    expect(combatantInitiativeTotal(a)).toBe(12);
  });

  it('reorderCombatantInTurnOrder swaps tied initiative totals', () => {
    const a = createCombatant({ name: 'A', kind: 'player', initiativeRoll: 15, initiativeBonus: 0 });
    const b = createCombatant({ name: 'B', kind: 'player', initiativeRoll: 15, initiativeBonus: 0 });
    const c = createCombatant({ name: 'C', kind: 'monster', initiativeRoll: 10, initiativeBonus: 0 });
    let combat = createActiveCombat([a, b, c]);
    expect(sortCombatants(combat.combatants).map((x) => x.name)).toEqual(['A', 'B', 'C']);

    const patch = reorderCombatantInTurnOrder(combat, b.id, -1);
    expect(patch.turnOrderIds).toEqual([b.id, a.id, c.id]);
    combat = { ...combat, ...patch };
    expect(sortCombatants(combat.combatants, combat.turnOrderIds).map((x) => x.name)).toEqual(['B', 'A', 'C']);
  });

  it('createCombatHistoryEntry captures combat snapshot', () => {
    const a = createCombatant({ name: 'Théo', kind: 'player', initiativeRoll: 18, initiativeBonus: 2 });
    const combat = createActiveCombat([a], { label: 'Grotte' });
    const entry = createCombatHistoryEntry(combat);
    expect(entry.label).toBe('Grotte');
    expect(entry.round).toBe(1);
    expect(entry.summary).toContain('Fin combat : Grotte');
    expect(entry.summary).toContain('Théo');
  });

  it('createActiveCombat starts at round 1 turn 0', () => {
    const combat = createActiveCombat([], { label: 'Test' });
    expect(combat.round).toBe(1);
    expect(combat.turnIndex).toBe(0);
    expect(combat.combatants).toEqual([]);
  });

  it('createCombatantId falls back when crypto.randomUUID is unavailable', () => {
    const orig = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
    expect(createCombatantId()).toMatch(/^cb-/);
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: orig });
  });

  it('sortCombatants orders nameless rolls via turnOrderIds', () => {
    const bravo = createCombatant({ name: 'Bravo', kind: 'player' });
    const alpha = createCombatant({ name: 'Alpha', kind: 'player' });
    const sorted = sortCombatants([bravo, alpha], [alpha.id, bravo.id]);
    expect(sorted.map((c) => c.name)).toEqual(['Alpha', 'Bravo']);
  });

  it('reorderCombatantInTurnOrder rejects invalid or mismatched swaps', () => {
    const high = createCombatant({ name: 'High', kind: 'player', initiativeRoll: 18, initiativeBonus: 0 });
    const low = createCombatant({ name: 'Low', kind: 'player', initiativeRoll: 8, initiativeBonus: 0 });
    const combat = createActiveCombat([high, low]);
    expect(reorderCombatantInTurnOrder(combat, 'missing', 1)).toEqual({});
    expect(reorderCombatantInTurnOrder(combat, high.id, 1)).toEqual({});
    expect(canReorderCombatantInTurnOrder(combat, high.id, 1)).toBeFalse();
  });

  it('advanceTurn moves backward and never drops below round 1', () => {
    const solo = createCombatant({ name: 'Solo', kind: 'player', initiativeRoll: 12, initiativeBonus: 0 });
    let combat = createActiveCombat([solo]);
    expect(advanceTurn(combat, -1)).toEqual({ turnIndex: 0, round: 1 });
    combat = { ...combat, turnIndex: 0, round: 2 };
    expect(advanceTurn(combat, -1)).toEqual({ turnIndex: 0, round: 1 });
    expect(advanceTurn(createActiveCombat([]), 1)).toEqual({ turnIndex: 0, round: 1 });
  });

  it('currentTurnCombatant returns null when no active combatants remain', () => {
    const dead = createCombatant({ name: 'Dead', kind: 'monster', defeated: true, currentHp: 0 });
    expect(currentTurnCombatant(createActiveCombat([dead]))).toBeNull();
  });

  it('duplicateCombatant handles numbered names, copies and blank labels', () => {
    expect(duplicateCombatant(createCombatant({ name: 'Gobelin 2', kind: 'monster' })).name).toBe('Gobelin 3');
    expect(duplicateCombatant(createCombatant({ name: 'Bob (copie)', kind: 'player' })).name).toBe('Bob (copie)');
    expect(duplicateCombatant(createCombatant({ name: '  ', kind: 'player' })).name).toBe('Copie');
  });

  it('formatCombatArchiveSummary covers default labels and partial hp lines', () => {
    const unnamed = createCombatant({ name: '  ', kind: 'player', currentHp: 5 });
    const text = formatCombatArchiveSummary(createActiveCombat([unnamed], { label: '  ' }));
    expect(text).toContain('Fin combat : Combat');
    expect(text).toContain('Sans nom : vivant (5 PV)');
    expect(text).toContain('1 manche');
  });
});
