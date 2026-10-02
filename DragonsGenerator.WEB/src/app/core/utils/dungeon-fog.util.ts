import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';

export function corridorCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function isRoomRevealedOnMap(map: CampaignDungeonMap, roomId: string): boolean {
  if (!map.fogOfWarEnabled) return true;
  return (map.revealedRoomIds ?? []).includes(roomId);
}

export function isCorridorCellRevealedOnMap(map: CampaignDungeonMap, x: number, y: number): boolean {
  if (!map.fogOfWarEnabled) return true;
  return (map.revealedCorridorCells ?? []).includes(corridorCellKey(x, y));
}

export function withRoomRevealed(
  map: CampaignDungeonMap,
  roomId: string,
  revealed: boolean,
): Pick<CampaignDungeonMap, 'revealedRoomIds'> {
  const current = new Set(map.revealedRoomIds ?? []);
  if (revealed) current.add(roomId);
  else current.delete(roomId);
  return { revealedRoomIds: [...current] };
}

export function withCorridorCellRevealed(
  map: CampaignDungeonMap,
  x: number,
  y: number,
  revealed: boolean,
): Pick<CampaignDungeonMap, 'revealedCorridorCells'> {
  const key = corridorCellKey(x, y);
  const current = new Set(map.revealedCorridorCells ?? []);
  if (revealed) current.add(key);
  else current.delete(key);
  return { revealedCorridorCells: [...current] };
}

export function withAllRoomsRevealed(
  map: CampaignDungeonMap,
): Pick<CampaignDungeonMap, 'revealedRoomIds'> {
  return { revealedRoomIds: (map.rooms ?? []).map((r) => r.id) };
}

export function withNoRoomsRevealed(): Pick<
  CampaignDungeonMap,
  'revealedRoomIds' | 'revealedCorridorCells'
> {
  return { revealedRoomIds: [], revealedCorridorCells: [] };
}

export function withFogToggled(
  map: CampaignDungeonMap,
): Pick<CampaignDungeonMap, 'fogOfWarEnabled' | 'revealedRoomIds' | 'revealedCorridorCells'> {
  const enabled = !map.fogOfWarEnabled;
  return {
    fogOfWarEnabled: enabled,
    revealedRoomIds: enabled ? (map.revealedRoomIds ?? []) : [],
    revealedCorridorCells: enabled ? (map.revealedCorridorCells ?? []) : [],
  };
}
