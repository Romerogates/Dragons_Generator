/** Nombre max de personnages cloud « Mes héros » par compte joueur. */
export const MAX_CHARACTERS_PER_USER = 10;

/** Base du plafond de pré-tirés campagne (hors joueurs). */
export const MAX_CAMPAIGN_PREGENS_BASE = 10;

/** Plafond pré-tirés = 10 + nombre de joueurs (membres role player). */
export function maxCampaignPregens(playerCount: number): number {
  const players = Number.isFinite(playerCount) ? Math.max(0, Math.floor(playerCount)) : 0;
  return MAX_CAMPAIGN_PREGENS_BASE + players;
}
