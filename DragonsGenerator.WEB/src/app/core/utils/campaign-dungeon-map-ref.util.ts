import type {
  CampaignDungeonMap,
  DungeonMarker,
  DungeonRoom,
  DungeonTileKind,
} from '@core/models/Campaign/dungeon-map';
import { normalizeDungeonTheme } from '@core/models/Campaign/dungeon-map';

/** True when the map has an embedded tile grid (legacy or hydrated). */
export function hasEmbeddedGeometry(map: CampaignDungeonMap | null | undefined): boolean {
  if (!map || !map.tiles.length) return false;
  return map.gridWidth > 0 && map.gridHeight > 0;
}

/** True when geometry must be loaded from Mes Donjons. */
export function needsLibraryHydration(map: CampaignDungeonMap | null | undefined): boolean {
  if (!map?.libraryDungeonId) return false;
  return !hasEmbeddedGeometry(map);
}

/**
 * Overlay-only fields kept in the campaign blob for linked maps.
 * Linked maps persist with empty tiles (no 48×48 grid in the campaign JSON).
 */
export function stripGeometryForPersist(map: CampaignDungeonMap): CampaignDungeonMap {
  if (!map.libraryDungeonId) return map;
  const rooms = map.rooms.map((r) => ({
    id: r.id,
    label: r.label,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    encounterId: r.encounterId ?? null,
    notes: r.notes,
  }));
  return {
    id: map.id,
    libraryDungeonId: map.libraryDungeonId,
    name: map.name,
    theme: map.theme,
    regionId: map.regionId ?? null,
    regionName: map.regionName,
    gridWidth: 0,
    gridHeight: 0,
    tiles: [],
    markers: [],
    handoutId: map.handoutId ?? null,
    fogOfWarEnabled: !!map.fogOfWarEnabled,
    revealedRoomIds: [...(map.revealedRoomIds ?? [])],
    revealedCorridorCells: [...(map.revealedCorridorCells ?? [])],
    rooms,
    createdAt: map.createdAt,
    updatedAt: map.updatedAt,
  };
}

/** Merge library geometry onto a campaign ref (overlay wins for fog / handout / encounter links). */
export function mergeLibraryGeometry(
  ref: CampaignDungeonMap,
  libraryData: CampaignDungeonMap,
): CampaignDungeonMap {
  const overlayById = new Map(ref.rooms.map((r) => [r.id, r]));
  const rooms: DungeonRoom[] = libraryData.rooms.map((lr) => {
    const overlay = overlayById.get(lr.id);
    return {
      ...lr,
      encounterId: overlay?.encounterId ?? lr.encounterId ?? null,
      notes: overlay?.notes ?? lr.notes,
      randomEncounter: lr.randomEncounter ?? null,
    };
  });
  return {
    ...libraryData,
    id: ref.id,
    libraryDungeonId: ref.libraryDungeonId || libraryData.libraryDungeonId || null,
    name: ref.name || libraryData.name,
    theme: ref.theme || libraryData.theme,
    regionId: ref.regionId ?? libraryData.regionId ?? null,
    regionName: ref.regionName ?? libraryData.regionName,
    handoutId: ref.handoutId ?? null,
    fogOfWarEnabled: !!ref.fogOfWarEnabled,
    revealedRoomIds: [...(ref.revealedRoomIds ?? [])],
    revealedCorridorCells: [...(ref.revealedCorridorCells ?? [])],
    rooms,
    markers: structuredClone(libraryData.markers) as DungeonMarker[],
    tiles: structuredClone(libraryData.tiles) as DungeonTileKind[][],
    gridWidth: libraryData.gridWidth,
    gridHeight: libraryData.gridHeight,
    createdAt: ref.createdAt || libraryData.createdAt,
    updatedAt: ref.updatedAt || libraryData.updatedAt,
  };
}

/** Attach a library dungeon as a live campaign ref (no embedded grid). */
export function linkLibraryDungeon(
  libraryData: CampaignDungeonMap,
  libraryId: string,
  name?: string,
): CampaignDungeonMap {
  const now = new Date().toISOString();
  const roomOverlays = libraryData.rooms.map((r) => ({
    id: r.id,
    label: r.label,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    encounterId: null as string | null,
    notes: r.notes,
  }));
  const rawName = (name ?? libraryData.name ?? 'Donjon').trim();
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `map-${Date.now()}`,
    libraryDungeonId: libraryId,
    name: rawName || 'Donjon',
    theme: normalizeDungeonTheme(libraryData.theme),
    regionId: libraryData.regionId ?? null,
    regionName: libraryData.regionName,
    gridWidth: 0,
    gridHeight: 0,
    tiles: [],
    markers: [],
    rooms: roomOverlays,
    handoutId: null,
    fogOfWarEnabled: false,
    revealedRoomIds: [],
    revealedCorridorCells: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Payload to store in Mes Donjons (geometry only, no campaign overlay). */
export function geometryPayloadForLibrary(map: CampaignDungeonMap): CampaignDungeonMap {
  return {
    ...map,
    libraryDungeonId: undefined,
    handoutId: null,
    fogOfWarEnabled: false,
    revealedRoomIds: [],
    revealedCorridorCells: [],
    rooms: map.rooms.map((r) => ({
      ...r,
      encounterId: null,
      randomEncounter: r.randomEncounter ?? null,
    })),
  };
}

export function mapsForCampaignPersist(maps: CampaignDungeonMap[]): CampaignDungeonMap[] {
  return maps.map((m) => (m.libraryDungeonId ? stripGeometryForPersist(m) : m));
}
