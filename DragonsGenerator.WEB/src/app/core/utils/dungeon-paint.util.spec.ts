import { floodFillTiles, gridLine, paintBrushDisk, setTileAt } from './dungeon-paint.util';
import type { DungeonTileKind } from '@core/models/Campaign/dungeon-map';

describe('dungeon-paint.util', () => {
  describe('gridLine', () => {
    it('includes both endpoints on a horizontal stroke', () => {
      expect(gridLine(1, 2, 4, 2)).toEqual([
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ]);
    });

    it('covers a diagonal without gaps', () => {
      const pts = gridLine(0, 0, 2, 2);
      expect(pts[0]).toEqual({ x: 0, y: 0 });
      expect(pts[pts.length - 1]).toEqual({ x: 2, y: 2 });
      expect(pts.length).toBeGreaterThanOrEqual(3);
    });

    it('returns a single point when start equals end', () => {
      expect(gridLine(3, 5, 3, 5)).toEqual([{ x: 3, y: 5 }]);
    });
  });

  describe('setTileAt', () => {
    it('clones only the touched row', () => {
      const tiles: DungeonTileKind[][] = [
        ['wall', 'wall', 'wall'],
        ['floor', 'floor', 'floor'],
        ['wall', 'door', 'wall'],
      ];
      const next = setTileAt(tiles, 1, 1, 'wall');
      expect(next).not.toBe(tiles);
      expect(next[0]).toBe(tiles[0]);
      expect(next[2]).toBe(tiles[2]);
      expect(next[1]).not.toBe(tiles[1]);
      expect(next[1][1]).toBe('wall');
      expect(tiles[1][1]).toBe('floor');
    });

    it('returns same reference when cell already has the kind', () => {
      const tiles: DungeonTileKind[][] = [['floor', 'wall']];
      expect(setTileAt(tiles, 0, 0, 'floor')).toBe(tiles);
    });
  });

  describe('floodFillTiles', () => {
    it('fills a closed floor pocket with walls', () => {
      const tiles: DungeonTileKind[][] = [
        ['wall', 'wall', 'wall', 'wall'],
        ['wall', 'floor', 'floor', 'wall'],
        ['wall', 'floor', 'floor', 'wall'],
        ['wall', 'wall', 'wall', 'wall'],
      ];
      const next = floodFillTiles(tiles, 1, 1, 'wall');
      expect(next[1][1]).toBe('wall');
      expect(next[1][2]).toBe('wall');
      expect(next[2][1]).toBe('wall');
      expect(next[2][2]).toBe('wall');
      expect(next[0][0]).toBe('wall');
      expect(tiles[1][1]).toBe('floor');
    });

    it('does not cross different tile kinds', () => {
      const tiles: DungeonTileKind[][] = [
        ['floor', 'floor', 'wall', 'floor'],
        ['floor', 'floor', 'wall', 'floor'],
      ];
      const next = floodFillTiles(tiles, 0, 0, 'door');
      expect(next[0][0]).toBe('door');
      expect(next[0][1]).toBe('door');
      expect(next[1][0]).toBe('door');
      expect(next[1][1]).toBe('door');
      expect(next[0][2]).toBe('wall');
      expect(next[0][3]).toBe('floor');
    });

    it('returns same reference when target already matches kind', () => {
      const tiles: DungeonTileKind[][] = [['floor', 'wall']];
      expect(floodFillTiles(tiles, 0, 0, 'floor')).toBe(tiles);
    });

    it('no-ops out of bounds', () => {
      const tiles: DungeonTileKind[][] = [['floor']];
      expect(floodFillTiles(tiles, -1, 0, 'wall')).toBe(tiles);
      expect(floodFillTiles(tiles, 0, 2, 'wall')).toBe(tiles);
    });
  });

  describe('paintBrushDisk', () => {
    it('radius 0 paints a single cell', () => {
      const tiles: DungeonTileKind[][] = [
        ['wall', 'wall', 'wall'],
        ['wall', 'wall', 'wall'],
        ['wall', 'wall', 'wall'],
      ];
      const next = paintBrushDisk(tiles, 1, 1, 0, 'floor');
      expect(next[1][1]).toBe('floor');
      expect(next[0][1]).toBe('wall');
      expect(next[1][0]).toBe('wall');
    });

    it('radius 1 paints a diamond/disk around the center', () => {
      const tiles: DungeonTileKind[][] = Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => 'wall' as DungeonTileKind),
      );
      const next = paintBrushDisk(tiles, 2, 2, 1, 'floor');
      expect(next[2][2]).toBe('floor');
      expect(next[1][2]).toBe('floor');
      expect(next[2][1]).toBe('floor');
      expect(next[3][2]).toBe('floor');
      expect(next[2][3]).toBe('floor');
      expect(next[0][0]).toBe('wall');
      expect(next[1][1]).toBe('wall');
    });

    it('clips to grid edges', () => {
      const tiles: DungeonTileKind[][] = [
        ['wall', 'wall'],
        ['wall', 'wall'],
      ];
      const next = paintBrushDisk(tiles, 0, 0, 1, 'floor');
      expect(next[0][0]).toBe('floor');
      expect(next[0][1]).toBe('floor');
      expect(next[1][0]).toBe('floor');
    });
  });
});
