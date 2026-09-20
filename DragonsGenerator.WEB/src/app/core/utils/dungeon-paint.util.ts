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
  if (!row || x < 0 || x >= row.length || row[x] === kind) return tiles;
  const next = tiles.slice();
  const nextRow = row.slice();
  nextRow[x] = kind;
  next[y] = nextRow;
  return next;
}

/**
 * Remplit la composante 4-connexe de (x,y) avec `kind`.
 * No-op si hors grille ou si la case a déjà `kind`.
 */
export function floodFillTiles(
  tiles: DungeonTileKind[][],
  x: number,
  y: number,
  kind: DungeonTileKind,
): DungeonTileKind[][] {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  if (h === 0 || w === 0 || x < 0 || y < 0 || x >= w || y >= h) return tiles;
  const target = tiles[y][x];
  if (target === kind) return tiles;

  const next = tiles.map((row) => row.slice());
  const queue: number[] = [x, y];
  next[y][x] = kind;

  while (queue.length) {
    const cy = queue.pop()!;
    const cx = queue.pop()!;
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (ny < 0 || nx < 0 || ny >= h || nx >= w) continue;
      if (next[ny][nx] !== target) continue;
      next[ny][nx] = kind;
      queue.push(nx, ny);
    }
  }
  return next;
}

/**
 * Peint un disque de cases (rayon 0 = 1 case, 1 ≈ 3×3, 2 ≈ 5×5).
 * Réutilise `setTileAt` pour cloner seulement les lignes touchées.
 */
export function paintBrushDisk(
  tiles: DungeonTileKind[][],
  cx: number,
  cy: number,
  radius: number,
  kind: DungeonTileKind,
): DungeonTileKind[][] {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return setTileAt(tiles, cx, cy, kind);

  let next = tiles;
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        next = setTileAt(next, x, y, kind);
      }
    }
  }
  return next;
}
