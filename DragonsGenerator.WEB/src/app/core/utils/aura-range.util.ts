/**
 * Annote la description d'une aptitude d'aura avec la portée actuelle
 * (3 m → 9 m à partir du niveau d'amélioration, typiquement 18).
 */
export function annotateAuraDesc(
  feat: { desc?: string; mechanics?: Record<string, unknown> },
  characterLevel: number,
): string {
  const base = feat.desc ?? '';
  const m = feat.mechanics;
  if (!m) return base;
  const initial = Number(m['range_m_initial']);
  if (!Number.isFinite(initial) || initial <= 0) return base;
  const improved = Number(m['range_m_improved']);
  const improveAt = Number(m['range_improves_at_level'] ?? 18);
  const range =
    Number.isFinite(improved) && characterLevel >= improveAt ? improved : initial;
  const tag = `Portée d'aura : ${range} m.`;
  if (base.includes("Portée d'aura")) return base;
  return base ? `${base} ${tag}` : tag;
}
