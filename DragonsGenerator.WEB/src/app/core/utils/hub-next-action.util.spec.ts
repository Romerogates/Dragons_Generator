import { resolveHubNextAction, type HubNextActionInput } from './hub-next-action.util';

function base(over: Partial<HubNextActionInput> = {}): HubNextActionInput {
  return {
    isOwner: false,
    isSpectator: false,
    heroStatus: 'none',
    hasActiveSession: false,
    hasPlannedSession: false,
    ...over,
  };
}

describe('hub-next-action.util', () => {
  it('skips owners', () => {
    expect(resolveHubNextAction(base({ isOwner: true }))).toBeNull();
  });

  it('guides player propose → wait → play', () => {
    expect(resolveHubNextAction(base())?.kind).toBe('propose_hero');
    expect(resolveHubNextAction(base({ heroStatus: 'pending' }))?.kind).toBe('wait_approval');
    expect(resolveHubNextAction(base({ heroStatus: 'rejected' }))?.kind).toBe('rejected_hero');
    expect(
      resolveHubNextAction(base({ heroStatus: 'approved', hasActiveSession: true }))?.cta,
    ).toBe('play');
    expect(
      resolveHubNextAction(base({ heroStatus: 'approved', hasPlannedSession: true }))?.kind,
    ).toBe('wait_session');
    expect(resolveHubNextAction(base({ heroStatus: 'approved' }))?.kind).toBe('idle');
  });

  it('marks spectators', () => {
    expect(resolveHubNextAction(base({ isSpectator: true }))?.kind).toBe('spectator');
  });
});
