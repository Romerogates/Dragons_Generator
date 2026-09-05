import {
  parseDamageDice,
  resolveAttackRoll,
  resolveRollPolicy,
  rollDie,
  rollDamageTotal,
} from './combat-roll.util';
import {
  appendCombatLog,
  applyHpDelta,
  formatCombatLogLine,
  isAllyCombatant,
  isEnemyCombatant,
  snapshotAttacksFromCharacter,
} from './combat-action.util';
import type { Attack } from '@core/models/Character/character';
import type { Combatant } from '@core/models/Campaign/campaign';

describe('combat-roll.util', () => {
  it('resolveRollPolicy respects session mode and other choice', () => {
    expect(resolveRollPolicy('online')).toBe('dice');
    expect(resolveRollPolicy('in_person')).toBe('encode');
    expect(resolveRollPolicy('other', 'dice')).toBe('dice');
    expect(resolveRollPolicy('other', 'encode')).toBe('encode');
    expect(resolveRollPolicy('other')).toBe('encode');
    expect(resolveRollPolicy(undefined)).toBe('dice');
  });

  it('rollDie stays within bounds', () => {
    for (let i = 0; i < 40; i++) {
      const r = rollDie(20);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
    }
  });

  it('parseDamageDice and rollDamageTotal', () => {
    expect(parseDamageDice('1d8+3')).toEqual({ count: 1, faces: 8, bonus: 3 });
    expect(parseDamageDice('2d6')).toEqual({ count: 2, faces: 6, bonus: 0 });
    const total = rollDamageTotal('1d4+1');
    expect(total).toBeGreaterThanOrEqual(2);
    expect(total).toBeLessThanOrEqual(5);
  });

  it('resolveAttackRoll hits on total >= AC and crit/fumble', () => {
    expect(resolveAttackRoll(15, 5, 18).hit).toBeTrue();
    expect(resolveAttackRoll(10, 5, 18).hit).toBeFalse();
    expect(resolveAttackRoll(20, 0, 99).hit).toBeTrue();
    expect(resolveAttackRoll(20, 0, 99).critical).toBeTrue();
    expect(resolveAttackRoll(1, 50, 5).hit).toBeFalse();
    expect(resolveAttackRoll(1, 50, 5).fumble).toBeTrue();
  });
});

describe('combat-action.util', () => {
  it('classifies allies and enemies', () => {
    const player = { kind: 'player' } as Combatant;
    const npc = { kind: 'npc' } as Combatant;
    const monster = { kind: 'monster' } as Combatant;
    expect(isAllyCombatant(player)).toBeTrue();
    expect(isAllyCombatant(npc)).toBeTrue();
    expect(isEnemyCombatant(monster)).toBeTrue();
    expect(isEnemyCombatant(player)).toBeFalse();
  });

  it('snapshots character attacks', () => {
    const attacks = [
      {
        name: 'Épée',
        source: 'weapon',
        attackBonus: 5,
        damage: '1d8+3',
        damageType: 'tranchant',
        range: 'CàC',
      },
    ] as Attack[];
    expect(snapshotAttacksFromCharacter(attacks)[0]).toEqual(
      jasmine.objectContaining({
        name: 'Épée',
        attackBonus: 5,
        damageDice: '1d8+3',
      }),
    );
  });

  it('applyHpDelta clamps and marks defeated', () => {
    const c: Combatant = {
      id: '1',
      name: 'A',
      kind: 'monster',
      initiativeBonus: 0,
      currentHp: 10,
      maxHp: 10,
    };
    expect(applyHpDelta(c, -4).currentHp).toBe(6);
    expect(applyHpDelta(c, -20).defeated).toBeTrue();
    expect(applyHpDelta(applyHpDelta(c, -20), 5).defeated).toBeFalse();
  });

  it('appendCombatLog trims', () => {
    const log = appendCombatLog(['a', 'b'], 'c', 2);
    expect(log).toEqual(['b', 'c']);
  });

  it('formatCombatLogLine', () => {
    const line = formatCombatLogLine({
      actor: 'Mira',
      target: 'Gobelin',
      attackName: 'Dague',
      d20: 12,
      total: 16,
      ac: 13,
      hit: true,
      damage: 5,
    });
    expect(line).toContain('Mira');
    expect(line).toContain('touché');
    expect(line).toContain('5 dégâts');
  });
});
