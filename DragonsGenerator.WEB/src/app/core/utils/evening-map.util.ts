import type { CampaignMember, Combatant, SessionTablePawn } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import {
  combatantsToTokens,
  isWalkableTile,
  type CombatTokenDraw,
} from './dungeon-battle.util';

export function eveningPawnId(userId: string): string {
  return `pawn-${userId}`;
}

/** MJ : tous les jetons. Joueur : uniquement le sien. Spectateur : aucun. */
export function canControlTableToken(input: {
  isDm: boolean;
  isSpectator?: boolean;
  userId: string | null | undefined;
  tokenId?: string | null;
  memberUserId?: string | null;
}): boolean {
  if (input.isSpectator) return false;
  if (input.isDm) return true;
  const userId = input.userId?.trim();
  if (!userId) return false;
  if (input.memberUserId && input.memberUserId === userId) return true;
  return !!input.tokenId && input.tokenId === eveningPawnId(userId);
}

export function listWalkableCells(map: CampaignDungeonMap): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  const h = map.gridHeight ?? 0;
  const w = map.gridWidth ?? 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isWalkableTile(map, x, y)) cells.push({ x, y });
    }
  }
  return cells;
}

export function seedEveningPawns(input: {
  map: CampaignDungeonMap;
  players: CampaignMember[];
  existing?: SessionTablePawn[] | null;
  combatants?: Combatant[] | null;
}): SessionTablePawn[] | null {
  const existing = [...(input.existing ?? [])];
  const occupied = new Set(existing.map((p) => `${p.mapX},${p.mapY}`));
  const walkable = listWalkableCells(input.map);
  let cellIndex = 0;
  const nextCell = (): { x: number; y: number } | null => {
    while (cellIndex < walkable.length) {
      const cell = walkable[cellIndex++];
      if (!occupied.has(`${cell.x},${cell.y}`)) {
        occupied.add(`${cell.x},${cell.y}`);
        return cell;
      }
    }
    return null;
  };

  let changed = false;
  const byUser = new Map(existing.filter((p) => p.memberUserId).map((p) => [p.memberUserId!, p]));
  const combatByUser = new Map(
    (input.combatants ?? [])
      .filter((c) => c.memberUserId)
      .map((c) => [c.memberUserId!, c]),
  );

  for (const player of input.players) {
    if (player.proposalStatus !== 'approved' || !player.userId) continue;
    const id = eveningPawnId(player.userId);
    const combat = combatByUser.get(player.userId);
    const already = byUser.get(player.userId) ?? existing.find((p) => p.id === id);
    if (already) {
      const token = combat?.tokenImageUrl?.trim() || already.tokenImageUrl;
      if (token && token !== already.tokenImageUrl) {
        already.tokenImageUrl = token;
        changed = true;
      }
      continue;
    }
    const cell =
      combat && typeof combat.mapX === 'number' && typeof combat.mapY === 'number'
        ? { x: combat.mapX, y: combat.mapY }
        : nextCell();
    if (!cell) break;
    existing.push({
      id,
      memberUserId: player.userId,
      characterId: player.approvedCharacterId ?? combat?.characterId ?? null,
      name: player.approvedCharacterName || player.displayName || 'Héros',
      mapX: cell.x,
      mapY: cell.y,
      tokenImageUrl: combat?.tokenImageUrl ?? null,
    });
    occupied.add(`${cell.x},${cell.y}`);
    changed = true;
  }

  return changed ? existing : null;
}

export function eveningPawnsToTokens(
  pawns: SessionTablePawn[] | null | undefined,
  opts?: { myId?: string | null; selectedId?: string | null },
): CombatTokenDraw[] {
  const asCombatants: Combatant[] = (pawns ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    kind: 'player',
    initiativeBonus: 0,
    memberUserId: p.memberUserId,
    characterId: p.characterId,
    mapX: p.mapX,
    mapY: p.mapY,
    tokenImageUrl: p.tokenImageUrl,
  }));
  return combatantsToTokens(asCombatants, {
    myId: opts?.myId ?? null,
    selectedId: opts?.selectedId ?? null,
  });
}

export function findEveningPawnAtTile(
  pawns: SessionTablePawn[] | null | undefined,
  x: number,
  y: number,
): SessionTablePawn | null {
  return (pawns ?? []).find((p) => p.mapX === x && p.mapY === y) ?? null;
}

export function isEveningTileOccupied(
  pawns: SessionTablePawn[] | null | undefined,
  x: number,
  y: number,
  exceptId?: string,
): boolean {
  return (pawns ?? []).some((p) => p.id !== exceptId && p.mapX === x && p.mapY === y);
}

export function placeEveningPawn(
  pawns: SessionTablePawn[] | null | undefined,
  pawnId: string,
  x: number,
  y: number,
): SessionTablePawn[] {
  return (pawns ?? []).map((p) => (p.id === pawnId ? { ...p, mapX: x, mapY: y } : p));
}

export function applyEveningPawnPatch(
  pawns: SessionTablePawn[] | null | undefined,
  pawnId: string,
  patch: Partial<SessionTablePawn>,
): SessionTablePawn[] {
  return (pawns ?? []).map((p) => (p.id === pawnId ? { ...p, ...patch } : p));
}
