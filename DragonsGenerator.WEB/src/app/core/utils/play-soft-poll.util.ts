/** Intervalle de secours GET table quand le live est coupé. MJ aussi (jets joueurs, présence). */
export function playSoftPollMs(liveConnected: boolean, isOwner: boolean): number | null {
  if (liveConnected) return null;
  return isOwner ? 5_000 : 4_000;
}

/** Hub campagne : plus fréquent s’il y a une table ouverte, y compris pour le MJ. */
export function hubSoftPollMs(
  liveConnected: boolean,
  hasOpenTable: boolean,
  isOwner: boolean,
): number | null {
  if (liveConnected) return null;
  if (!hasOpenTable) return 12_000;
  return isOwner ? 6_000 : 4_000;
}
