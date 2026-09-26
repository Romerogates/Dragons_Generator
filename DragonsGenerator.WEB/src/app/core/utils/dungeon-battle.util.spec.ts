import {
  clampTokenToFloor,
  combatantsToTokens,
  findCombatantAtTile,
  pixelToTile,
} from './dungeon-battle.util';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import type { Combatant } from '@core/models/Campaign/campaign';
import {
  withAllRoomsRevealed,
  withFogToggled,
  withNoRoomsRevealed,
  withRoomRevealed,
  isRoomRevealedOnMap,
} from './dungeon-fog.util';

function floorMap(): CampaignDungeonMap {
  return {
    id: 'm1',
    name: 'Test',
    theme: 'generic',
    gridWidth: 4,
    gridHeight: 3,
    tiles: [
      ['wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'floor', 'wall'],
      ['wall', 'wall', 'wall', 'wall'],
    ],
    rooms: [{ id: 'r1', label: '1', x: 1, y: 1, width: 2, height: 1 }],
    markers: [],
    createdAt: '',
    updatedAt: '',
  };
}

describe('dungeon-battle.util', () => {
  it('pixelToTile accounts for edge pad', () => {
    expect(pixelToTile(24, 12, 12, 0)).toEqual({ x: 2, y: 1 });
    expect(pixelToTile(24, 12, 12, 1)).toEqual({ x: 1, y: 0 });
  });

  it('clampTokenToFloor accepts floor and rejects wall', () => {
    const map = floorMap();
    expect(clampTokenToFloor(map, 1, 1)).toEqual({ x: 1, y: 1 });
    expect(clampTokenToFloor(map, 0, 0)).toBeNull();
    expect(clampTokenToFloor(map, 9, 9)).toBeNull();
  });

  it('combatantsToTokens skips defeated and unplaced', () => {
    const combatants: Combatant[] = [
      { id: 'a', name: 'A', kind: 'player', initiativeBonus: 0, mapX: 1, mapY: 1 },
      { id: 'b', name: 'B', kind: 'monster', initiativeBonus: 0, mapX: 2, mapY: 1, defeated: true },
      { id: 'c', name: 'C', kind: 'npc', initiativeBonus: 0 },
    ];
    const tokens = combatantsToTokens(combatants, { currentId: 'a', selectedId: 'a' });
    expect(tokens.length).toBe(1);
    expect(tokens[0]).toEqual(
      jasmine.objectContaining({ id: 'a', isCurrent: true, isSelected: true }),
    );
  });

  it('findCombatantAtTile returns the occupant', () => {
    const combatants: Combatant[] = [
      { id: 'a', name: 'A', kind: 'player', initiativeBonus: 0, mapX: 1, mapY: 1 },
    ];
    expect(findCombatantAtTile(combatants, 1, 1)?.id).toBe('a');
    expect(findCombatantAtTile(combatants, 2, 1)).toBeNull();
  });
});

describe('dungeon-fog.util', () => {
  it('toggles reveal and fog flags', () => {
    const map = { ...floorMap(), fogOfWarEnabled: true, revealedRoomIds: [] as string[] };
    expect(isRoomRevealedOnMap(map, 'r1')).toBeFalse();
    expect(withRoomRevealed(map, 'r1', true).revealedRoomIds).toEqual(['r1']);
    expect(withAllRoomsRevealed(map).revealedRoomIds).toEqual(['r1']);
    expect(withNoRoomsRevealed().revealedRoomIds).toEqual([]);
    expect(withFogToggled(map).fogOfWarEnabled).toBeFalse();
  });
});
