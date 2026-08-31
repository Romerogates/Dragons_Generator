import type {
  CampaignDungeonMap,
  DungeonGenParams,
  DungeonMarker,
  DungeonRoom,
  DungeonTileKind,
} from '@core/models/Campaign/dungeon-map';
import { rollRandomEncounter } from './dungeon-theme-pools';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function overlaps(a: Rect, b: Rect, pad: number): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function createWallGrid(w: number, h: number): DungeonTileKind[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => 'wall'));
}

function carveRect(tiles: DungeonTileKind[][], rect: Rect): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (tiles[y]?.[x] !== undefined) tiles[y][x] = 'floor';
    }
  }
}

function carveLine(
  tiles: DungeonTileKind[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
): void {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  if (x1 === x2) {
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      for (let dx = 0; dx < width; dx++) {
        const x = x1 + dx - Math.floor(width / 2);
        if (x >= 0 && x < w && y >= 0 && y < h) tiles[y][x] = tiles[y][x] === 'wall' ? 'floor' : tiles[y][x];
      }
    }
    return;
  }
  if (y1 === y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      for (let dy = 0; dy < width; dy++) {
        const y = y1 + dy - Math.floor(width / 2);
        if (x >= 0 && x < w && y >= 0 && y < h) tiles[y][x] = tiles[y][x] === 'wall' ? 'floor' : tiles[y][x];
      }
    }
    return;
  }
  carveLine(tiles, x1, y1, x2, y1, width);
  carveLine(tiles, x2, y1, x2, y2, width);
}

function center(rect: Rect): { x: number; y: number } {
  return { x: Math.floor(rect.x + rect.w / 2), y: Math.floor(rect.y + rect.h / 2) };
}

function placeDoors(tiles: DungeonTileKind[][], rooms: Rect[]): DungeonMarker[] {
  const markers: DungeonMarker[] = [];
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;

  for (const room of rooms) {
    const candidates: { x: number; y: number }[] = [];
    for (let x = room.x; x < room.x + room.w; x++) {
      for (const y of [room.y - 1, room.y + room.h]) {
        if (y >= 0 && y < h && x >= 0 && x < w && tiles[y][x] === 'floor') {
          candidates.push({ x, y });
        }
      }
    }
    for (let y = room.y; y < room.y + room.h; y++) {
      for (const x of [room.x - 1, room.x + room.w]) {
        if (y >= 0 && y < h && x >= 0 && x < w && tiles[y][x] === 'floor') {
          candidates.push({ x, y });
        }
      }
    }
    if (!candidates.length) continue;
    const door = candidates[randInt(0, candidates.length - 1)];
    if (tiles[door.y][door.x] === 'floor') {
      tiles[door.y][door.x] = 'door';
      markers.push({
        id: crypto.randomUUID?.() ?? `mk-${Date.now()}-${door.x}-${door.y}`,
        x: door.x,
        y: door.y,
        kind: 'door',
        label: 'Porte',
      });
    }
  }
  return markers;
}

function connectRooms(tiles: DungeonTileKind[][], rects: Rect[], corridorDensity: number): void {
  if (rects.length < 2) return;
  const corridorWidth = corridorDensity >= 70 ? 2 : 1;
  for (let i = 1; i < rects.length; i++) {
    const a = center(rects[i - 1]);
    const b = center(rects[i]);
    carveLine(tiles, a.x, a.y, b.x, b.y, corridorWidth);
  }
  if (corridorDensity >= 50 && rects.length > 3) {
    const extra = Math.floor((corridorDensity / 100) * (rects.length - 2));
    for (let i = 0; i < extra; i++) {
      const a = rects[randInt(0, rects.length - 1)];
      const b = rects[randInt(0, rects.length - 1)];
      if (a === b) continue;
      const ca = center(a);
      const cb = center(b);
      carveLine(tiles, ca.x, ca.y, cb.x, cb.y, 1);
    }
  }
}

export function generateDungeonMap(
  params: DungeonGenParams,
  meta: { name: string; regionId?: string | null; regionName?: string },
): CampaignDungeonMap {
  const { gridWidth, gridHeight, roomCount, corridorDensity, theme } = params;
  const tiles = createWallGrid(gridWidth, gridHeight);
  const maxRoomW = Math.max(5, Math.floor(gridWidth / 5));
  const maxRoomH = Math.max(5, Math.floor(gridHeight / 5));
  const targetRooms = Math.max(3, Math.min(roomCount, 24));
  const rects: Rect[] = [];
  let attempts = 0;

  while (rects.length < targetRooms && attempts < targetRooms * 60) {
    attempts++;
    const w = randInt(4, maxRoomW);
    const h = randInt(4, maxRoomH);
    const x = randInt(1, gridWidth - w - 2);
    const y = randInt(1, gridHeight - h - 2);
    const rect = { x, y, w, h };
    if (rects.every((r) => !overlaps(r, rect, 2))) {
      rects.push(rect);
      carveRect(tiles, rect);
    }
  }

  connectRooms(tiles, rects, corridorDensity);
  const doorMarkers = placeDoors(tiles, rects);

  const rooms: DungeonRoom[] = rects.map((rect, index) => {
    const isBoss = index === rects.length - 1 && rects.length > 2;
    return {
      id: crypto.randomUUID?.() ?? `room-${index}-${Date.now()}`,
      label: `Salle ${index + 1}`,
      x: rect.x,
      y: rect.y,
      width: rect.w,
      height: rect.h,
      encounterId: null,
      randomEncounter: rollRandomEncounter(theme, isBoss),
      notes: '',
    };
  });

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID?.() ?? `map-${Date.now()}`,
    name: meta.name,
    theme,
    regionId: meta.regionId ?? null,
    regionName: meta.regionName ?? '',
    gridWidth,
    gridHeight,
    tiles,
    rooms,
    markers: doorMarkers,
    handoutId: null,
    createdAt: now,
    updatedAt: now,
  };
}
