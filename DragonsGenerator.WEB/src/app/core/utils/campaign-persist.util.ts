import type {
  CampaignDetail,
  CampaignSession,
  Combatant,
} from '@core/models/Campaign/campaign';

/**
 * Fusionne uniquement les jets d'initiative distants dans l'état local.
 * Évite qu'un GET polling écrase notes / timeline / brouillons locaux.
 */
export function mergeRemoteInitiativeRolls(
  local: CampaignDetail,
  remote: CampaignDetail,
): CampaignDetail {
  const activeId = local.data.activeSessionId;
  if (!activeId) {
    return { ...local, updatedAt: remote.updatedAt };
  }

  const remoteSession = (remote.data.sessions ?? []).find((s) => s.id === activeId);
  const remoteCombat = remoteSession?.activeCombat;
  if (!remoteCombat) {
    return { ...local, updatedAt: remote.updatedAt };
  }

  const sessions = (local.data.sessions ?? []).map((ls): CampaignSession => {
    if (ls.id !== activeId || !ls.activeCombat) return ls;

    const remoteById = new Map(remoteCombat.combatants.map((c) => [c.id, c]));
    const combatants = ls.activeCombat.combatants.map((lc): Combatant => {
      const rc = remoteById.get(lc.id);
      if (!rc?.playerSubmitted) return lc;
      return {
        ...lc,
        initiativeRoll: rc.initiativeRoll,
        playerSubmitted: true,
      };
    });

    return {
      ...ls,
      activeCombat: {
        ...ls.activeCombat,
        combatants,
        collectingInitiative: remoteCombat.collectingInitiative,
        initiativeCode: remoteCombat.initiativeCode ?? ls.activeCombat.initiativeCode,
      },
    };
  });

  return {
    ...local,
    updatedAt: remote.updatedAt,
    data: { ...local.data, sessions },
  };
}
