/** Mutations éditeur donjon (peinture, salles, handout, viewport) — hors Atlas. */

import {
  createCampaignHandout,
  type CampaignHandout,
} from '@core/models/Campaign/campaign';
import {
  DUNGEON_MARKER_LABELS,
  type CampaignDungeonMap,
  type DungeonMarkerKind,
  type DungeonTileKind,
} from '@core/models/Campaign/dungeon-map';
import { floodFillTiles, paintBrushDisk, setTileAt } from './dungeon-paint.util';
import { dungeonDrawOrigin, roomAt } from './dungeon-render.util';
import {
  fillRectFloor,
  findRoomToResize,
  nextRoomLabel,
  type GridRect,
} from './dungeon-room-edit.util';
import {
  DUNGEON_EDITOR_CELL,
  DUNGEON_EDITOR_EDGE_PAD,
  DUNGEON_EDITOR_FIT_MAX_SCALE,
  DUNGEON_EDITOR_MAX_SCALE,
  DUNGEON_EDITOR_MIN_SCALE,
  type DungeonEditorTool,
} from './dungeon-editor-ui.util';

export function newDungeonEntityId(prefix: string): string {
  return crypto.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function stampDungeonMapIdentity(
  map: CampaignDungeonMap,
  name: string,
  nowIso: string,
  newId: () => string = () => newDungeonEntityId('map'),
): CampaignDungeonMap {
  return {
    ...map,
    name: name.trim() || map.name,
    id: newId(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function mergeRegeneratedDungeonMap(
  current: CampaignDungeonMap,
  next: CampaignDungeonMap,
  nowIso: string,
): CampaignDungeonMap {
  return {
    ...next,
    id: current.id,
    name: current.name,
    handoutId: current.handoutId,
    createdAt: current.createdAt,
    updatedAt: nowIso,
  };
}

export type DungeonEditorPaintResult =
  | { kind: 'oob' }
  | { kind: 'select'; roomId: string | null; markerId: string | null }
  | { kind: 'noop'; paintKey?: string }
  | { kind: 'tiles'; tiles: DungeonTileKind[][]; paintKey: string }
  | { kind: 'markers'; markers: CampaignDungeonMap['markers']; paintKey: string };

export function applyDungeonEditorPaint(opts: {
  map: CampaignDungeonMap;
  tool: DungeonEditorTool;
  x: number;
  y: number;
  fillKind: 'floor' | 'wall';
  brushSize: 1 | 2 | 3;
  lastPaintKey: string | null;
  fromStrokeMove: boolean;
  strokeDragged: boolean;
  newId?: () => string;
}): DungeonEditorPaintResult {
  const { map, tool, x, y } = opts;
  if (x < 0 || y < 0 || x >= map.gridWidth || y >= map.gridHeight) return { kind: 'oob' };

  if (tool === 'select') {
    const rid = roomAt(map, x, y);
    const marker = map.markers.find((m) => m.x === x && m.y === y);
    return { kind: 'select', roomId: rid, markerId: marker?.id ?? null };
  }

  if (tool === 'fill') {
    if (opts.fromStrokeMove) return { kind: 'noop' };
    const paintKey = `fill:${x},${y}:${opts.fillKind}`;
    if (opts.lastPaintKey === paintKey) return { kind: 'noop', paintKey };
    const tiles = floodFillTiles(map.tiles, x, y, opts.fillKind);
    if (tiles === map.tiles) return { kind: 'noop', paintKey };
    return { kind: 'tiles', tiles, paintKey };
  }

  const paintKey = `${tool}:${x},${y}`;
  if (opts.lastPaintKey === paintKey) return { kind: 'noop', paintKey };

  if (tool === 'floor' || tool === 'wall') {
    const tiles = paintBrushDisk(map.tiles, x, y, opts.brushSize - 1, tool);
    if (tiles === map.tiles) return { kind: 'noop', paintKey };
    return { kind: 'tiles', tiles, paintKey };
  }

  if (tool === 'door') {
    if (map.tiles[y]?.[x] === tool) return { kind: 'noop', paintKey };
    const tiles = setTileAt(map.tiles, x, y, tool);
    if (tiles === map.tiles) return { kind: 'noop', paintKey };
    return { kind: 'tiles', tiles, paintKey };
  }

  const markerKind = tool as DungeonMarkerKind;
  if (markerKind !== 'trap' && markerKind !== 'chest' && markerKind !== 'stairs') {
    return { kind: 'noop', paintKey };
  }

  const markers = [...map.markers];
  const existing = markers.findIndex((m) => m.x === x && m.y === y);
  if (existing >= 0) {
    if (markers[existing].kind === markerKind) {
      if (opts.fromStrokeMove || opts.strokeDragged) return { kind: 'noop', paintKey };
      markers.splice(existing, 1);
    } else {
      markers[existing] = {
        ...markers[existing],
        kind: markerKind,
        label: DUNGEON_MARKER_LABELS[markerKind],
      };
    }
  } else {
    markers.push({
      id: (opts.newId ?? (() => newDungeonEntityId('mk')))(),
      x,
      y,
      kind: markerKind,
      label: DUNGEON_MARKER_LABELS[markerKind],
      linkedRoomId: roomAt(map, x, y),
    });
  }
  return { kind: 'markers', markers, paintKey };
}

export function applyDungeonRoomDefinition(
  map: CampaignDungeonMap,
  rect: GridRect,
  selectedRoomId: string | null,
  newId: () => string = () => newDungeonEntityId('room'),
): { map: CampaignDungeonMap; selectedRoomId: string; message: string } {
  const target = findRoomToResize(map.rooms, rect, selectedRoomId);
  const tiles = fillRectFloor(map.tiles, rect);
  if (target) {
    const rooms = map.rooms.map((r) =>
      r.id === target.id
        ? { ...r, x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : r,
    );
    return {
      map: { ...map, tiles, rooms },
      selectedRoomId: target.id,
      message: `Contours de « ${target.label} » mis à jour.`,
    };
  }
  const label = nextRoomLabel(map.rooms);
  const id = newId();
  const room = {
    id,
    label,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    encounterId: null,
    randomEncounter: null,
    notes: '',
  };
  return {
    map: { ...map, tiles, rooms: [...map.rooms, room] },
    selectedRoomId: id,
    message: `« ${label} » créée.`,
  };
}

export function applyDungeonRoomDelete(
  map: CampaignDungeonMap,
  roomId: string,
): { map: CampaignDungeonMap; label: string } | null {
  const room = map.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const rooms = map.rooms.filter((r) => r.id !== roomId);
  const markers = map.markers.map((m) =>
    m.linkedRoomId === roomId ? { ...m, linkedRoomId: null } : m,
  );
  const revealedRoomIds = (map.revealedRoomIds ?? []).filter((id) => id !== roomId);
  return {
    map: { ...map, rooms, markers, revealedRoomIds },
    label: room.label,
  };
}

export function upsertDungeonMapHandout(opts: {
  map: CampaignDungeonMap;
  maps: CampaignDungeonMap[];
  handouts: CampaignHandout[];
  body: string;
  publish: boolean;
  nowIso: string;
}): { maps: CampaignDungeonMap[]; handouts: CampaignHandout[]; handoutId: string } {
  let handouts = [...opts.handouts];
  let handoutId = opts.map.handoutId ?? null;
  const { map, body, publish, nowIso } = opts;

  if (handoutId) {
    handouts = handouts.map((h) =>
      h.id === handoutId
        ? {
            ...h,
            title: map.name,
            body,
            kind: 'map' as const,
            updatedAt: nowIso,
            ...(publish ? { published: true, publishedAt: h.publishedAt ?? nowIso } : {}),
          }
        : h,
    );
  } else {
    const handout = createCampaignHandout(map.name);
    handout.kind = 'map';
    handout.body = body;
    handout.published = publish;
    if (publish) handout.publishedAt = nowIso;
    handoutId = handout.id;
    handouts.push(handout);
  }

  const maps = opts.maps.map((m) =>
    m.id === map.id ? { ...m, handoutId, updatedAt: nowIso } : m,
  );
  return { maps, handouts, handoutId: handoutId! };
}

export function dungeonEditorFitPanScale(opts: {
  viewportW: number;
  viewportH: number;
  gridWidth: number;
  gridHeight: number;
  cell?: number;
  edgePad?: number;
  minScale?: number;
  maxScale?: number;
  fitMax?: number;
  pad?: number;
}): { scale: number; panX: number; panY: number } {
  const cell = opts.cell ?? DUNGEON_EDITOR_CELL;
  const edgePad = opts.edgePad ?? DUNGEON_EDITOR_EDGE_PAD;
  const minScale = opts.minScale ?? DUNGEON_EDITOR_MIN_SCALE;
  const maxScale = opts.maxScale ?? DUNGEON_EDITOR_MAX_SCALE;
  const fitMax = opts.fitMax ?? DUNGEON_EDITOR_FIT_MAX_SCALE;
  const pad = opts.pad ?? 24;
  if (opts.viewportW < 8 || opts.viewportH < 8) {
    return { scale: 1, panX: 16, panY: 16 };
  }
  const drawW = (opts.gridWidth + edgePad * 2) * cell;
  const drawH = (opts.gridHeight + edgePad * 2) * cell;
  const sx = (opts.viewportW - pad) / drawW;
  const sy = (opts.viewportH - pad) / drawH;
  const next = Math.min(maxScale, Math.max(minScale, Math.min(sx, sy, fitMax)));
  return {
    scale: +next.toFixed(2),
    panX: (opts.viewportW - drawW * next) / 2,
    panY: (opts.viewportH - drawH * next) / 2,
  };
}

export function clientToDungeonTile(opts: {
  clientX: number;
  clientY: number;
  rectLeft: number;
  rectTop: number;
  panX: number;
  panY: number;
  scale: number;
  gridWidth: number;
  gridHeight: number;
  cell?: number;
  edgePad?: number;
}): { x: number; y: number } | null {
  const cell = opts.cell ?? DUNGEON_EDITOR_CELL;
  const edgePad = opts.edgePad ?? DUNGEON_EDITOR_EDGE_PAD;
  const origin = dungeonDrawOrigin(cell, edgePad);
  const localX = (opts.clientX - opts.rectLeft - opts.panX) / opts.scale - origin;
  const localY = (opts.clientY - opts.rectTop - opts.panY) / opts.scale - origin;
  const x = Math.floor(localX / cell);
  const y = Math.floor(localY / cell);
  if (x < 0 || y < 0 || x >= opts.gridWidth || y >= opts.gridHeight) return null;
  return { x, y };
}

export function dungeonZoomTowardPointer(opts: {
  mx: number;
  my: number;
  panX: number;
  panY: number;
  before: number;
  after: number;
}): { panX: number; panY: number } | null {
  if (opts.after === opts.before) return null;
  const worldX = (opts.mx - opts.panX) / opts.before;
  const worldY = (opts.my - opts.panY) / opts.before;
  return {
    panX: opts.mx - worldX * opts.after,
    panY: opts.my - worldY * opts.after,
  };
}

export function campaignDungeonMemberMapUrl(
  origin: string,
  campaignId: string,
  mapId: string,
): string {
  return `${origin.replace(/\/$/, '')}/campaigns/${campaignId}?tab=prep&sub=maps&map=${encodeURIComponent(mapId)}`;
}
