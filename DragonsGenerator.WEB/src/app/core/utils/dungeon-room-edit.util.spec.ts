import {
  fillRectFloor,
  findRoomToResize,
  nextRoomLabel,
  normalizeGridRect,
  type GridRect,
} from './dungeon-room-edit.util';
import type { DungeonRoom, DungeonTileKind } from '@core/models/Campaign/dungeon-map';

function room(partial: Partial<DungeonRoom> & Pick<DungeonRoom, 'id' | 'x' | 'y' | 'width' | 'height'>): DungeonRoom {
  return {
    label: partial.label ?? 'Salle 1',
    notes: '',
    encounterId: null,
    randomEncounter: null,
    ...partial,
  };
}

describe('dungeon-room-edit.util', () => {
  describe('normalizeGridRect', () => {
    it('normalizes inverted drag and clamps to grid', () => {
      expect(normalizeGridRect(5, 4, 2, 1, 10, 10)).toEqual({
        x: 2,
        y: 1,
        width: 4,
        height: 4,
      });
      expect(normalizeGridRect(-2, -1, 0, 0, 8, 8)).toEqual({
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      });
    });
  });

  describe('nextRoomLabel', () => {
    it('increments from existing Salle N labels', () => {
      expect(nextRoomLabel([])).toBe('Salle 1');
      expect(
        nextRoomLabel([{ label: 'Salle 2' }, { label: 'Boss' }, { label: 'Salle 10' }]),
      ).toBe('Salle 11');
    });
  });

  describe('findRoomToResize', () => {
    const rooms = [
      room({ id: 'a', label: 'Salle 1', x: 0, y: 0, width: 4, height: 4 }),
      room({ id: 'b', label: 'Salle 2', x: 10, y: 10, width: 3, height: 3 }),
    ];

    it('uses preferred room only when the rect overlaps it', () => {
      const onB: GridRect = { x: 10, y: 10, width: 2, height: 2 };
      expect(findRoomToResize(rooms, onB, 'a')?.id).toBe('b');
      const onA: GridRect = { x: 0, y: 0, width: 2, height: 2 };
      expect(findRoomToResize(rooms, onA, 'a')?.id).toBe('a');
    });

    it('picks a majority-overlapping room when none preferred', () => {
      const rect: GridRect = { x: 10, y: 10, width: 3, height: 3 };
      expect(findRoomToResize(rooms, rect, null)?.id).toBe('b');
    });

    it('returns null without enough overlap (new room)', () => {
      const rect: GridRect = { x: 20, y: 20, width: 2, height: 2 };
      expect(findRoomToResize(rooms, rect, 'a')).toBeNull();
      expect(findRoomToResize(rooms, rect, null)).toBeNull();
    });
  });

  describe('fillRectFloor', () => {
    it('sets floor inside the rect only', () => {
      const tiles: DungeonTileKind[][] = [
        ['wall', 'wall', 'wall'],
        ['wall', 'wall', 'wall'],
        ['wall', 'wall', 'wall'],
      ];
      const next = fillRectFloor(tiles, { x: 1, y: 1, width: 1, height: 1 });
      expect(next[1][1]).toBe('floor');
      expect(next[0][0]).toBe('wall');
      expect(tiles[1][1]).toBe('wall');
    });
  });
});
