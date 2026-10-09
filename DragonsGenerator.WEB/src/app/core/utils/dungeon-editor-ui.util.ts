/** UI éditeur donjon (outils, zoom, labels) — hors Atlas. */

import type { EncounterGroup } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap, DungeonTheme } from '@core/models/Campaign/dungeon-map';
import { themePalette } from './dungeon-render.util';

export type DungeonEditorTool =
  | 'select'
  | 'room'
  | 'floor'
  | 'wall'
  | 'fill'
  | 'door'
  | 'trap'
  | 'chest'
  | 'stairs';

export const DUNGEON_EDITOR_MIN_SCALE = 0.35;
export const DUNGEON_EDITOR_MAX_SCALE = 3;
export const DUNGEON_EDITOR_FIT_MAX_SCALE = 1.75;
export const DUNGEON_EDITOR_CELL = 12;
export const DUNGEON_EDITOR_EDGE_PAD = 2;

export type DungeonSizePresetId = 'compact' | 'standard' | 'large' | 'custom';

export interface DungeonSizePreset {
  id: Exclude<DungeonSizePresetId, 'custom'>;
  label: string;
  hint: string;
  gridWidth: number;
  gridHeight: number;
  roomCount: number;
  corridorDensity: number;
}

export const DUNGEON_SIZE_PRESETS: DungeonSizePreset[] = [
  {
    id: 'compact',
    label: 'Compact',
    hint: '32×32 · ~6 salles',
    gridWidth: 32,
    gridHeight: 32,
    roomCount: 6,
    corridorDensity: 45,
  },
  {
    id: 'standard',
    label: 'Standard',
    hint: '40×40 · ~8 salles',
    gridWidth: 40,
    gridHeight: 40,
    roomCount: 8,
    corridorDensity: 50,
  },
  {
    id: 'large',
    label: 'Large',
    hint: '56×56 · ~12 salles',
    gridWidth: 56,
    gridHeight: 56,
    roomCount: 12,
    corridorDensity: 55,
  },
];

export const DUNGEON_EDITOR_TOOLS: { id: DungeonEditorTool; label: string; hint: string }[] = [
  { id: 'select', label: 'Sélection', hint: 'Cliquer une salle' },
  { id: 'room', label: 'Salle', hint: 'Clic-glisser pour définir une salle' },
  { id: 'floor', label: 'Sol', hint: 'Peindre le sol' },
  { id: 'wall', label: 'Mur', hint: 'Peindre des murs' },
  { id: 'fill', label: 'Remplir', hint: 'Remplir une zone connectée (sol ou mur)' },
  { id: 'door', label: 'Porte', hint: 'Poser une porte' },
  { id: 'trap', label: 'Piège', hint: 'Marqueur piège' },
  { id: 'chest', label: 'Coffre', hint: 'Marqueur coffre' },
  { id: 'stairs', label: 'Escalier', hint: 'Marqueur escalier' },
];

export function clampDungeonEditorScale(scale: number, delta: number): number {
  return Math.min(
    DUNGEON_EDITOR_MAX_SCALE,
    Math.max(DUNGEON_EDITOR_MIN_SCALE, +(scale + delta).toFixed(2)),
  );
}

export function dungeonEditorCursorClass(opts: {
  isPanning: boolean;
  spaceHeld: boolean;
  tool: DungeonEditorTool;
}): string {
  if (opts.isPanning || opts.spaceHeld) return 'cursor-grabbing';
  if (opts.tool === 'select') return 'cursor-default';
  return 'cursor-crosshair';
}

export function dungeonEncounterLabel(
  room: CampaignDungeonMap['rooms'][0],
  encounters: EncounterGroup[],
): string {
  if (room.encounterId) {
    const enc = encounters.find((e) => e.id === room.encounterId);
    if (enc) {
      return enc.creatures.map((c) => `${c.quantity}× ${c.customName || c.creatureName}`).join(', ');
    }
  }
  if (room.randomEncounter?.creatures.length) {
    return room.randomEncounter.creatures.map((c) => `${c.quantity}× ${c.name}`).join(', ');
  }
  return '—';
}

export function markersInRoom(
  room: CampaignDungeonMap['rooms'][0],
  markers: CampaignDungeonMap['markers'],
): CampaignDungeonMap['markers'] {
  return markers.filter((m) => {
    if (m.kind === 'door') return false;
    if (m.linkedRoomId === room.id) return true;
    return (
      m.x >= room.x &&
      m.y >= room.y &&
      m.x < room.x + room.width &&
      m.y < room.y + room.height
    );
  });
}

export function formatDungeonMapDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function dungeonLegendTileColor(
  kind: 'wall' | 'floor' | 'door',
  theme: DungeonTheme,
): string {
  const p = themePalette(theme);
  if (kind === 'wall') return p.wall;
  if (kind === 'door') return p.door;
  return p.floor;
}
