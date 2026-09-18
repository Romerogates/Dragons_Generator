import type { DungeonTileKind } from '@core/models/Campaign/dungeon-map';

/** Cases d’une ligne grille (Bresenham), extrémités incluses. */
export function gridLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  for (;;) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

/** Clone uniquement la ligne touchée (évite un deep-clone 48×48 à chaque case). */
export function setTileAt(
  tiles: DungeonTileKind[][],
  x: number,
  y: number,
  kind: DungeonTileKind,
): DungeonTileKind[][] {
  const row = tiles[y];
  if (!row || row[x] === kind) return tiles;
  const next = tiles.slice();
  const nextRow = row.slice();
  nextRow[x] = kind;
  next[y] = nextRow;
  return next;
}
