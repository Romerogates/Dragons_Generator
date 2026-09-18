import { gridLine, setTileAt } from './dungeon-paint.util';
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
});
