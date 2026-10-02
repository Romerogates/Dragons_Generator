import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import {
  corridorCellKey,
  isCorridorCellRevealedOnMap,
  isRoomRevealedOnMap,
  withAllRoomsRevealed,
  withCorridorCellRevealed,
  withFogToggled,
  withNoRoomsRevealed,
  withRoomRevealed,
} from './dungeon-fog.util';

function map(partial: Partial<CampaignDungeonMap>): CampaignDungeonMap {
  return {
    id: 'm1',
    name: 'Test',
    theme: 'crypt',
    gridWidth: 8,
    gridHeight: 8,
    tiles: [],
    rooms: [
      { id: 'r1', label: 'A', x: 1, y: 1, width: 2, height: 2 },
      { id: 'r2', label: 'B', x: 4, y: 4, width: 2, height: 2 },
    ],
    markers: [],
    fogOfWarEnabled: true,
    revealedRoomIds: [],
    ...partial,
  } as CampaignDungeonMap;
}

describe('dungeon-fog.util', () => {
  it('corridorCellKey formats x,y', () => {
    expect(corridorCellKey(3, 7)).toBe('3,7');
  });

  it('isRoomRevealedOnMap respects fog off and revealed list', () => {
    expect(isRoomRevealedOnMap(map({ fogOfWarEnabled: false }), 'r1')).toBeTrue();
    expect(isRoomRevealedOnMap(map({ revealedRoomIds: ['r1'] }), 'r1')).toBeTrue();
    expect(isRoomRevealedOnMap(map({ revealedRoomIds: [] }), 'r1')).toBeFalse();
    expect(isRoomRevealedOnMap(map({ revealedRoomIds: undefined }), 'r1')).toBeFalse();
  });

  it('isCorridorCellRevealedOnMap respects fog and cell list', () => {
    expect(isCorridorCellRevealedOnMap(map({ fogOfWarEnabled: false }), 1, 2)).toBeTrue();
    expect(
      isCorridorCellRevealedOnMap(map({ revealedCorridorCells: ['1,2'] }), 1, 2),
    ).toBeTrue();
    expect(isCorridorCellRevealedOnMap(map({ revealedCorridorCells: [] }), 1, 2)).toBeFalse();
    expect(
      isCorridorCellRevealedOnMap(map({ revealedCorridorCells: undefined }), 9, 9),
    ).toBeFalse();
  });

  it('withRoomRevealed adds and removes', () => {
    const add = withRoomRevealed(map({ revealedRoomIds: ['r1'] }), 'r2', true);
    expect(add.revealedRoomIds).toEqual(jasmine.arrayContaining(['r1', 'r2']));
    const rem = withRoomRevealed(map({ revealedRoomIds: ['r1', 'r2'] }), 'r1', false);
    expect(rem.revealedRoomIds).toEqual(['r2']);
    const fromUndef = withRoomRevealed(map({ revealedRoomIds: undefined }), 'r1', true);
    expect(fromUndef.revealedRoomIds).toEqual(['r1']);
  });

  it('withCorridorCellRevealed adds and removes', () => {
    const add = withCorridorCellRevealed(map({ revealedCorridorCells: ['0,0'] }), 1, 1, true);
    expect(add.revealedCorridorCells).toEqual(jasmine.arrayContaining(['0,0', '1,1']));
    const rem = withCorridorCellRevealed(
      map({ revealedCorridorCells: ['1,1', '2,2'] }),
      1,
      1,
      false,
    );
    expect(rem.revealedCorridorCells).toEqual(['2,2']);
    const fromUndef = withCorridorCellRevealed(
      map({ revealedCorridorCells: undefined }),
      5,
      5,
      true,
    );
    expect(fromUndef.revealedCorridorCells).toEqual(['5,5']);
  });

  it('withAllRoomsRevealed / withNoRoomsRevealed', () => {
    expect(withAllRoomsRevealed(map({})).revealedRoomIds).toEqual(['r1', 'r2']);
    expect(withAllRoomsRevealed(map({ rooms: undefined as never })).revealedRoomIds).toEqual([]);
    const cleared = withNoRoomsRevealed();
    expect(cleared.revealedRoomIds).toEqual([]);
    expect(cleared.revealedCorridorCells).toEqual([]);
  });

  it('withFogToggled enables and clears when disabling', () => {
    const on = withFogToggled(
      map({
        fogOfWarEnabled: false,
        revealedRoomIds: ['r1'],
        revealedCorridorCells: ['1,1'],
      }),
    );
    expect(on.fogOfWarEnabled).toBeTrue();
    expect(on.revealedRoomIds).toEqual(['r1']);
    expect(on.revealedCorridorCells).toEqual(['1,1']);

    const off = withFogToggled(
      map({
        fogOfWarEnabled: true,
        revealedRoomIds: ['r1'],
        revealedCorridorCells: ['1,1'],
      }),
    );
    expect(off.fogOfWarEnabled).toBeFalse();
    expect(off.revealedRoomIds).toEqual([]);
    expect(off.revealedCorridorCells).toEqual([]);

    const undef = withFogToggled(
      map({
        fogOfWarEnabled: false,
        revealedRoomIds: undefined,
        revealedCorridorCells: undefined,
      }),
    );
    expect(undef.fogOfWarEnabled).toBeTrue();
    expect(undef.revealedRoomIds).toEqual([]);
    expect(undef.revealedCorridorCells).toEqual([]);
  });
});
