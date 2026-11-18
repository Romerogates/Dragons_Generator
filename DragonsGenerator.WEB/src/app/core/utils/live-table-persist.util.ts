import type { CampaignSession, SessionTablePawn } from '@core/models/Campaign/campaign';

export interface LiveTablePersistBody {
  sessionId: string;
  tablePawns?: SessionTablePawn[];
  combatantPositions?: {
    id: string;
    mapX?: number | null;
    mapY?: number | null;
    tokenImageUrl?: string | null;
  }[];
  activeMapId?: string | null;
  clearActiveMapId?: boolean;
}

const TABLE_KEYS = new Set(['tablePawns', 'activeMapId', 'activeCombat']);

/** True si le patch vise la carte de soirée (pions / carte), pas un PUT combat complet. */
export function isLiveTableSessionPatch(patch: Partial<CampaignSession>): boolean {
  const keys = Object.keys(patch);
  if (!keys.length || !keys.every((k) => TABLE_KEYS.has(k))) return false;
  return 'tablePawns' in patch || 'activeMapId' in patch;
}

export function liveTableSnapshotFromSession(
  session: CampaignSession | undefined,
): Partial<CampaignSession> | null {
  if (!session) return null;
  const snapshot: Partial<CampaignSession> = {
    activeMapId: session.activeMapId ?? null,
  };
  if (session.tablePawns) snapshot.tablePawns = session.tablePawns;
  if (session.activeCombat) snapshot.activeCombat = session.activeCombat;
  return snapshot;
}

export function liveTablePersistBody(
  sessionId: string,
  patch: Partial<CampaignSession>,
): LiveTablePersistBody | null {
  if (!sessionId || !isLiveTableSessionPatch(patch)) return null;
  const body: LiveTablePersistBody = { sessionId };
  if ('tablePawns' in patch && patch.tablePawns !== undefined) {
    body.tablePawns = patch.tablePawns;
  }
  if ('activeMapId' in patch) {
    if (patch.activeMapId) body.activeMapId = patch.activeMapId;
    else body.clearActiveMapId = true;
  }
  if (patch.activeCombat?.combatants?.length) {
    body.combatantPositions = patch.activeCombat.combatants.map((c) => ({
      id: c.id,
      mapX: c.mapX,
      mapY: c.mapY,
      tokenImageUrl: c.tokenImageUrl,
    }));
  }
  return body;
}
