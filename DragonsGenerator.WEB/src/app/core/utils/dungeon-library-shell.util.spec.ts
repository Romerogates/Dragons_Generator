import { createEmptyDungeonMap } from '@core/models/Campaign/dungeon-map';
import {
  buildLibraryDungeonShell,
  dungeonShareUrl,
  normalizeLibraryDungeonMap,
} from './dungeon-library-shell.util';

describe('dungeon-library-shell.util', () => {
  it('builds a share URL', () => {
    expect(dungeonShareUrl('http://localhost:8081/', 'tok-1')).toBe(
      'http://localhost:8081/dungeons/shared/tok-1',
    );
  });

  it('normalizes library map id and name', () => {
    const raw = createEmptyDungeonMap('');
    const map = normalizeLibraryDungeonMap('id-1', '', raw);
    expect(map.id).toBe('id-1');
    expect(map.name).toBe('Donjon');
    expect(normalizeLibraryDungeonMap('id-1', 'Cave', raw).name).toBe('Cave');
  });

  it('wraps a map in a library campaign shell', () => {
    const map = normalizeLibraryDungeonMap('id-1', 'Cave', createEmptyDungeonMap('Cave'));
    const shell = buildLibraryDungeonShell('id-1', map, false, '2026-01-01T00:00:00Z');
    expect(shell.id).toBe('library-id-1');
    expect(shell.isOwner).toBeTrue();
    expect(shell.data.dungeonMaps?.[0]?.id).toBe('id-1');
    expect(buildLibraryDungeonShell('id-1', map, true).isOwner).toBeFalse();
  });
});
