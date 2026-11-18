import {
  isLiveTableSessionPatch,
  liveTablePersistBody,
  liveTableSnapshotFromSession,
} from './live-table-persist.util';

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

  it('snapshots the live table fields from a session', () => {
    expect(liveTableSnapshotFromSession(undefined)).toBeNull();
    const snap = liveTableSnapshotFromSession({
      id: 's1',
      title: 'Soirée',
      scheduledAt: '',
      status: 'planned',
      activeMapId: 'm1',
      tablePawns: [{ id: 'p1', name: 'Aria', mapX: 1, mapY: 1 }],
    });
    expect(snap?.activeMapId).toBe('m1');
    expect(snap?.tablePawns?.[0].id).toBe('p1');
  });
});
