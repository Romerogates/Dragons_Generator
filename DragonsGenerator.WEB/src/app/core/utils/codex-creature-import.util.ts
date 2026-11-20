/** Visibilité des CTA Codex → table / rencontre (pas d’échec si on ne peut pas). */

export function ownerCampaignIdForCodex(input: {
  live: { id: string; isOwner: boolean } | null;
  persistedId: string | null;
}): string | null {
  if (input.live) return input.live.isOwner ? input.live.id : null;
  return input.persistedId;
}

export function showCodexAddToTable(input: {
  loggedIn: boolean;
  sessionOpen: boolean;
  isOwner: boolean;
}): boolean {
  return input.loggedIn && input.sessionOpen && input.isOwner;
}

export function showCodexAddToEncounter(input: {
  loggedIn: boolean;
  ownerCampaignId: string | null;
}): boolean {
  return input.loggedIn && !!input.ownerCampaignId;
}
