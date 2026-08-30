import {
  createActiveCombat,
  createCombatant,
  combatantInitiativeTotal,
  expandEncounterToCombatants,
  sortCombatants,
} from './combat-tracker.util';
import type { EncounterGroup } from '@core/models/Campaign/campaign';

describe('combat-tracker.util', () => {
  it('expandEncounterToCombatants creates one row per unit', () => {
    const enc: EncounterGroup = {
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

    const rows = expandEncounterToCombatants(enc);
    expect(rows.length).toBe(4);
    expect(rows[0].name).toBe('Gobelin 1');
    expect(rows[1].name).toBe('Gobelin 2');
    expect(rows[2].name).toBe('Gobelin 3');
    expect(rows[3].name).toBe('Klarg');
    expect(rows.every((r) => r.kind === 'monster')).toBe(true);
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
