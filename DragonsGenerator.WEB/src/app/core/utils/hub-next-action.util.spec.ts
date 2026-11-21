import { resolveHubNextAction, type HubNextActionInput } from './hub-next-action.util';

function base(over: Partial<HubNextActionInput> = {}): HubNextActionInput {
  return {
    isTableDm: false,
    isSpectator: false,
    heroStatus: 'none',
    hasActiveSession: false,
    hasPlannedSession: false,
    ...over,
  };
}

describe('hub-next-action.util', () => {
  it('sends the GM to the open table or enter session', () => {
    expect(resolveHubNextAction(base({ isTableDm: true, hasActiveSession: true }))?.cta).toBe('play');
    const planned = resolveHubNextAction(base({ isTableDm: true, hasPlannedSession: true }));
    expect(planned?.kind).toBe('wait_session');
    expect(planned?.cta).toBe('enter_session');
    expect(planned?.ctaLabel).toBe('Entrer en session');
    expect(resolveHubNextAction(base({ isTableDm: true }))?.cta).toBe('sessions');
  });

  it('guides player propose → wait → play', () => {
    expect(resolveHubNextAction(base())?.kind).toBe('propose_hero');
    expect(resolveHubNextAction(base({ heroStatus: 'pending' }))?.kind).toBe('wait_approval');
    expect(resolveHubNextAction(base({ heroStatus: 'rejected' }))?.kind).toBe('rejected_hero');
    expect(
      resolveHubNextAction(base({ heroStatus: 'approved', hasActiveSession: true }))?.cta,
    ).toBe('play');
    const waiting = resolveHubNextAction(
      base({ heroStatus: 'approved', hasPlannedSession: true }),
    );
    expect(waiting?.kind).toBe('wait_session');
    expect(waiting?.cta).toBe('sessions');
    expect(resolveHubNextAction(base({ heroStatus: 'approved' }))?.cta).toBe('sessions');
  });

  it('marks spectators', () => {
    expect(resolveHubNextAction(base({ isSpectator: true }))?.kind).toBe('spectator');
  });

  it('asks approved players to RSVP before waiting for a session', () => {
    const action = resolveHubNextAction(
      base({
        heroStatus: 'approved',
        hasPlannedSession: true,
        pendingRsvp: { eventId: 'ev1', title: 'Vendredi', whenLabel: 'ven. 10 oct. 20:00' },
      }),
    );
    expect(action?.kind).toBe('rsvp');
    expect(action?.eventId).toBe('ev1');
    expect(action?.cta).toBe('rsvp');
  });

  it('treats co-MJ like the owner for table CTAs', () => {
    expect(
      resolveHubNextAction(base({ isTableDm: true, hasPlannedSession: true }))?.cta,
    ).toBe('enter_session');
  });
});
