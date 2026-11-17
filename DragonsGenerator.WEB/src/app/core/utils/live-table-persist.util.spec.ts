import { isLiveTableSessionPatch, liveTablePersistBody } from './live-table-persist.util';

describe('live-table-persist.util', () => {
  it('detects pawn / map patches only', () => {
    expect(isLiveTableSessionPatch({ tablePawns: [] })).toBeTrue();
    expect(isLiveTableSessionPatch({ notes: 'x' })).toBeFalse();
    expect(isLiveTableSessionPatch({ activeCombat: null })).toBeFalse();
    expect(isLiveTableSessionPatch({})).toBeFalse();
  });

  it('builds a light body without wiping missing pawns', () => {
    const body = liveTablePersistBody('s1', { activeMapId: 'm1' });
    expect(body).toEqual({ sessionId: 's1', activeMapId: 'm1' });
    expect(liveTablePersistBody('s1', { activeMapId: null })?.clearActiveMapId).toBeTrue();
    expect(liveTablePersistBody('', { tablePawns: [] })).toBeNull();
  });
});
