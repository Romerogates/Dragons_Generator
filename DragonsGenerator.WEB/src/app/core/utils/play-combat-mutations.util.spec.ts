import { emptyCampaignData } from '@core/models/Campaign/campaign';
import { createActiveCombat, createCombatant } from './combat-tracker.util';
import {
  attackAt,
  attackMissLabel,
  attackTouchLabel,
  campaignDataAfterDmDamage,
  clampCurrentHpToMax,
  combatAfterAdvanceTurn,
  combatAfterDropTurn,
  combatAfterRemoveCombatant,
  combatAfterReorderTurn,
  combatantAfterDefeatedToggle,
  combatantAfterHpRaw,
  combatantAfterMaxHpRaw,
  combatClosingInitiativeCollection,
  combatOpeningInitiativeCollection,
  combatWithAppended,
  conditionsFromRaw,
  conditionsWithout,
  defeatedFromHp,
  defaultAllyCombatant,
  defaultEnemyCombatant,
  GENERIC_COMBAT_ATTACK,
  mapCombatant,
  nextConditionsToggle,
  parseOptionalHp,
  withAddedAttack,
  withPatchedAttack,
  withRemovedAttack,
} from './play-combat-mutations.util';

describe('play-combat-mutations.util', () => {
  const gob = () => createCombatant({ name: 'Gob', kind: 'monster', armorClass: 13 });
  const ally = () => createCombatant({ name: 'Aria', kind: 'player', armorClass: 16 });

  it('opens and closes initiative collection', () => {
    const combat = createActiveCombat([gob(), ally()], { label: 'Embuscade' });
    const opened = combatOpeningInitiativeCollection(combat);
    expect(opened.collectingInitiative).toBeTrue();
    expect(opened.initiativeCode?.length ?? 0).toBeGreaterThan(0);

    const withCode = { ...opened, initiativeCode: 'ABCD' };
    expect(combatOpeningInitiativeCollection(withCode).initiativeCode).toBe('ABCD');

    const closed = combatClosingInitiativeCollection(opened);
    expect(closed.collectingInitiative).toBeFalse();
    expect(closed.turnIndex).toBe(0);
    expect(closed.turnOrderIds?.length).toBe(2);
  });

  it('appends and removes combatants, clamping turn index', () => {
    const a = gob();
    const b = ally();
    const combat = { ...createActiveCombat([a, b]), turnIndex: 4, turnOrderIds: [a.id, b.id] };
    const extra = defaultAllyCombatant();
    const grown = combatWithAppended(combat, [extra]);
    expect(grown.combatants.length).toBe(3);
    expect(defaultEnemyCombatant().kind).toBe('monster');

    const shrunk = combatAfterRemoveCombatant(grown, a.id);
    expect(shrunk.combatants.map((c) => c.id)).not.toContain(a.id);
    expect(shrunk.turnOrderIds).not.toContain(a.id);
    expect(shrunk.turnIndex).toBe(1);
  });

  it('maps one combatant for attacks, conditions and HP', () => {
    const src = createCombatant({
      name: 'Ogre',
      kind: 'monster',
      currentHp: 20,
      maxHp: 20,
      attacks: [{ name: 'Massue', attackBonus: 4, damageDice: '2d8' }],
    });
    const combat = createActiveCombat([src, gob()]);

    const added = mapCombatant(combat, src.id, withAddedAttack);
    expect(added.combatants[0].attacks?.length).toBe(2);

    const patched = mapCombatant(added, src.id, (c) => withPatchedAttack(c, 0, { name: 'Frappe' }));
    expect(patched.combatants[0].attacks?.[0].name).toBe('Frappe');
    expect(withPatchedAttack({ ...src, attacks: undefined }, 0, { name: 'x' }).attacks).toBeUndefined();

    const removed = mapCombatant(patched, src.id, (c) => withRemovedAttack(c, 0));
    expect(removed.combatants[0].attacks?.length).toBe(1);
    const none = withRemovedAttack({ ...src, attacks: [{ name: 'A', attackBonus: 0, damageDice: '1d4' }] }, 0);
    expect(none.attacks).toBeUndefined();
    expect(withRemovedAttack({ ...src, attacks: undefined }, 0).attacks).toBeUndefined();
  });

  it('parses HP / defeat / conditions branches', () => {
    expect(parseOptionalHp('')).toBeUndefined();
    expect(parseOptionalHp(12)).toBe(12);
    expect(defeatedFromHp(undefined, true)).toBeTrue();
    expect(defeatedFromHp(0, false)).toBeTrue();
    expect(defeatedFromHp(5, true)).toBeFalse();
    expect(clampCurrentHpToMax(12, 8)).toBe(8);
    expect(clampCurrentHpToMax(3, 8)).toBe(3);
    expect(clampCurrentHpToMax(undefined, 8)).toBeUndefined();

    const ogre = createCombatant({ name: 'O', kind: 'monster', currentHp: 8, maxHp: 10, defeated: false });
    expect(combatantAfterHpRaw(ogre, '').defeated).toBeFalse();
    expect(combatantAfterHpRaw(ogre, 0).defeated).toBeTrue();
    expect(combatantAfterHpRaw(ogre, 4).defeated).toBeFalse();
    expect(combatantAfterMaxHpRaw(ogre, '').maxHp).toBeUndefined();
    expect(combatantAfterMaxHpRaw({ ...ogre, currentHp: 20 }, 6).currentHp).toBe(6);
    expect(combatantAfterDefeatedToggle(ogre, true).currentHp).toBe(0);
    expect(combatantAfterDefeatedToggle({ ...ogre, maxHp: undefined, currentHp: 3 }, false).currentHp).toBe(3);

    expect(conditionsFromRaw('  ')).toBeUndefined();
    expect(conditionsFromRaw(' , , ')).toBeUndefined();
    expect(conditionsFromRaw('à terre, empoisonné')).toEqual(['à terre', 'empoisonné']);
    expect(nextConditionsToggle(['à terre'], 'à terre')).toBeUndefined();
    expect(nextConditionsToggle(undefined, 'charmé')).toEqual(['charmé']);
    expect(conditionsWithout(undefined, 'x')).toBeUndefined();
    expect(conditionsWithout(['à terre', 'charmé'], 'charmé')).toEqual(['à terre']);
    expect(conditionsWithout(['charmé'], 'charmé')).toBeUndefined();
  });

  it('picks attack slot or generic fallback', () => {
    const withAtk = createCombatant({
      name: 'A',
      kind: 'player',
      attacks: [{ name: 'Arc', attackBonus: 5, damageDice: '1d8' }],
    });
    expect(attackAt(withAtk, 0).name).toBe('Arc');
    expect(attackAt(withAtk, 3)).toEqual(GENERIC_COMBAT_ATTACK);
    expect(attackAt(createCombatant({ name: 'B', kind: 'npc' }), 0)).toEqual(GENERIC_COMBAT_ATTACK);
  });

  it('labels miss / touch / fumble / no AC', () => {
    expect(attackMissLabel({ d20: 1, total: 1, targetAc: 15, hit: false, critical: false, fumble: true })).toBe(
      'Échec critique',
    );
    expect(attackMissLabel({ d20: 4, total: 6, targetAc: 15, hit: false, critical: false, fumble: false })).toBe(
      'Raté',
    );
    expect(attackMissLabel({ d20: 12, total: 14, targetAc: null, hit: null, critical: false, fumble: false })).toBe(
      'Jet 14 (pas de CA cible)',
    );
    expect(
      attackTouchLabel('Gob', {
        d20: 20,
        total: 22,
        targetAc: 13,
        hit: true,
        critical: true,
        fumble: false,
      }),
    ).toContain('Critique');
    expect(
      attackTouchLabel('Gob', {
        d20: 15,
        total: 17,
        targetAc: 13,
        hit: true,
        critical: false,
        fumble: false,
      }),
    ).toContain('touche Gob');
  });

  it('advances, reorders and drops turn order', () => {
    const a = createCombatant({ name: 'A', kind: 'player', initiativeRoll: 18 });
    const b = createCombatant({ name: 'B', kind: 'monster', initiativeRoll: 10 });
    const combat = {
      ...createActiveCombat([a, b], { flowPhase: 'fight' }),
      turnOrderIds: [a.id, b.id],
      turnIndex: 0,
    };

    const fwd = combatAfterAdvanceTurn(combat, 1);
    expect(fwd.combat.turnIndex).toBe(1);
    expect(fwd.nextName).toBe('B');
    expect(combatAfterAdvanceTurn(fwd.combat, -1).combat.turnIndex).toBe(0);

    const reordered = combatAfterReorderTurn(combat, a.id, 1);
    expect(reordered?.turnOrderIds).toEqual([b.id, a.id]);
    expect(combatAfterReorderTurn(combat, a.id, -1)).toBeNull();

    const dropped = combatAfterDropTurn(combat, a.id, 1);
    expect(dropped?.turnOrderIds).toEqual([b.id, a.id]);
    expect(combatAfterDropTurn(combat, 'missing', 0)).toBeNull();
  });

  it('writes HP, log and encounter sync in one campaign blob', () => {
    const gob = createCombatant({
      name: 'Gob',
      kind: 'monster',
      currentHp: 10,
      maxHp: 10,
      encounterLink: { encounterId: 'e1', creatureIndex: 0, unitIndex: 0 },
    });
    const hero = createCombatant({ name: 'Aria', kind: 'player', currentHp: 20, maxHp: 20 });
    const combat = createActiveCombat([hero, gob], { label: 'Embuscade' });
    const data = {
      ...emptyCampaignData(),
      encounters: [
        {
          id: 'e1',
          name: 'Gobelins',
          creatures: [
            {
              creatureId: 'g1',
              creatureName: 'Gob',
              challengeRating: '1/4',
              xp: 50,
              quantity: 1,
              defeated: 0,
            },
          ],
        },
      ],
      sessions: [
        {
          id: 's1',
          title: 'Soirée',
          scheduledAt: '2026-01-01T20:00:00Z',
          status: 'planned' as const,
          activeCombat: combat,
          combatLog: [],
        },
      ],
    };

    const next = campaignDataAfterDmDamage(data, 's1', combat, gob.id, 4, 'Aria → Gob : 4');
    const session = next.sessions.find((s) => s.id === 's1')!;
    const hit = session.activeCombat?.combatants.find((c) => c.id === gob.id);
    expect(hit?.currentHp).toBe(6);
    expect(session.combatLog?.some((l) => l.includes('4'))).toBeTrue();
    expect(next.encounters[0].creatures[0].defeated).toBe(0);
  });
});
