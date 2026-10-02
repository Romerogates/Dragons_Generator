import type {
  CampaignData,
  CampaignDetail,
  CampaignSession,
  Combatant,
} from '@core/models/Campaign/campaign';

/**
 * Retire `tableChat` des sessions avant PUT — le serveur MergeTableChat
 * conserve le fil quand le client omet le champ.
 */
export function stripTableChatForPersist(data: CampaignData): CampaignData {
  const sessions = (data.sessions ?? []).map((s) => {
    const { tableChat: _omit, ...rest } = s;
    return rest;
  });
  return { ...data, sessions };
}

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

/**
 * Sync table live (combat + fog) depuis le distant sans écraser notes / timeline locales.
 * Utilisé par le MJ quand un joueur attaque ou que le fog change depuis un autre client.
 */
export function mergeRemoteLiveTable(
  local: CampaignDetail,
  remote: CampaignDetail,
): CampaignDetail {
  const activeId = local.data.activeSessionId ?? remote.data.activeSessionId;
  const remoteSession = activeId
    ? (remote.data.sessions ?? []).find((s) => s.id === activeId)
    : undefined;
  const remoteCombat = remoteSession?.activeCombat;

  const sessions = (local.data.sessions ?? []).map((ls): CampaignSession => {
    if (!activeId || ls.id !== activeId) return ls;
    if (!remoteCombat) {
      return remoteSession
        ? {
            ...ls,
            activeCombat: remoteSession.activeCombat ?? ls.activeCombat,
            status: remoteSession.status ?? ls.status,
            tableReadyUserIds:
              remoteSession.tableReadyUserIds ?? ls.tableReadyUserIds,
            tablePin:
              remoteSession.tablePin !== undefined ? remoteSession.tablePin : ls.tablePin,
            tablePinHistory: remoteSession.tablePinHistory ?? ls.tablePinHistory,
            tableMacros: remoteSession.tableMacros ?? ls.tableMacros,
          }
        : ls;
    }

    const localCombat = ls.activeCombat;
    if (!localCombat) {
      return { ...ls, activeCombat: remoteCombat };
    }

    const remoteById = new Map(remoteCombat.combatants.map((c) => [c.id, c]));
    const localIds = new Set(localCombat.combatants.map((c) => c.id));
    const combatants = localCombat.combatants.map((lc): Combatant => {
      const rc = remoteById.get(lc.id);
      if (!rc) return lc;
      return {
        ...lc,
        currentHp: rc.currentHp ?? lc.currentHp,
        maxHp: rc.maxHp ?? lc.maxHp,
        conditions: rc.conditions ?? lc.conditions,
        defeated: rc.defeated ?? lc.defeated,
        initiativeRoll: rc.initiativeRoll ?? lc.initiativeRoll,
        playerSubmitted: rc.playerSubmitted || lc.playerSubmitted,
        armorClass: rc.armorClass ?? lc.armorClass,
      };
    });
    for (const rc of remoteCombat.combatants) {
      if (!localIds.has(rc.id)) combatants.push(rc);
    }

    return {
      ...ls,
      activeCombat: {
        ...localCombat,
        combatants,
        turnIndex: remoteCombat.turnIndex,
        round: remoteCombat.round ?? localCombat.round,
        turnOrderIds: remoteCombat.turnOrderIds ?? localCombat.turnOrderIds,
        collectingInitiative: remoteCombat.collectingInitiative,
        initiativeCode: remoteCombat.initiativeCode ?? localCombat.initiativeCode,
        flowPhase: remoteCombat.flowPhase ?? localCombat.flowPhase,
      },
      combatLog: remoteSession?.combatLog?.length
        ? remoteSession.combatLog
        : ls.combatLog,
      status: remoteSession?.status ?? ls.status,
      tableReadyUserIds:
        remoteSession?.tableReadyUserIds ?? ls.tableReadyUserIds,
      // Pin : distant gagne si défini ('' / null = unpin sync joueurs).
      tablePin:
        remoteSession?.tablePin !== undefined ? remoteSession.tablePin : ls.tablePin,
      tablePinHistory:
        remoteSession?.tablePinHistory ?? ls.tablePinHistory,
      tableMacros: remoteSession?.tableMacros ?? ls.tableMacros,
    };
  });

  const localMaps = local.data.dungeonMaps ?? [];
  const remoteMaps = remote.data.dungeonMaps ?? [];
  const remoteMapById = new Map(remoteMaps.map((m) => [m.id, m]));
  const dungeonMaps = localMaps.map((lm) => {
    const rm = remoteMapById.get(lm.id);
    if (!rm) return lm;
    return {
      ...lm,
      revealedRoomIds: rm.revealedRoomIds ?? lm.revealedRoomIds,
      fogOfWarEnabled: rm.fogOfWarEnabled ?? lm.fogOfWarEnabled,
    };
  });

  const members = remote.members?.length ? remote.members : local.members;

  return {
    ...local,
    updatedAt: remote.updatedAt,
    members,
    data: {
      ...local.data,
      activeSessionId: remote.data.activeSessionId ?? local.data.activeSessionId,
      pinnedHandoutId: remote.data.pinnedHandoutId ?? local.data.pinnedHandoutId,
      sessions,
      dungeonMaps,
    },
  };
}
