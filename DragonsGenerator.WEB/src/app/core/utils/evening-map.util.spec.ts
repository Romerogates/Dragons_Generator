import {
  applyEveningPawnPatch,
  canControlTableToken,
  eveningPawnId,
  eveningPawnsToTokens,
  findEveningPawnAtTile,
  isEveningTileOccupied,
  listWalkableCells,
  placeEveningPawn,
  seedEveningPawns,
} from './evening-map.util';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import type { CampaignMember, Combatant } from '@core/models/Campaign/campaign';

function floorMap(): CampaignDungeonMap {
  return {
    id: 'm1',
    name: 'Cave',
    theme: 'cave',
    gridWidth: 4,
    gridHeight: 3,
    tiles: [
      ['wall', 'wall', 'wall', 'wall'],
      ['wall', 'floor', 'floor', 'wall'],
      ['wall', 'wall', 'wall', 'wall'],
    ],
    rooms: [],
    markers: [],
    createdAt: '',
    updatedAt: '',
  };
}

function player(userId: string, name: string): CampaignMember {
  return {
    id: `mem-${userId}`,
    userId,
    displayName: name,
    role: 'player',
    proposalStatus: 'approved',
    approvedCharacterId: `ch-${userId}`,
    approvedCharacterName: name,
    xpEarnedInCampaign: 0,
  };
}

describe('evening-map.util', () => {
  it('lists walkable floor cells', () => {
    expect(listWalkableCells(floorMap())).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });

  it('seeds one pawn per approved player on walkable tiles', () => {
    const next = seedEveningPawns({
      map: floorMap(),
      players: [player('u1', 'Aria'), player('u2', 'Borin')],
    });
    expect(next?.map((p) => p.id)).toEqual(['pawn-u1', 'pawn-u2']);
    expect(next?.[0]).toEqual(
      jasmine.objectContaining({
        memberUserId: 'u1',
        mapX: 1,
        mapY: 1,
        name: 'Aria',
      }),
    );
    expect(seedEveningPawns({ map: floorMap(), players: [player('u1', 'Aria')], existing: next })).toBeNull();
  });

  it('reuses combatant position and portrait when seeding', () => {
    const combatants: Combatant[] = [
      {
        id: 'c1',
        name: 'Aria',
        kind: 'player',
        initiativeBonus: 0,
        memberUserId: 'u1',
        mapX: 2,
        mapY: 1,
        tokenImageUrl: 'https://img.example/a.png',
      },
    ];
    const next = seedEveningPawns({
      map: floorMap(),
      players: [player('u1', 'Aria')],
      combatants,
    });
    expect(next?.[0].mapX).toBe(2);
    expect(next?.[0].tokenImageUrl).toBe('https://img.example/a.png');
  });

  it('finds, occupies, places and patches pawns', () => {
    const pawns = seedEveningPawns({
      map: floorMap(),
      players: [player('u1', 'Aria')],
    })!;
    expect(findEveningPawnAtTile(pawns, 1, 1)?.id).toBe(eveningPawnId('u1'));
    expect(isEveningTileOccupied(pawns, 1, 1)).toBeTrue();
    expect(isEveningTileOccupied(pawns, 1, 1, eveningPawnId('u1'))).toBeFalse();
    const moved = placeEveningPawn(pawns, eveningPawnId('u1'), 2, 1);
    expect(moved[0].mapX).toBe(2);
    const patched = applyEveningPawnPatch(moved, eveningPawnId('u1'), { name: 'Aria Prime' });
    expect(patched[0].name).toBe('Aria Prime');
    const tokens = eveningPawnsToTokens(moved, { myId: eveningPawnId('u1'), selectedId: eveningPawnId('u1') });
    expect(tokens[0].isMine).toBeTrue();
    expect(tokens[0].isSelected).toBeTrue();
  });

  it('skips pending players, refreshes existing portraits, and stops without floors', () => {
    const pending: CampaignMember = {
      ...player('u3', 'Wait'),
      proposalStatus: 'pending',
    };
    const existing = seedEveningPawns({
      map: floorMap(),
      players: [player('u1', 'Aria')],
    })!;
    const refreshed = seedEveningPawns({
      map: floorMap(),
      players: [player('u1', 'Aria'), pending],
      existing,
      combatants: [
        {
          id: 'c1',
          name: 'Aria',
          kind: 'player',
          initiativeBonus: 0,
          memberUserId: 'u1',
          tokenImageUrl: 'https://img.example/new.png',
        },
      ],
    });
    expect(refreshed?.length).toBe(1);
    expect(refreshed?.[0].tokenImageUrl).toBe('https://img.example/new.png');

    const wallOnly: CampaignDungeonMap = {
      ...floorMap(),
      tiles: [
        ['wall', 'wall', 'wall', 'wall'],
        ['wall', 'wall', 'wall', 'wall'],
        ['wall', 'wall', 'wall', 'wall'],
      ],
    };
    expect(seedEveningPawns({ map: wallOnly, players: [player('u9', 'NoFloor')] })).toBeNull();
    expect(eveningPawnsToTokens(null)).toEqual([]);
    expect(findEveningPawnAtTile([], 0, 0)).toBeNull();
    expect(isEveningTileOccupied(undefined, 0, 0)).toBeFalse();
  });

  it('autorise le MJ sur tout pion et le joueur sur le sien seulement', () => {
    expect(canControlTableToken({ isDm: true, userId: 'u1', tokenId: 'pawn-u2' })).toBeTrue();
    expect(
      canControlTableToken({ isDm: false, userId: 'u1', tokenId: 'pawn-u1', memberUserId: 'u1' }),
    ).toBeTrue();
    expect(
      canControlTableToken({ isDm: false, userId: 'u1', tokenId: 'pawn-u2', memberUserId: 'u2' }),
    ).toBeFalse();
    expect(canControlTableToken({ isDm: false, isSpectator: true, userId: 'u1', tokenId: 'pawn-u1' })).toBeFalse();
  });
});
