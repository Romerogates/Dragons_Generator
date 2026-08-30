import {
  createActiveCombat,
  createCombatant,
  combatantInitiativeTotal,
  expandEncounterToCombatants,
  isCombatantDefeated,
  sortCombatants,
  syncEncountersFromCombatants,
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

  it('sortCombatants orders by total initiative descending', () => {
    const a = createCombatant({ name: 'A', kind: 'player', initiativeBonus: 2, initiativeRoll: 10 });
    const b = createCombatant({ name: 'B', kind: 'monster', initiativeBonus: 0, initiativeRoll: 18 });
    const c = createCombatant({ name: 'C', kind: 'npc', initiativeBonus: 3 });
    const sorted = sortCombatants([a, b, c]);
    expect(sorted.map((x) => x.name)).toEqual(['B', 'A', 'C']);
    expect(combatantInitiativeTotal(a)).toBe(12);
  });

  it('createActiveCombat starts at round 1 turn 0', () => {
    const combat = createActiveCombat([], { label: 'Test' });
    expect(combat.round).toBe(1);
    expect(combat.turnIndex).toBe(0);
    expect(combat.combatants).toEqual([]);
  });
});
