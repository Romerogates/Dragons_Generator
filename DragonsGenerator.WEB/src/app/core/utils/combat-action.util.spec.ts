import type { Attack } from '@core/models/Character/character';
import type { Combatant } from '@core/models/Campaign/campaign';
import {
  appendCombatLog,
  applyHpDelta,
  formatCombatLogLine,
  isAllyCombatant,
  isEnemyCombatant,
  snapshotAttacksFromCharacter,
} from './combat-action.util';
import {
  canAdvanceFromSetup,
  canOpenFightPhase,
  advanceTurn,
  canReorderCombatantInTurnOrder,
  combatantInitiativeTotal,
  createActiveCombat,
  createCombatant,
  createInitiativeCode,
  currentTurnCombatant,
  duplicateCombatant,
  expandEncounterToCombatants,
  formatCombatArchiveSummary,
  isCombatantDefeated,
  reorderCombatantInTurnOrder,
  resolveCombatFlowPhase,
  sortCombatants,
  syncEncountersFromCombatants,
} from './combat-tracker.util';

function combatant(partial: Partial<Combatant> & Pick<Combatant, 'id' | 'name' | 'kind'>): Combatant {
  return {
    armorClass: 10,
    initiativeBonus: 0,
    ...partial,
  } as Combatant;
}

function attack(partial: Partial<Attack> & Pick<Attack, 'name'>): Attack {
  return {
    source: 'weapon',
    attackBonus: 0,
    damage: '',
    damageType: 'contondant',
    range: 'Corps à corps',
    ...partial,
  };
}

describe('combat-action.util', () => {
  describe('snapshotAttacksFromCharacter', () => {
    it('returns empty for null/undefined/empty', () => {
      expect(snapshotAttacksFromCharacter(null)).toEqual([]);
      expect(snapshotAttacksFromCharacter(undefined)).toEqual([]);
      expect(snapshotAttacksFromCharacter([])).toEqual([]);
    });

    it('parses damage expressions and caps at 6', () => {
      const attacks: Attack[] = [
        attack({ name: 'Épée', attackBonus: 5, damage: '1d8+3', damageType: 'tranchant' }),
        attack({ name: 'Masse', damage: '2d6' }),
        attack({ name: 'Vide', damage: '  ' }),
        attack({ name: 'Custom', damage: 'custom' }),
        attack({ name: 'Malus', damage: '1d4-1' }),
        attack({ name: 'B', damage: '1d4' }),
        attack({ name: 'C', damage: '1d4' }),
      ];
      const snap = snapshotAttacksFromCharacter(attacks);
      expect(snap.length).toBe(6);
      expect(snap[0]).toEqual(
        jasmine.objectContaining({
          name: 'Épée',
          attackBonus: 5,
          damageDice: '1d8+3',
          damageBonus: 3,
          damageType: 'tranchant',
        }),
      );
      const noBonusField = {
        name: 'Sans bonus',
        source: 'weapon',
        damage: '1d6',
        damageType: 'contondant',
        range: 'Corps à corps',
      } as Attack;
      const snapNoBonus = snapshotAttacksFromCharacter([noBonusField]);
      expect(snapNoBonus[0]!.attackBonus).toBe(0);

      expect(snap[1]).toEqual(
        jasmine.objectContaining({ damageDice: '2d6', damageBonus: 0, attackBonus: 0 }),
      );
      expect(snap[2]!.damageDice).toBeUndefined();
      expect(snap[3]!.damageDice).toBe('custom');
      expect(snap[4]).toEqual(
        jasmine.objectContaining({ damageDice: '1d4-1', damageBonus: -1 }),
      );
    });
  });

  describe('ally/enemy', () => {
    it('classifies kinds', () => {
      expect(isAllyCombatant(combatant({ id: '1', name: 'H', kind: 'player' }))).toBeTrue();
      expect(isAllyCombatant(combatant({ id: '2', name: 'N', kind: 'npc' }))).toBeTrue();
      expect(isEnemyCombatant(combatant({ id: '3', name: 'G', kind: 'monster' }))).toBeTrue();
      expect(isEnemyCombatant(combatant({ id: '2', name: 'N', kind: 'npc' }))).toBeFalse();
      expect(isAllyCombatant(combatant({ id: '3', name: 'G', kind: 'monster' }))).toBeFalse();
    });
  });

  describe('formatCombatLogLine', () => {
    it('formats hit, miss, and pending jet', () => {
      expect(
        formatCombatLogLine({
          actor: 'A',
          target: 'B',
          attackName: 'Épée',
          d20: 12,
          total: 15,
          ac: null,
          hit: null,
        }),
      ).toContain('jet');
      expect(
        formatCombatLogLine({
          actor: 'A',
          target: 'B',
          attackName: 'Épée',
          d20: 5,
          total: 8,
          ac: 15,
          hit: false,
        }),
      ).toMatch(/vs CA 15.*raté/);
      expect(
        formatCombatLogLine({
          actor: 'A',
          target: 'B',
          attackName: 'Épée',
          d20: 18,
          total: 21,
          ac: 15,
          hit: true,
          damage: 7,
        }),
      ).toMatch(/touché → 7 dégâts/);
      expect(
        formatCombatLogLine({
          actor: 'A',
          target: 'B',
          attackName: 'Épée',
          d20: 18,
          total: 21,
          ac: 15,
          hit: true,
          damage: null,
        }),
      ).not.toContain('dégâts');
    });
  });

  describe('combat-tracker integration', () => {
    it('defaults NPC/monster AC and resolves flow phases', () => {
      const npc = createCombatant({ name: 'Garde', kind: 'npc' });
      const monster = createCombatant({ name: 'Gobelin', kind: 'monster' });
      expect(npc.armorClass).toBe(10);
      expect(monster.armorClass).toBe(10);
      expect(createCombatant({ name: 'Hero', kind: 'player' }).armorClass).toBeUndefined();

      const setupOnly = createActiveCombat([npc], { label: 'test' });
      expect(resolveCombatFlowPhase(setupOnly)).toBe('setup');
      expect(canAdvanceFromSetup(setupOnly)).toBeFalse();

      const ready = createActiveCombat(
        [
          { ...npc, initiativeRoll: 12, initiativeBonus: 2 },
          { ...monster, initiativeRoll: 8, initiativeBonus: 1 },
        ],
        { label: 'fight' },
      );
      ready.flowPhase = 'initiative';
      expect(resolveCombatFlowPhase(ready)).toBe('initiative');
      ready.flowPhase = 'fight';
      expect(resolveCombatFlowPhase(ready)).toBe('fight');
      expect(canOpenFightPhase(ready)).toBeTrue();

      const noInit = createActiveCombat([npc, monster]);
      delete (noInit as { flowPhase?: string }).flowPhase;
      expect(resolveCombatFlowPhase(noInit)).toBe('initiative');

      expect(isCombatantDefeated({ ...npc, defeated: true })).toBeTrue();
      expect(isCombatantDefeated({ ...npc, currentHp: 0 })).toBeTrue();
      expect(combatantInitiativeTotal({ ...npc, initiativeRoll: NaN })).toBeNull();

      const sorted = sortCombatants(
        [
          createCombatant({ name: 'Z', kind: 'player', initiativeRoll: 10 }),
          createCombatant({ name: 'A', kind: 'player', initiativeRoll: 10 }),
          createCombatant({ name: 'Late', kind: 'player' }),
        ],
        undefined,
      );
      expect(sorted[0]!.name).toBe('A');
      expect(sorted.at(-1)!.name).toBe('Late');

      const expanded = expandEncounterToCombatants({
        id: 'enc-1',
        creatures: [{ creatureName: 'Gobelin', quantity: 2, defeated: 1, customName: '' }],
      } as never);
      expect(expanded.length).toBe(2);
      expect(expanded[0]!.name).toBe('Gobelin 1');
      expect(expanded[0]!.defeated).toBeTrue();
      expect(expanded[1]!.defeated).toBeFalse();

      const synced = syncEncountersFromCombatants(
        [{ id: 'enc-1', creatures: [{ creatureName: 'Gob', quantity: 2, defeated: 0 }] } as never],
        expanded,
      );
      expect(synced[0]!.creatures[0]!.defeated).toBe(1);

      const tied = createActiveCombat([
        createCombatant({ name: 'A', kind: 'player', initiativeRoll: 12 }),
        createCombatant({ name: 'B', kind: 'player', initiativeRoll: 12 }),
      ]);
      const reordered = reorderCombatantInTurnOrder(tied, tied.combatants[1]!.id, -1);
      expect(reordered.turnOrderIds?.length).toBe(2);
      expect(canReorderCombatantInTurnOrder(tied, tied.combatants[0]!.id, 1)).toBeTrue();
      expect(createInitiativeCode()).toMatch(/^[A-Z0-9]{4}$/);

      const monstersOnly = createActiveCombat([monster]);
      delete (monstersOnly as { flowPhase?: string }).flowPhase;
      expect(resolveCombatFlowPhase(monstersOnly)).toBe('setup');

      const fight = createActiveCombat([
        createCombatant({ name: 'P', kind: 'player', initiativeRoll: 15, currentHp: 8, maxHp: 10 }),
        createCombatant({ name: 'M', kind: 'monster', initiativeRoll: 10, currentHp: 0, maxHp: 10, defeated: true }),
      ]);
      fight.flowPhase = 'fight';
      fight.round = 2;
      expect(currentTurnCombatant(fight)?.name).toBe('P');
      expect(advanceTurn(fight, 1)).toEqual({ turnIndex: 0, round: 3 });

      const dup = duplicateCombatant({
        ...npc,
        attacks: [{ name: 'Coup', attackBonus: 2, damageDice: '1d6', damageType: 'contondant' }],
      });
      expect(dup.name).toContain('(copie)');
      expect(dup.attacks?.length).toBe(1);

      const archive = formatCombatArchiveSummary(fight);
      expect(archive).toContain('2 manches');
      expect(archive).toContain('8/10 PV');
      expect(reorderCombatantInTurnOrder(tied, tied.combatants[0]!.id, -1)).toEqual({});
    });
  });

  describe('appendCombatLog / applyHpDelta', () => {
    it('appends and trims log', () => {
      expect(appendCombatLog(undefined, 'a')).toEqual(['a']);
      const many = Array.from({ length: 45 }, (_, i) => `l${i}`);
      expect(appendCombatLog(many, 'last', 40).length).toBe(40);
      expect(appendCombatLog(many, 'last', 40).at(-1)).toBe('last');
    });

    it('applies HP with caps and defeat flags', () => {
      const bare = applyHpDelta(combatant({ id: '1', name: 'X', kind: 'npc' }), -5);
      expect(bare.currentHp).toBe(0);

      const healed = applyHpDelta(
        combatant({ id: '2', name: 'Y', kind: 'player', currentHp: 5, maxHp: 10 }),
        10,
      );
      expect(healed.currentHp).toBe(10);

      const revived = applyHpDelta(
        combatant({
          id: '3',
          name: 'Z',
          kind: 'player',
          currentHp: 0,
          maxHp: 10,
          defeated: true,
        }),
        5,
      );
      expect(revived.currentHp).toBe(5);
      expect(revived.defeated).toBeFalse();

      const slain = applyHpDelta(
        combatant({ id: '4', name: 'W', kind: 'monster', currentHp: 3, maxHp: 10 }),
        -10,
      );
      expect(slain.currentHp).toBe(0);
      expect(slain.defeated).toBeTrue();

      const initFromMax = applyHpDelta(
        combatant({ id: '5', name: 'M', kind: 'npc', currentHp: undefined, maxHp: 8, defeated: false }),
        -3,
      );
      expect(initFromMax.currentHp).toBe(5);
      expect(initFromMax.defeated).toBeFalse();

      const positiveBare = applyHpDelta(combatant({ id: '6', name: 'N', kind: 'npc' }), 8);
      expect(positiveBare.currentHp).toBe(8);

      const currentOnly = applyHpDelta(
        combatant({ id: '7', name: 'C', kind: 'npc', currentHp: 6, maxHp: undefined, defeated: false }),
        -2,
      );
      expect(currentOnly.currentHp).toBe(4);
      expect(currentOnly.defeated).toBeFalse();

      const unchanged = applyHpDelta(
        combatant({ id: '8', name: 'H', kind: 'player', currentHp: 8, maxHp: 10, defeated: false }),
        1,
      );
      expect(unchanged.defeated).toBeFalse();
    });
  });
});
