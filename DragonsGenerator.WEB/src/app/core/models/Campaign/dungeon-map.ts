export type DungeonTheme =
  | 'crypt'
  | 'cave'
  | 'ruins'
  | 'temple'
  | 'sewer'
  | 'forest'
  | 'generic';

export type DungeonTileKind = 'wall' | 'floor' | 'door';

export type DungeonMarkerKind = 'door' | 'trap' | 'chest' | 'stairs' | 'note';

export interface DungeonRandomEncounter {
  creatures: { name: string; quantity: number; cr?: string }[];
}

export interface DungeonRoom {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  encounterId?: string | null;
  randomEncounter?: DungeonRandomEncounter | null;
  notes?: string;
}

export interface DungeonMarker {
  id: string;
  x: number;
  y: number;
  kind: DungeonMarkerKind;
  label?: string;
  linkedRoomId?: string | null;
  notes?: string;
}

export interface CampaignDungeonMap {
  id: string;
  name: string;
  theme: DungeonTheme;
  regionId?: string | null;
  regionName?: string;
  gridWidth: number;
  gridHeight: number;
  tiles: DungeonTileKind[][];
  rooms: DungeonRoom[];
  markers: DungeonMarker[];
  handoutId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DungeonGenParams {
  gridWidth: number;
  gridHeight: number;
  roomCount: number;
  corridorDensity: number;
  theme: DungeonTheme;
}

export const DUNGEON_THEME_LABELS: Record<DungeonTheme, string> = {
  crypt: 'Crypte',
  cave: 'Caverne',
  ruins: 'Ruines',
  temple: 'Temple',
  sewer: 'Égouts',
  forest: 'Forêt souterraine',
  generic: 'Générique',
};

export const DUNGEON_MARKER_LABELS: Record<DungeonMarkerKind, string> = {
  door: 'Porte',
  trap: 'Piège',
  chest: 'Coffre',
  stairs: 'Escalier',
  note: 'Note',
};

export function createEmptyDungeonMap(name = 'Nouveau donjon'): CampaignDungeonMap {
  const now = new Date().toISOString();
  const w = 48;
  const h = 48;
  return {
    id: crypto.randomUUID?.() ?? `map-${Date.now()}`,
    name,
    theme: 'generic',
    gridWidth: w,
    gridHeight: h,
    tiles: Array.from({ length: h }, () => Array.from({ length: w }, () => 'wall' as DungeonTileKind)),
    rooms: [],
    markers: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeDungeonTheme(raw: unknown): DungeonTheme {
  const themes: DungeonTheme[] = ['crypt', 'cave', 'ruins', 'temple', 'sewer', 'forest', 'generic'];
  return themes.includes(raw as DungeonTheme) ? (raw as DungeonTheme) : 'generic';
}
