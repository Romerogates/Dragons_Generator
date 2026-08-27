const CATEGORY_LABELS: Record<string, string> = {
  croyants: 'Croyants',
  habitants: 'Habitants',
  soldats: 'Soldats',
  arcanistes: 'Arcanistes',
  clandestins: 'Clandestins',
  'faune-urbaine': 'Faune urbaine',
  laboratoires: 'Laboratoires & bibliothèques',
  'laves-askamor': 'Laves d’Askamor',
  'rues-cité-franche': 'Rues de la Cité Franche',
  divers: 'Créatures diverses',
};

export function getCreatureCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/-/g, ' ');
}

export function formatChallengeRating(cr: string): string {
  return cr === '0' ? '0' : `FP ${cr}`;
}

/** Valeur numérique approximative pour tri / filtres FP. */
export function parseChallengeRating(cr: string): number {
  if (cr === '0') return 0;
  if (cr.includes('/')) {
    const [num, den] = cr.split('/').map(Number);
    return den ? num / den : 0;
  }
  const n = Number(cr);
  return Number.isFinite(n) ? n : 0;
}

export type CrTier = 'low' | 'mid' | 'high' | 'legendary';

export function getCrTier(cr: string): CrTier {
  const v = parseChallengeRating(cr);
  if (v <= 1) return 'low';
  if (v <= 5) return 'mid';
  if (v <= 10) return 'high';
  return 'legendary';
}

export const CR_TIER_LABELS: Record<CrTier, string> = {
  low: 'Faible (0–1)',
  mid: 'Modéré (2–5)',
  high: 'Dangereux (6–10)',
  legendary: 'Légendaire (11+)',
};

export function getCategoryIcon(category: string): string {
  const key = category.toLowerCase();
  if (key.includes('croyant')) return 'fluent-emoji:place-of-worship';
  if (key.includes('soldat') || key.includes('clandestin')) return 'fluent-emoji:crossed-swords';
  if (key.includes('faune')) return 'fluent-emoji:paw-prints';
  if (key.includes('arcan')) return 'fluent-emoji:crystal-ball';
  if (key.includes('habitant')) return 'fluent-emoji:house';
  if (key.includes('laboratoire') || key.includes('biblioth')) return 'fluent-emoji:books';
  if (key.includes('askamor')) return 'fluent-emoji:fire';
  if (key.includes('cit')) return 'fluent-emoji:cityscape';
  return 'fluent-emoji:dragon';
}

export const ABILITY_LABELS: Record<string, string> = {
  str: 'FOR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'SAG',
  cha: 'CHA',
};
