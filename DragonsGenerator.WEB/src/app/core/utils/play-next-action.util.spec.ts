import { resolvePlayNextAction, type PlayNextActionInput } from './play-next-action.util';

function base(over: Partial<PlayNextActionInput> = {}): PlayNextActionInput {
  return {
    isDm: false,
    isSpectator: false,
    hasActiveSession: true,
    heroStatus: 'approved',
    tableReady: true,
    approvedPlayerCount: 2,
    tableReadyCount: 2,
    combatPhase: null,
    collectingInitiative: false,
    missingInitCount: 0,
    hasAlly: false,
    hasEnemy: false,
    canOpenFight: false,
    isMyTurn: false,
    myCombatantInFight: false,
    playerNeedsInit: false,
    currentTurnName: null,
    publishedHandoutCount: 0,
    ...over,
  };
}

describe('play-next-action.util', () => {
  it('returns null without active session', () => {
    expect(resolvePlayNextAction(base({ hasActiveSession: false }))).toBeNull();
  });

  it('marks spectator mode', () => {
    const a = resolvePlayNextAction(base({ isSpectator: true }));
    expect(a?.kind).toBe('spectator');
    expect(a?.tone).toBe('sky');
  });

  it('guides player through propose → wait → ready', () => {
    expect(resolvePlayNextAction(base({ heroStatus: 'none' }))?.kind).toBe('propose_hero');
    expect(resolvePlayNextAction(base({ heroStatus: 'pending' }))?.kind).toBe('wait_approval');
    expect(resolvePlayNextAction(base({ heroStatus: 'rejected' }))?.kind).toBe('rejected_hero');
    expect(resolvePlayNextAction(base({ tableReady: false }))?.kind).toBe('mark_ready');
  });

  it('points player to initiative and own turn', () => {
    expect(
      resolvePlayNextAction(
        base({
          combatPhase: 'initiative',
          collectingInitiative: true,
          myCombatantInFight: true,
          playerNeedsInit: true,
        }),
      )?.kind,
    ).toBe('roll_initiative');

    expect(
      resolvePlayNextAction(
        base({
          combatPhase: 'initiative',
          collectingInitiative: true,
          myCombatantInFight: true,
          playerNeedsInit: false,
          missingInitCount: 1,
        }),
      )?.detail,
    ).toContain('1');

    expect(
      resolvePlayNextAction(
        base({ combatPhase: 'initiative', collectingInitiative: false, missingInitCount: 0 }),
      )?.detail,
    ).toContain('ouvrir');

    expect(
      resolvePlayNextAction(base({ combatPhase: 'fight', isMyTurn: true }))?.kind,
    ).toBe('your_turn');

    const waiting = resolvePlayNextAction(
      base({ combatPhase: 'fight', currentTurnName: 'Gobelin', publishedHandoutCount: 1 }),
    );
    expect(waiting?.kind).toBe('wait_turn');
    expect(waiting?.cta).toBe('handouts');

    expect(
      resolvePlayNextAction(base({ combatPhase: 'fight', currentTurnName: null }))?.title,
    ).toBe('En attente');
  });

  it('shows wait_table for ready player outside combat', () => {
    const withDocs = resolvePlayNextAction(base({ publishedHandoutCount: 2 }));
    expect(withDocs?.kind).toBe('wait_table');
    expect(withDocs?.cta).toBe('handouts');

    const bare = resolvePlayNextAction(base({ publishedHandoutCount: 0 }));
    expect(bare?.kind).toBe('wait_table');
    expect(bare?.cta).toBeUndefined();
  });

  it('guides DM through sides → init → open fight', () => {
    expect(
      resolvePlayNextAction(base({ isDm: true, combatPhase: 'setup', hasAlly: false, hasEnemy: true }))
        ?.detail,
    ).toContain('allié');
    expect(
      resolvePlayNextAction(base({ isDm: true, combatPhase: 'setup', hasAlly: true, hasEnemy: false }))
        ?.detail,
    ).toContain('adversaire');
    expect(
      resolvePlayNextAction(
        base({ isDm: true, combatPhase: 'setup', hasAlly: true, hasEnemy: true }),
      )?.kind,
    ).toBe('continue_initiative');
    expect(
      resolvePlayNextAction(
        base({
          isDm: true,
          combatPhase: 'initiative',
          missingInitCount: 2,
          canOpenFight: false,
        }),
      )?.detail,
    ).toContain('2');
    expect(
      resolvePlayNextAction(
        base({
          isDm: true,
          combatPhase: 'initiative',
          canOpenFight: false,
          missingInitCount: 0,
        }),
      )?.detail,
    ).toContain('ouvrez');
    expect(
      resolvePlayNextAction(
        base({ isDm: true, combatPhase: 'initiative', canOpenFight: true, missingInitCount: 0 }),
      )?.kind,
    ).toBe('open_combat');
  });

  it('guides DM during fight and ready table', () => {
    expect(
      resolvePlayNextAction(
        base({ isDm: true, combatPhase: 'fight', currentTurnName: 'Aria' }),
      )?.title,
    ).toContain('Aria');
    expect(
      resolvePlayNextAction(base({ isDm: true, combatPhase: 'fight', currentTurnName: null }))?.title,
    ).toContain('Combat');

    expect(
      resolvePlayNextAction(
        base({ isDm: true, combatPhase: null, tableReadyCount: 1, approvedPlayerCount: 3 }),
      )?.kind,
    ).toBe('wait_table');

    expect(
      resolvePlayNextAction(
        base({ isDm: true, combatPhase: null, tableReadyCount: 2, approvedPlayerCount: 2 }),
      )?.kind,
    ).toBe('start_combat');
  });

  it('asks DM to invite when no approved heroes', () => {
    expect(
      resolvePlayNextAction(base({ isDm: true, approvedPlayerCount: 0 }))?.kind,
    ).toBe('invite_players');
  });
});
