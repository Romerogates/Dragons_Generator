import { createCombatant } from './combat-tracker.util';
import {
  canActOnCombatTurn,
  clampHpAdjustAmount,
  combatantNeedsHp,
  combatantNeedsInit,
  compactPlayerRoster,
  continueInitiativeHint,
  creatureHasMjSecretNotes,
  formatPlaySessionDate,
  formatSceneTimerDisplay,
  isPlaySessionView,
  remainingSceneTimerSec,
  buildSceneTimerStart,
  toggleSceneTimerPauseState,
  canToggleTableReady,
  toggleTableReadyUserIds,
  initialHandoutOverlayId,
  nextPlannedSession,
  openFightHint,
  PLAY_SESSION_TABS,
  playerNeedsInitiative,
  resolveHeroProposalStatus,
} from './play-table.util';

describe('play-table.util', () => {
  it('lists six exclusive table views', () => {
    expect(PLAY_SESSION_TABS.map((t) => t.id)).toEqual([
      'resume',
      'notes',
      'combat',
      'encounters',
      'dungeon',
      'history',
    ]);
    expect(isPlaySessionView('combat')).toBeTrue();
    expect(isPlaySessionView('overview')).toBeFalse();
  });

  it('explains why initiative cannot start', () => {
    expect(continueInitiativeHint(true, 0, 0)).toBeNull();
    expect(continueInitiativeHint(false, 0, 0)).toContain('allié et un adversaire');
    expect(continueInitiativeHint(false, 0, 2)).toContain('allié');
    expect(continueInitiativeHint(false, 1, 0)).toContain('adversaire');
    expect(continueInitiativeHint(false, 1, 1)).toContain('allié et un adversaire');
  });

  it('explains why fight cannot open', () => {
    expect(openFightHint(true, 3)).toBeNull();
    expect(openFightHint(false, 2)).toBe('Encore 2 combattant(s) sans initiative.');
    expect(openFightHint(false, 0)).toContain('initiative');
  });

  it('flags missing init and hp on living combatants', () => {
    const raw = createCombatant({ name: 'Héro', kind: 'player' });
    expect(combatantNeedsInit(raw)).toBeTrue();
    expect(combatantNeedsHp(raw)).toBeTrue();
    const ready = createCombatant({
      name: 'Héro',
      kind: 'player',
      initiativeRoll: 12,
      currentHp: 10,
      maxHp: 10,
    });
    expect(combatantNeedsInit(ready)).toBeFalse();
    expect(combatantNeedsHp(ready)).toBeFalse();
    const down = createCombatant({
      name: 'Ko',
      kind: 'monster',
      currentHp: 0,
      maxHp: 8,
    });
    expect(combatantNeedsInit(down)).toBeFalse();
    expect(combatantNeedsHp(down)).toBeFalse();
  });

  it('detects player initiative still missing', () => {
    expect(playerNeedsInitiative(null)).toBeFalse();
    expect(
      playerNeedsInitiative(createCombatant({ name: 'A', kind: 'player' })),
    ).toBeTrue();
    expect(
      playerNeedsInitiative(
        createCombatant({ name: 'A', kind: 'player', playerSubmitted: true }),
      ),
    ).toBeFalse();
  });

  it('gates turn actions for spectator / MJ / player', () => {
    expect(canActOnCombatTurn(true, false, true, true)).toBeFalse();
    expect(canActOnCombatTurn(false, true, true, false)).toBeTrue();
    expect(canActOnCombatTurn(false, true, false, false)).toBeFalse();
    expect(canActOnCombatTurn(false, false, true, true)).toBeTrue();
    expect(canActOnCombatTurn(false, false, true, false)).toBeFalse();
  });

  it('compacts the player roster to tour + self', () => {
    const order = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(compactPlayerRoster(order, { isDm: true, expanded: false, turnId: 'b', myId: 'c' })).toEqual(
      order,
    );
    expect(
      compactPlayerRoster(order, { isDm: false, expanded: true, turnId: 'b', myId: 'c' }),
    ).toEqual(order);
    expect(
      compactPlayerRoster(order, { isDm: false, expanded: false, turnId: 'b', myId: 'c' }),
    ).toEqual([{ id: 'b' }, { id: 'c' }]);
    expect(
      compactPlayerRoster(order, { isDm: false, expanded: false, turnId: null, myId: null }),
    ).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('formats the scene timer and clamps HP steps', () => {
    expect(formatSceneTimerDisplay(null)).toBeNull();
    expect(formatSceneTimerDisplay(0)).toBe('0:00');
    expect(formatSceneTimerDisplay(125)).toBe('2:05');
    expect(remainingSceneTimerSec(null)).toBeNull();
    expect(remainingSceneTimerSec({ label: 'S', endsAtIso: '', pausedRemainingSec: 12 })).toBe(12);
    expect(remainingSceneTimerSec({ label: 'S', endsAtIso: '', pausedRemainingSec: -3 })).toBe(0);
    expect(remainingSceneTimerSec({ label: 'S', endsAtIso: '' })).toBeNull();
    expect(remainingSceneTimerSec({ label: 'S', endsAtIso: 'not-a-date' })).toBeNull();
    const now = Date.parse('2026-06-01T12:00:00Z');
    expect(
      remainingSceneTimerSec(
        { label: 'S', endsAtIso: '2026-06-01T12:01:05Z', pausedRemainingSec: null },
        now,
      ),
    ).toBe(65);
    const started = buildSceneTimerStart(2, 'Scène', now);
    expect(started.label).toBe('Scène');
    expect(started.pausedRemainingSec).toBeNull();
    expect(remainingSceneTimerSec(started, now)).toBe(120);
    const paused = toggleSceneTimerPauseState(started, now);
    expect(paused.pausedRemainingSec).toBe(120);
    const fromNegativePause = toggleSceneTimerPauseState(
      { label: 'S', endsAtIso: '2026-06-01T12:01:00Z', pausedRemainingSec: -1 },
      now,
    );
    expect(fromNegativePause.pausedRemainingSec).toBe(60);
    const resumed = toggleSceneTimerPauseState(paused, now);
    expect(resumed.pausedRemainingSec).toBeNull();
    expect(remainingSceneTimerSec(resumed, now)).toBe(120);
    expect(clampHpAdjustAmount('')).toBe(1);
    expect(clampHpAdjustAmount(0)).toBe(1);
    expect(clampHpAdjustAmount('8')).toBe(8);
    expect(formatPlaySessionDate('2026-06-01T18:30:00')).toMatch(/\d/);
  });

  it('maps hero proposal status and MJ secret notes', () => {
    expect(resolveHeroProposalStatus(null)).toBe('none');
    expect(resolveHeroProposalStatus({ proposalStatus: 'approved' })).toBe('none');
    expect(
      resolveHeroProposalStatus({ proposalStatus: 'approved', approvedCharacterId: 'c1' }),
    ).toBe('approved');
    expect(resolveHeroProposalStatus({ proposalStatus: 'pending' })).toBe('pending');
    expect(resolveHeroProposalStatus({ proposalStatus: 'rejected' })).toBe('rejected');
    expect(resolveHeroProposalStatus({ proposalStatus: 'none' })).toBe('none');
    expect(creatureHasMjSecretNotes({})).toBeFalse();
    expect(creatureHasMjSecretNotes({ secret: '  ' })).toBeFalse();
    expect(creatureHasMjSecretNotes({ voice: 'grave' })).toBeTrue();
  });

  it('picks the next planned session from now, else the soonest planned', () => {
    const now = Date.parse('2026-06-01T12:00:00Z');
    const past = {
      status: 'planned',
      scheduledAt: '2026-05-01T12:00:00Z',
    };
    const future = {
      status: 'planned',
      scheduledAt: '2026-07-01T12:00:00Z',
    };
    const done = {
      status: 'done',
      scheduledAt: '2026-08-01T12:00:00Z',
    };
    expect(nextPlannedSession([past, future, done], now)).toEqual(future);
    expect(nextPlannedSession([past, done], now)).toEqual(past);
    expect(nextPlannedSession([done], now)).toBeNull();
  });

  it('toggles table-ready ids with spectator / player locks', () => {
    expect(canToggleTableReady({ isSpectator: true, isDm: false, me: 'u1', userId: 'u1' })).toBeFalse();
    expect(canToggleTableReady({ isSpectator: false, isDm: false, me: 'u1', userId: 'u2' })).toBeFalse();
    expect(canToggleTableReady({ isSpectator: false, isDm: true, me: 'mj', userId: 'u2' })).toBeTrue();
    expect(canToggleTableReady({ isSpectator: false, isDm: false, me: 'u1', userId: 'u1' })).toBeTrue();
    expect(toggleTableReadyUserIds(['u1'], 'u1')).toEqual([]);
    expect(toggleTableReadyUserIds(undefined, 'u2')).toEqual(['u2']);
  });

  it('picks the pinned published handout for the overlay', () => {
    expect(initialHandoutOverlayId('h1', [{ id: 'h1' }, { id: 'h2' }])).toBe('h1');
    expect(initialHandoutOverlayId('h9', [{ id: 'h1' }])).toBeNull();
    expect(initialHandoutOverlayId(null, [{ id: 'h1' }])).toBeNull();
  });
});
