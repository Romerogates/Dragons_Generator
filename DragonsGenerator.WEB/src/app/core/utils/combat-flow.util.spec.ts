import {
  canAdvanceFromSetup,
  canOpenFightPhase,
  createActiveCombat,
  createCombatant,
  resolveCombatFlowPhase,
} from './combat-tracker.util';

describe('combat flow phases', () => {
  it('starts in setup', () => {
    const combat = createActiveCombat([]);
    expect(resolveCombatFlowPhase(combat)).toBe('setup');
  });

  it('stays setup without both sides', () => {
    const combat = createActiveCombat([
      createCombatant({ name: 'Héro', kind: 'player', initiativeRoll: 10 }),
    ]);
    expect(canAdvanceFromSetup(combat)).toBe(false);
    expect(resolveCombatFlowPhase(combat)).toBe('setup');
  });

  it('advances to initiative when both sides present', () => {
    const combat = createActiveCombat([
      createCombatant({ name: 'Héro', kind: 'player' }),
      createCombatant({ name: 'Gobelin', kind: 'monster' }),
    ]);
    combat.flowPhase = 'initiative';
    expect(canAdvanceFromSetup(combat)).toBe(true);
    expect(resolveCombatFlowPhase(combat)).toBe('initiative');
    expect(canOpenFightPhase(combat)).toBe(false);
  });

  it('opens fight when everyone has initiative', () => {
    const combat = createActiveCombat([
      createCombatant({ name: 'Héro', kind: 'player', initiativeRoll: 15 }),
      createCombatant({ name: 'Gobelin', kind: 'monster', initiativeRoll: 8 }),
    ]);
    combat.flowPhase = 'fight';
    expect(canOpenFightPhase(combat)).toBe(true);
    expect(resolveCombatFlowPhase(combat)).toBe('fight');
  });
});
