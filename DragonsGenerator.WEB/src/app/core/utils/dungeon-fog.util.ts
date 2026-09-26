import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';

export function isRoomRevealedOnMap(map: CampaignDungeonMap, roomId: string): boolean {
  if (!map.fogOfWarEnabled) return true;
  return (map.revealedRoomIds ?? []).includes(roomId);
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

export function withAllRoomsRevealed(
  map: CampaignDungeonMap,
): Pick<CampaignDungeonMap, 'revealedRoomIds'> {
  return { revealedRoomIds: map.rooms.map((r) => r.id) };
}

export function withNoRoomsRevealed(): Pick<CampaignDungeonMap, 'revealedRoomIds'> {
  return { revealedRoomIds: [] };
}

export function withFogToggled(
  map: CampaignDungeonMap,
): Pick<CampaignDungeonMap, 'fogOfWarEnabled' | 'revealedRoomIds'> {
  const enabled = !map.fogOfWarEnabled;
  return {
    fogOfWarEnabled: enabled,
    revealedRoomIds: enabled ? (map.revealedRoomIds ?? []) : [],
  };
}
