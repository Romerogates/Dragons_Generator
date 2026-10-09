import { createEmptyDungeonMap } from '@core/models/Campaign/dungeon-map';
import {
  applyDungeonEditorPaint,
  applyDungeonRoomDefinition,
  applyDungeonRoomDelete,
  campaignDungeonMemberMapUrl,
  clientToDungeonTile,
  dungeonEditorFitPanScale,
  dungeonZoomTowardPointer,
  mergeRegeneratedDungeonMap,
  stampDungeonMapIdentity,
  upsertDungeonMapHandout,
} from './dungeon-map-edit.util';
import { DUNGEON_SIZE_PRESETS } from './dungeon-editor-ui.util';

function wallMap(): ReturnType<typeof createEmptyDungeonMap> {
  const map = createEmptyDungeonMap('Edit');
  map.id = 'm1';
  map.gridWidth = 8;
  map.gridHeight = 8;
  map.tiles = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 'wall' as const));
  return map;
}

describe('dungeon-map-edit.util', () => {
  it('lists size presets used by the generator', () => {
    expect(DUNGEON_SIZE_PRESETS.map((p) => p.id)).toEqual(['compact', 'standard', 'large']);
  });

  it('stamps a generated map identity', () => {
    const base = wallMap();
    const stamped = stampDungeonMapIdentity(base, '  Crypte  ', 't1', () => 'nid');
    expect(stamped.id).toBe('nid');
    expect(stamped.name).toBe('Crypte');
    expect(stamped.createdAt).toBe('t1');
  });

  it('merges a regenerated layout onto the current map', () => {
    const current = wallMap();
    current.handoutId = 'h1';
    current.createdAt = 'old';
    const next = wallMap();
    next.id = 'other';
    next.name = 'Other';
    const merged = mergeRegeneratedDungeonMap(current, next, 'now');
    expect(merged.id).toBe('m1');
    expect(merged.name).toBe('Edit');
    expect(merged.handoutId).toBe('h1');
    expect(merged.createdAt).toBe('old');
    expect(merged.updatedAt).toBe('now');
  });

  it('selects a room and marker', () => {
    const map = wallMap();
    map.rooms = [{ id: 'r1', label: 'Salle 1', x: 1, y: 1, width: 2, height: 2 }];
    map.markers = [{ id: 'mk', x: 1, y: 1, kind: 'chest' }];
    const r = applyDungeonEditorPaint({
      map,
      tool: 'select',
      x: 1,
      y: 1,
      fillKind: 'floor',
      brushSize: 1,
      lastPaintKey: null,
      fromStrokeMove: false,
      strokeDragged: false,
    });
    expect(r).toEqual({ kind: 'select', roomId: 'r1', markerId: 'mk' });
  });

  it('paints floor and skips the same cell key', () => {
    const map = wallMap();
    const a = applyDungeonEditorPaint({
      map,
      tool: 'floor',
      x: 2,
      y: 2,
      fillKind: 'floor',
      brushSize: 1,
      lastPaintKey: null,
      fromStrokeMove: false,
      strokeDragged: false,
    });
    expect(a.kind).toBe('tiles');
    const b = applyDungeonEditorPaint({
      map,
      tool: 'floor',
      x: 2,
      y: 2,
      fillKind: 'floor',
      brushSize: 1,
      lastPaintKey: 'floor:2,2',
      fromStrokeMove: true,
      strokeDragged: true,
    });
    expect(b.kind).toBe('noop');
  });

  it('does not fill while the stroke is moving', () => {
    const map = wallMap();
    const r = applyDungeonEditorPaint({
      map,
      tool: 'fill',
      x: 0,
      y: 0,
      fillKind: 'floor',
      brushSize: 1,
      lastPaintKey: null,
      fromStrokeMove: true,
      strokeDragged: true,
    });
    expect(r).toEqual({ kind: 'noop' });
  });

  it('toggles a trap on click but not while dragging', () => {
    const map = wallMap();
    map.markers = [{ id: 't', x: 3, y: 3, kind: 'trap' }];
    const skip = applyDungeonEditorPaint({
      map,
      tool: 'trap',
      x: 3,
      y: 3,
      fillKind: 'floor',
      brushSize: 1,
      lastPaintKey: null,
      fromStrokeMove: true,
      strokeDragged: true,
    });
    expect(skip.kind).toBe('noop');
    const toggle = applyDungeonEditorPaint({
      map,
      tool: 'trap',
      x: 3,
      y: 3,
      fillKind: 'floor',
      brushSize: 1,
      lastPaintKey: null,
      fromStrokeMove: false,
      strokeDragged: false,
    });
    expect(toggle.kind).toBe('markers');
    if (toggle.kind === 'markers') expect(toggle.markers.length).toBe(0);
  });

  it('places a new chest marker', () => {
    const map = wallMap();
    const r = applyDungeonEditorPaint({
      map,
      tool: 'chest',
      x: 4,
      y: 4,
      fillKind: 'floor',
      brushSize: 1,
      lastPaintKey: null,
      fromStrokeMove: false,
      strokeDragged: false,
      newId: () => 'mk-new',
    });
    expect(r.kind).toBe('markers');
    if (r.kind === 'markers') {
      expect(r.markers[0].id).toBe('mk-new');
      expect(r.markers[0].kind).toBe('chest');
    }
  });

  it('creates then resizes a room', () => {
    const map = wallMap();
    const created = applyDungeonRoomDefinition(
      map,
      { x: 1, y: 1, width: 3, height: 3 },
      null,
      () => 'r-new',
    );
    expect(created.selectedRoomId).toBe('r-new');
    expect(created.map.rooms[0].label).toBe('Salle 1');
    expect(created.map.tiles[1][1]).toBe('floor');
    const resized = applyDungeonRoomDefinition(
      created.map,
      { x: 1, y: 1, width: 4, height: 4 },
      'r-new',
    );
    expect(resized.map.rooms[0].width).toBe(4);
    expect(resized.message).toContain('Contours');
  });

  it('deletes a room and unlinks markers', () => {
    const map = wallMap();
    map.rooms = [{ id: 'r1', label: 'Salle 1', x: 0, y: 0, width: 2, height: 2 }];
    map.markers = [{ id: 'mk', x: 0, y: 0, kind: 'stairs', linkedRoomId: 'r1' }];
    map.revealedRoomIds = ['r1'];
    const next = applyDungeonRoomDelete(map, 'r1');
    expect(next?.label).toBe('Salle 1');
    expect(next?.map.rooms.length).toBe(0);
    expect(next?.map.markers[0].linkedRoomId).toBeNull();
    expect(next?.map.revealedRoomIds).toEqual([]);
  });

  it('upserts a map handout then publishes', () => {
    const map = wallMap();
    const created = upsertDungeonMapHandout({
      map,
      maps: [map],
      handouts: [],
      body: 'body',
      publish: false,
      nowIso: 't0',
    });
    expect(created.handouts[0].kind).toBe('map');
    expect(created.handouts[0].published).toBeFalse();
    const published = upsertDungeonMapHandout({
      map: { ...map, handoutId: created.handoutId },
      maps: created.maps,
      handouts: created.handouts,
      body: 'body2',
      publish: true,
      nowIso: 't1',
    });
    expect(published.handouts[0].published).toBeTrue();
    expect(published.handouts[0].body).toBe('body2');
  });

  it('fits, converts pointer to tile, and zooms toward cursor', () => {
    const tiny = dungeonEditorFitPanScale({
      viewportW: 4,
      viewportH: 4,
      gridWidth: 32,
      gridHeight: 32,
    });
    expect(tiny).toEqual({ scale: 1, panX: 16, panY: 16 });
    const fit = dungeonEditorFitPanScale({
      viewportW: 400,
      viewportH: 400,
      gridWidth: 32,
      gridHeight: 32,
    });
    expect(fit.scale).toBeGreaterThan(0);
    expect(clientToDungeonTile({
      clientX: 100,
      clientY: 100,
      rectLeft: 0,
      rectTop: 0,
      panX: 0,
      panY: 0,
      scale: 1,
      gridWidth: 8,
      gridHeight: 8,
    })).toEqual({ x: 6, y: 6 });
    expect(dungeonZoomTowardPointer({ mx: 10, my: 10, panX: 0, panY: 0, before: 1, after: 1 })).toBeNull();
    const zoomed = dungeonZoomTowardPointer({
      mx: 10,
      my: 10,
      panX: 0,
      panY: 0,
      before: 1,
      after: 2,
    });
    expect(zoomed).toEqual({ panX: -10, panY: -10 });
    expect(campaignDungeonMemberMapUrl('http://localhost:8081/', 'c1', 'm a')).toBe(
      'http://localhost:8081/campaigns/c1?tab=prep&sub=maps&map=m%20a',
    );
  });

  it('paints a door and reports out-of-bounds', () => {
    const map = wallMap();
    map.tiles[1][1] = 'floor';
    const door = applyDungeonEditorPaint({
      map,
      tool: 'door',
      x: 1,
      y: 1,
      fillKind: 'floor',
      brushSize: 1,
      lastPaintKey: null,
      fromStrokeMove: false,
      strokeDragged: false,
    });
    expect(door.kind).toBe('tiles');
    expect(
      applyDungeonEditorPaint({
        map,
        tool: 'floor',
        x: -1,
        y: 0,
        fillKind: 'floor',
        brushSize: 1,
        lastPaintKey: null,
        fromStrokeMove: false,
        strokeDragged: false,
      }).kind,
    ).toBe('oob');
  });

  it('covers fill / wall no-ops, marker replace, empty stamp name, missing room', () => {
    const map = wallMap();
    map.tiles[0][0] = 'floor';
    const base = {
      fillKind: 'floor' as const,
      brushSize: 1 as const,
      lastPaintKey: null as string | null,
      fromStrokeMove: false,
      strokeDragged: false,
    };
    expect(stampDungeonMapIdentity(map, '   ', 't', () => 'x').name).toBe('Edit');
    expect(applyDungeonRoomDelete(map, 'missing')).toBeNull();
    expect(
      applyDungeonEditorPaint({ ...base, map, tool: 'fill', x: 3, y: 3 }).kind,
    ).toBe('tiles');
    expect(
      applyDungeonEditorPaint({
        ...base,
        map,
        tool: 'fill',
        x: 3,
        y: 3,
        lastPaintKey: 'fill:3,3:floor',
      }).kind,
    ).toBe('noop');
    map.tiles[0][0] = 'floor';
    expect(
      applyDungeonEditorPaint({
        ...base,
        map,
        tool: 'fill',
        x: 0,
        y: 0,
        fillKind: 'floor',
      }).kind,
    ).toBe('noop');
    expect(
      applyDungeonEditorPaint({ ...base, map, tool: 'floor', x: 0, y: 0 }).kind,
    ).toBe('noop');
    map.tiles[2][2] = 'door';
    expect(
      applyDungeonEditorPaint({ ...base, map, tool: 'door', x: 2, y: 2 }).kind,
    ).toBe('noop');
    map.markers = [{ id: 'c', x: 5, y: 5, kind: 'chest' }];
    const swapped = applyDungeonEditorPaint({ ...base, map, tool: 'stairs', x: 5, y: 5 });
    expect(swapped.kind).toBe('markers');
    if (swapped.kind === 'markers') expect(swapped.markers[0].kind).toBe('stairs');
    expect(applyDungeonEditorPaint({ ...base, map, tool: 'room', x: 1, y: 1 }).kind).toBe('noop');
    expect(
      clientToDungeonTile({
        clientX: 0,
        clientY: 0,
        rectLeft: 0,
        rectTop: 0,
        panX: 0,
        panY: 0,
        scale: 1,
        gridWidth: 8,
        gridHeight: 8,
      }),
    ).toBeNull();
    const placed = applyDungeonEditorPaint({ ...base, map: wallMap(), tool: 'trap', x: 7, y: 7 });
    expect(placed.kind).toBe('markers');
  });
});
