import {
  geometryPayloadForLibrary,
  hasEmbeddedGeometry,
  linkLibraryDungeon,
  mapsForCampaignPersist,
  mergeLibraryGeometry,
  needsLibraryHydration,
  stripGeometryForPersist,
} from './campaign-dungeon-map-ref.util';
import { createEmptyDungeonMap, type CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';

describe('campaign-dungeon-map-ref.util', () => {
  const lib = (): CampaignDungeonMap => {
    const m = createEmptyDungeonMap('Crypte');
    m.rooms = [
      { id: 'r1', label: 'A', x: 1, y: 1, width: 3, height: 3, encounterId: 'enc-lib', notes: 'lib' },
    ];
    m.markers = [{ id: 'mk1', x: 2, y: 2, kind: 'chest', notes: 'gold' }];
    return m;
  };

  it('linkLibraryDungeon creates overlay-only ref without tiles', () => {
    const linked = linkLibraryDungeon(lib(), 'lib-uuid', 'Crypte live');
    expect(linked.libraryDungeonId).toBe('lib-uuid');
    expect(linked.tiles).toEqual([]);
    expect(linked.fogOfWarEnabled).toBe(false);
    expect(linked.rooms?.[0].encounterId).toBeNull();
    expect(needsLibraryHydration(linked)).toBe(true);
    expect(hasEmbeddedGeometry(linked)).toBe(false);
  });

  it('linkLibraryDungeon falls back to default name', () => {
    const empty = createEmptyDungeonMap('');
    empty.name = '';
    const linked = linkLibraryDungeon(empty, 'id');
    expect(linked.name).toBe('Donjon');
  });

  it('hasEmbeddedGeometry is false for empty tiles', () => {
    const m = createEmptyDungeonMap('x');
    m.tiles = [];
    expect(hasEmbeddedGeometry(m)).toBe(false);
    expect(hasEmbeddedGeometry(null)).toBe(false);
    expect(needsLibraryHydration(null)).toBe(false);
    expect(needsLibraryHydration({ ...m, libraryDungeonId: undefined })).toBe(false);
  });

  it('stripGeometryForPersist keeps fog and encounter overlay', () => {
    const linked = linkLibraryDungeon(lib(), 'lib-1');
    const hydrated = mergeLibraryGeometry(
      {
        ...linked,
        fogOfWarEnabled: true,
        revealedRoomIds: ['r1'],
        rooms: [{ id: 'r1', label: 'A', x: 1, y: 1, width: 3, height: 3, encounterId: 'enc-camp' }],
      },
      lib(),
    );
    const stripped = stripGeometryForPersist(hydrated);
    expect(stripped.tiles).toEqual([]);
    expect(stripped.markers).toEqual([]);
    expect(stripped.libraryDungeonId).toBe('lib-1');
    expect(stripped.fogOfWarEnabled).toBe(true);
    expect(stripped.revealedRoomIds).toEqual(['r1']);
    expect(stripped.revealedCorridorCells ?? []).toEqual([]);
    expect(stripped.rooms?.[0].encounterId).toBe('enc-camp');
  });

  it('stripGeometryForPersist leaves embedded maps unchanged', () => {
    const embedded = createEmptyDungeonMap('Legacy');
    expect(stripGeometryForPersist(embedded)).toBe(embedded);
  });

  it('mergeLibraryGeometry prefers campaign encounter overlay', () => {
    const linked = linkLibraryDungeon(lib(), 'lib-2');
    linked.rooms = [{ id: 'r1', label: 'A', x: 1, y: 1, width: 3, height: 3, encounterId: 'enc-camp' }];
    const merged = mergeLibraryGeometry(linked, lib());
    expect(hasEmbeddedGeometry(merged)).toBe(true);
    expect(merged.rooms?.[0].encounterId).toBe('enc-camp');
    expect(merged.markers?.length).toBe(1);
  });

  it('mergeLibraryGeometry keeps library encounter when no overlay', () => {
    const linked = linkLibraryDungeon(lib(), 'lib-4');
    linked.rooms = [];
    const merged = mergeLibraryGeometry(linked, lib());
    expect(merged.rooms?.[0].encounterId).toBe('enc-lib');
  });

  it('mergeLibraryGeometry merges notes and theme from ref', () => {
    const linked = linkLibraryDungeon(lib(), 'lib-5', 'Custom');
    linked.theme = 'crypt';
    linked.regionName = 'Eana';
    linked.rooms = [
      { id: 'r1', label: 'A', x: 1, y: 1, width: 3, height: 3, notes: 'camp-note' },
    ];
    const merged = mergeLibraryGeometry(linked, lib());
    expect(merged.name).toBe('Custom');
    expect(merged.theme).toBe('crypt');
    expect(merged.regionName).toBe('Eana');
    expect(merged.rooms?.[0].notes).toBe('camp-note');
  });

  it('needsLibraryHydration false when tiles present with library id', () => {
    const m = createEmptyDungeonMap('x');
    m.libraryDungeonId = 'lib';
    expect(needsLibraryHydration(m)).toBe(false);
  });

  it('mapsForCampaignPersist strips only linked maps', () => {
    const embedded = createEmptyDungeonMap('Legacy');
    const linked = linkLibraryDungeon(lib(), 'lib-3');
    const out = mapsForCampaignPersist([embedded, linked]);
    expect(hasEmbeddedGeometry(out[0])).toBe(true);
    expect(out[1].tiles).toEqual([]);
    expect(out[1].gridWidth).toBe(0);
  });

  it('geometryPayloadForLibrary clears campaign overlay', () => {
    const m = createEmptyDungeonMap('X');
    m.handoutId = 'h1';
    m.fogOfWarEnabled = true;
    m.revealedRoomIds = ['r1'];
    m.libraryDungeonId = 'should-clear';
    m.rooms = [{ id: 'r1', label: 'A', x: 0, y: 0, width: 1, height: 1, encounterId: 'e1' }];
    const payload = geometryPayloadForLibrary(m);
    expect(payload.handoutId).toBeNull();
    expect(payload.fogOfWarEnabled).toBe(false);
    expect(payload.revealedRoomIds).toEqual([]);
    expect(payload.libraryDungeonId).toBeUndefined();
    expect(payload.rooms?.[0].encounterId).toBeNull();
  });

  it('hasEmbeddedGeometry handles missing grid dims', () => {
    const m = createEmptyDungeonMap('x');
    expect(
      hasEmbeddedGeometry({ ...m, gridWidth: 0 as number, tiles: m.tiles }),
    ).toBe(false);
    expect(
      hasEmbeddedGeometry({
        ...m,
        gridWidth: undefined as unknown as number,
        gridHeight: undefined as unknown as number,
      }),
    ).toBe(false);
  });

  it('stripGeometryForPersist defaults fog/handout/rooms', () => {
    const linked = linkLibraryDungeon(lib(), 'lib-def');
    linked.fogOfWarEnabled = undefined;
    linked.handoutId = undefined;
    linked.revealedRoomIds = undefined;
    linked.regionId = undefined;
    const stripped = stripGeometryForPersist(linked);
    expect(stripped.fogOfWarEnabled).toBe(false);
    expect(stripped.handoutId).toBeNull();
    expect(stripped.revealedRoomIds).toEqual([]);
    expect(stripped.regionId).toBeNull();
  });

  it('mergeLibraryGeometry falls back to library meta and room fields', () => {
    const library = lib();
    library.libraryDungeonId = 'from-lib';
    library.theme = 'cave';
    library.regionId = 'reg-1';
    library.regionName = 'Nord';
    library.rooms = [
      {
        id: 'r1',
        label: 'A',
        x: 1,
        y: 1,
        width: 3,
        height: 3,
        encounterId: 'enc-lib',
        notes: 'lib-note',
        randomEncounter: { creatures: [{ name: 'Rat', quantity: 1 }] },
      },
    ];
    const ref: CampaignDungeonMap = {
      ...linkLibraryDungeon(lib(), 'lib-fb'),
      name: '',
      theme: '' as never,
      regionId: null,
      regionName: undefined,
      libraryDungeonId: null,
      handoutId: undefined,
      fogOfWarEnabled: undefined,
      revealedRoomIds: undefined,
      rooms: [{ id: 'r1', label: 'A', x: 1, y: 1, width: 3, height: 3 }],
      createdAt: '',
      updatedAt: '',
    };
    const merged = mergeLibraryGeometry(ref, library);
    expect(merged.libraryDungeonId).toBe('from-lib');
    expect(merged.name).toBe('Crypte');
    expect(merged.theme).toBe('cave');
    expect(merged.regionId).toBe('reg-1');
    expect(merged.regionName).toBe('Nord');
    expect(merged.handoutId).toBeNull();
    expect(merged.fogOfWarEnabled).toBe(false);
    expect(merged.revealedRoomIds).toEqual([]);
    expect(merged.rooms[0].encounterId).toBe('enc-lib');
    expect(merged.rooms[0].notes).toBe('lib-note');
    expect(merged.rooms[0].randomEncounter?.creatures[0].name).toBe('Rat');
    expect(merged.createdAt).toBeTruthy();
    expect(merged.updatedAt).toBeTruthy();
  });

  it('linkLibraryDungeon trims blank and copies region', () => {
    const src = lib();
    src.regionId = 'r';
    src.regionName = 'Sud';
    const linked = linkLibraryDungeon(src, 'id', '   ');
    expect(linked.name).toBe('Donjon');
    expect(linked.regionId).toBe('r');
    expect(linked.regionName).toBe('Sud');
  });

  it('geometryPayloadForLibrary keeps room randomEncounter', () => {
    const m = createEmptyDungeonMap('X');
    m.rooms = [
      {
        id: 'r1',
        label: 'A',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        randomEncounter: { creatures: [{ name: 'Gob', quantity: 2 }] },
      },
    ];
    const payload = geometryPayloadForLibrary(m);
    expect(payload.rooms[0].randomEncounter?.creatures[0].name).toBe('Gob');
  });

  it('linkLibraryDungeon uses explicit name', () => {
    const linked = linkLibraryDungeon(lib(), 'lib-named', 'Nom custom');
    expect(linked.name).toBe('Nom custom');
    expect(linked.id).toBeTruthy();
    const noName = linkLibraryDungeon({ ...lib(), name: '' }, 'lib-x', undefined);
    expect(noName.name).toBe('Donjon');
  });

  it('mergeLibraryGeometry uses ref timestamps when present', () => {
    const linked = linkLibraryDungeon(lib(), 'lib-ts');
    linked.createdAt = '2020-01-01T00:00:00.000Z';
    linked.updatedAt = '2020-01-02T00:00:00.000Z';
    const merged = mergeLibraryGeometry(linked, lib());
    expect(merged.createdAt).toBe('2020-01-01T00:00:00.000Z');
    expect(merged.updatedAt).toBe('2020-01-02T00:00:00.000Z');
  });

  it('mergeLibraryGeometry nulls encounter when both missing', () => {
    const library = lib();
    library.rooms = [{ id: 'r1', label: 'A', x: 0, y: 0, width: 1, height: 1 }];
    const ref = linkLibraryDungeon(library, 'lib-null');
    ref.rooms = [{ id: 'r1', label: 'A', x: 0, y: 0, width: 1, height: 1 }];
    const merged = mergeLibraryGeometry(ref, library);
    expect(merged.rooms[0].encounterId).toBeNull();
  });
});
