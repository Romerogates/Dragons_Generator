import type { DungeonRoom, DungeonTileKind } from '@core/models/Campaign/dungeon-map';
import { setTileAt } from './dungeon-paint.util';

export interface GridRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeGridRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gridWidth: number,
  gridHeight: number,
): GridRect {
  const xa = Math.max(0, Math.min(x0, x1, gridWidth - 1));
  const xb = Math.max(0, Math.min(Math.max(x0, x1), gridWidth - 1));
  const ya = Math.max(0, Math.min(y0, y1, gridHeight - 1));
  const yb = Math.max(0, Math.min(Math.max(y0, y1), gridHeight - 1));
  return {
    x: xa,
    y: ya,
    width: Math.max(1, xb - xa + 1),
    height: Math.max(1, yb - ya + 1),
  };
}

/** Prochain label « Salle N » basé sur les numéros déjà présents. */
export function nextRoomLabel(rooms: Pick<DungeonRoom, 'label'>[]): string {
  let max = 0;
  for (const room of rooms) {
    const m = /^Salle\s+(\d+)\s*$/i.exec(room.label.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `Salle ${max + 1}`;
}

function rectArea(r: GridRect): number {
  return Math.max(0, r.width) * Math.max(0, r.height);
}

function overlapArea(a: GridRect, b: GridRect): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

/**
 * Salle à redimensionner : priorité à `preferredId`, sinon chevauchement > 50 %
 * de l’aire de la salle ou du rectangle tracé.
 */
export function findRoomToResize(
  rooms: DungeonRoom[],
  rect: GridRect,
  preferredId: string | null,
): DungeonRoom | null {
  if (preferredId) {
    const preferred = rooms.find((r) => r.id === preferredId);
    if (preferred) return preferred;
  }

  const rectA = rectArea(rect);
  let best: DungeonRoom | null = null;
  let bestOverlap = 0;

  for (const room of rooms) {
    const roomRect: GridRect = {
      x: room.x,
      y: room.y,
      width: room.width,
      height: room.height,
    };
    const ov = overlapArea(rect, roomRect);
    if (ov <= 0) continue;
    const roomA = rectArea(roomRect);
    const ratio = ov / Math.min(rectA, roomA);
    if (ratio > 0.5 && ov > bestOverlap) {
      best = room;
      bestOverlap = ov;
    }
  }
  return best;
}

/** Remplit le rectangle en sol (murs hors rect inchangés). */
export function fillRectFloor(
  tiles: DungeonTileKind[][],
  rect: GridRect,
): DungeonTileKind[][] {
  let next = tiles;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      next = setTileAt(next, x, y, 'floor');
    }
  }
  return next;
}
