import type { CampaignDungeonMap, DungeonTileKind } from '@core/models/Campaign/dungeon-map';
import type { Combatant, CombatantKind } from '@core/models/Campaign/campaign';
import { tileAt } from './dungeon-render.util';

export const TABLE_CHAT_MAX = 100;

export interface CombatTokenDraw {
  id: string;
  name: string;
  kind: CombatantKind;
  x: number;
  y: number;
  isCurrent?: boolean;
  isMine?: boolean;
  isSelected?: boolean;
  imageUrl?: string | null;
}

/** Convertit un offset pixel (relatif au canvas, hors CSS scale) en case grille. */
export function pixelToTile(
  offsetX: number,
  offsetY: number,
  cellSize: number,
  edgePadCells = 0,
): { x: number; y: number } {
  const origin = Math.max(0, edgePadCells) * cellSize;
  const x = Math.floor((offsetX - origin) / cellSize);
  const y = Math.floor((offsetY - origin) / cellSize);
  return { x, y };
}

export function isWalkableTile(map: CampaignDungeonMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.gridWidth || y >= map.gridHeight) return false;
  const kind: DungeonTileKind = tileAt(map, x, y);
  return kind === 'floor' || kind === 'door';
}

/** Place le jeton sur la case si walkable, sinon null. */
export function clampTokenToFloor(
  map: CampaignDungeonMap,
  x: number,
  y: number,
): { x: number; y: number } | null {
  return isWalkableTile(map, x, y) ? { x, y } : null;
}

export function combatantHasMapPosition(c: Combatant): c is Combatant & { mapX: number; mapY: number } {
  return typeof c.mapX === 'number' && typeof c.mapY === 'number';
}

export function combatantsToTokens(
  combatants: Combatant[],
  opts?: { currentId?: string | null; myId?: string | null; selectedId?: string | null },
): CombatTokenDraw[] {
  const tokens: CombatTokenDraw[] = [];
  for (const c of combatants) {
    if (c.defeated) continue;
    if (!combatantHasMapPosition(c)) continue;
    tokens.push({
      id: c.id,
      name: c.name || '?',
      kind: c.kind,
      x: c.mapX,
      y: c.mapY,
      isCurrent: opts?.currentId === c.id,
      isMine: opts?.myId === c.id,
      isSelected: opts?.selectedId === c.id,
      imageUrl: c.tokenImageUrl?.trim() || null,
    });
  }
  return tokens;
}

export function findCombatantAtTile(
  combatants: Combatant[],
  x: number,
  y: number,
): Combatant | null {
  return (
    combatants.find(
      (c) => !c.defeated && combatantHasMapPosition(c) && c.mapX === x && c.mapY === y,
    ) ?? null
  );
}
