/** Bonus de maîtrise D&D/Dragons : +2 aux niv. 1–4, +3 aux 5–8, etc. */
export function proficiencyBonusForLevel(level: number): number {
  const lvl = Math.min(20, Math.max(1, Math.floor(level) || 1));
  return Math.floor((lvl - 1) / 4) + 2;
}
