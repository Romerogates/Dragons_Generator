import { buildFirstSessionChecklist } from './campaign-first-session-checklist.util';

describe('buildFirstSessionChecklist', () => {
  it('starts on heroes so the DM can prep pregens before invites', () => {
    const g = buildFirstSessionChecklist({
      hasInviteActivity: false,
      approvedPlayerCount: 0,
      readyPregenCount: 0,
      hasPlannedSession: false,
      hasActiveSession: false,
      playedSessionCount: 0,
    });
    expect(g.current?.id).toBe('heroes');
    expect(g.current?.action).toBe('openPregens');
    expect(g.allDone).toBe(false);
  });

  it('treats ready pregens as heroes done without players', () => {
    const g = buildFirstSessionChecklist({
      hasInviteActivity: false,
      approvedPlayerCount: 0,
      readyPregenCount: 2,
      hasPlannedSession: false,
      hasActiveSession: false,
      playedSessionCount: 0,
    });
    expect(g.steps.find((s) => s.id === 'heroes')?.done).toBe(true);
    expect(g.current?.id).toBe('invite');
  });

  it('uses Planifier ce soir then Entrer en session', () => {
    const afterInvite = buildFirstSessionChecklist({
      hasInviteActivity: true,
      approvedPlayerCount: 1,
      readyPregenCount: 0,
      hasPlannedSession: false,
      hasActiveSession: false,
      playedSessionCount: 0,
    });
    expect(afterInvite.current?.id).toBe('session');
    expect(afterInvite.current?.actionLabel).toBe('Planifier ce soir');

    const withSession = buildFirstSessionChecklist({
      hasInviteActivity: true,
      approvedPlayerCount: 1,
      readyPregenCount: 0,
      hasPlannedSession: true,
      hasActiveSession: false,
      playedSessionCount: 0,
    });
    expect(withSession.current?.id).toBe('table');
    expect(withSession.current?.actionLabel).toBe('Entrer en session');
  });

  it('marks all done when table was opened', () => {
    const g = buildFirstSessionChecklist({
      hasInviteActivity: true,
      approvedPlayerCount: 1,
      readyPregenCount: 0,
      hasPlannedSession: true,
      hasActiveSession: true,
      playedSessionCount: 0,
    });
    expect(g.allDone).toBe(true);
    expect(g.current).toBeNull();
  });
});
