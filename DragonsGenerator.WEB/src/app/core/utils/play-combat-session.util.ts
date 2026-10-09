import type {
  ActiveCombat,
  CampaignSession,
  Combatant,
  EncounterGroup,
} from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import { clampTokenToFloor, isTileOccupied } from './dungeon-battle.util';
import {
  canAdvanceFromSetup,
  canOpenFightPhase,
  createActiveCombat,
  createCombatHistoryEntry,
  createInitiativeCode,
  expandEncounterToCombatants,
  formatCombatArchiveSummary,
  freezeTurnOrderIds,
} from './combat-tracker.util';
import {
  appendTextToFirstNotePad,
  archivePlayPadsText,
  ensureSessionPlayPads,
} from './notebook.util';

export type PlayImportPicker = 'ally' | 'campaignAlly' | 'enemy';

export function exclusivePlayImportPickers(open: PlayImportPicker | null): {
  ally: boolean;
  campaignAlly: boolean;
  enemy: boolean;
} {
  return {
    ally: open === 'ally',
    campaignAlly: open === 'campaignAlly',
    enemy: open === 'enemy',
  };
}

export function placeEncounterCombatantsOnMap(
  combatants: Combatant[],
  encounter: Pick<EncounterGroup, 'id' | 'dungeonMapId'>,
  maps: CampaignDungeonMap[],
): Combatant[] {
  if (!encounter.dungeonMapId) return combatants;
  const map = maps.find((m) => m.id === encounter.dungeonMapId);
  const room = map?.rooms?.find((r) => r.encounterId === encounter.id);
  if (!map || !room) return combatants;
  return combatants.map((c, i) => {
    const clamped =
      clampTokenToFloor(map, room.x + i, room.y) ?? clampTokenToFloor(map, room.x, room.y);
    return clamped ? { ...c, mapX: clamped.x, mapY: clamped.y } : c;
  });
}

export function encounterCombatSessionPatch(
  encounter: EncounterGroup,
  maps: CampaignDungeonMap[],
): Partial<CampaignSession> {
  const combatants = placeEncounterCombatantsOnMap(
    expandEncounterToCombatants(encounter),
    encounter,
    maps,
  );
  const patch: Partial<CampaignSession> = {
    activeCombat: createActiveCombat(combatants, {
      label: encounter.name,
      encounterId: encounter.id,
    }),
  };
  if (encounter.dungeonMapId) patch.activeMapId = encounter.dungeonMapId;
  return patch;
}

/** Archive calepins dans les notes MJ et clôture la session table. */
export function sessionPatchAfterPlayEnd(
  session: CampaignSession,
  playerRecap?: string,
): Partial<CampaignSession> {
  const pads = ensureSessionPlayPads(session);
  const playBlock = archivePlayPadsText(pads) || session.playNotes?.trim() || '';
  const mergedNotes = playBlock
    ? [session.notes?.trim(), playBlock].filter(Boolean).join('\n\n--- Notes de session ---\n\n')
    : session.notes;
  return {
    status: 'played',
    notes: mergedNotes || session.notes,
    playerRecap: playerRecap || session.playerRecap,
    playNotes: '',
    playNotebook: undefined,
    playPads: [],
    activeCombat: null,
  };
}

export function sessionPatchAfterCombatEnd(
  session: CampaignSession,
  combat: ActiveCombat,
): Partial<CampaignSession> {
  const archive = formatCombatArchiveSummary(combat);
  const entry = createCombatHistoryEntry(combat);
  return {
    activeCombat: null,
    playPads: appendTextToFirstNotePad(ensureSessionPlayPads(session), archive),
    combatHistory: [...(session.combatHistory ?? []), entry],
  };
}

export function approvedMembersNotInCombat<T extends { userId: string }>(
  approved: T[],
  combatants: { memberUserId?: string | null }[],
): T[] {
  const existing = new Set(
    combatants.map((c) => c.memberUserId).filter((id): id is string => !!id),
  );
  return approved.filter((p) => !existing.has(p.userId));
}

export function withCombatantAtTile(
  combatants: Combatant[],
  combatantId: string,
  x: number,
  y: number,
): Combatant[] | null {
  if (isTileOccupied(combatants, x, y, combatantId)) return null;
  return combatants.map((c) => (c.id === combatantId ? { ...c, mapX: x, mapY: y } : c));
}

export function combatEnteringInitiative(combat: ActiveCombat): ActiveCombat | null {
  if (!canAdvanceFromSetup(combat)) return null;
  return {
    ...combat,
    flowPhase: 'initiative',
    collectingInitiative: true,
    initiativeCode: combat.initiativeCode || createInitiativeCode(),
  };
}

export function combatEnteringFight(combat: ActiveCombat): ActiveCombat | null {
  if (!canOpenFightPhase(combat)) return null;
  return {
    ...combat,
    flowPhase: 'fight',
    collectingInitiative: false,
    turnOrderIds: freezeTurnOrderIds(combat),
    turnIndex: 0,
  };
}

export function playerSubmittedCombatantIds(combat: ActiveCombat): string[] {
  return combat.combatants.filter((c) => c.kind === 'player' && c.playerSubmitted).map((c) => c.id);
}
