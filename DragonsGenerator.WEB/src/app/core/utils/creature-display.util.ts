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

/** En-tête OCR / livre (« Le dragon utilise l’un des deux souffles suivants : ») sans contenu. */
export function isDanglingCodexIntro(description: string | null | undefined): boolean {
  const text = (description ?? '').trim();
  if (!text.endsWith(':')) return false;
  if (text.includes('\n')) return false;
  return text.length <= 140;
}

export function visibleCreatureBlocks<T extends { name: string; description: string }>(
  blocks: T[] | null | undefined,
): T[] {
  return (blocks ?? []).filter(
    (block) => block.name.trim().length > 0 || creatureBlockBody(block.description) !== null,
  );
}

/** Corps de particularité / action : masque les phrases d’intro coupées, garde le titre (ex. recharge). */
export function creatureBlockBody(description: string | null | undefined): string | null {
  const text = (description ?? '').trim();
  if (!text || isDanglingCodexIntro(text)) return null;
  return text;
}

/** Retire une phrase d’intro tronquée en fin de lore (« En voici quelques variantes : »). */
export function tidyCreatureLore(description: string | null | undefined): string {
  const text = (description ?? '').trim();
  if (!text.endsWith(':')) return text;
  const cut = text.replace(/\s+[^.!?\n]+:$/, '').trim();
  return cut || text;
}
