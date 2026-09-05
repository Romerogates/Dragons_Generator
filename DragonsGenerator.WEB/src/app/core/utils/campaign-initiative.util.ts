/** Affiche la saisie d’initiative joueur seulement si le PJ est dans le combat et sans jet. */
export function shouldShowPlayerInitiativePrompt(
  board: {
    open?: boolean;
    code?: string | null;
    combatants?: { memberUserId?: string | null; hasRoll?: boolean }[];
  } | null,
  userId: string | null | undefined,
): boolean {
  if (!board?.open || !board.code) return false;
  if (!userId) return false;
  const list = board.combatants ?? [];
  if (!list.length) return false;
  const linked = list.filter((c) => c.memberUserId === userId);
  if (!linked.length) return false;
  return linked.some((c) => !c.hasRoll);
}
