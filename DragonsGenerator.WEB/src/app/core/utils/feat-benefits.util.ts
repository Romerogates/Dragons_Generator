import type { AbilityKey } from '@core/models/Character/character';

/** Représentation minimale d'un don (`Feat.data` brut, clés snake_case telles quelles). */
export interface RawFeatData {
  ability_score_increase?: {
    ability?: string;
    value?: number;
    max?: number;
  };
  benefits?: unknown[];
}

const ABILITY_CODE_TO_KEY: Record<string, AbilityKey> = {
  STR: 'force',
  DEX: 'dexterite',
  CON: 'constitution',
  INT: 'intelligence',
  WIS: 'sagesse',
  CHA: 'charisme',
};

/**
 * Un don nécessite-t-il un choix explicite de caractéristique pour son ASI ? (ex. "any",
 * "CON_or_CHA", "DEX_or_INT"). Les codes fixes (STR/DEX/…) et "spellcasting" n'en ont pas besoin.
 */
export function featAsiNeedsAbilityChoice(feat: RawFeatData | undefined): boolean {
  const code = feat?.ability_score_increase?.ability;
  if (!code) return false;
  const upper = code.toUpperCase();
  return upper !== 'SPELLCASTING' && !ABILITY_CODE_TO_KEY[upper];
}

/** Options de caractéristiques proposées par un ASI flexible de don (ex. "CON_or_CHA" → [CON, CHA]). */
export function featAsiAbilityOptions(feat: RawFeatData | undefined): AbilityKey[] {
  const code = feat?.ability_score_increase?.ability;
  if (!code) return [];
  const upper = code.toUpperCase();
  if (upper === 'ANY') {
    return Object.values(ABILITY_CODE_TO_KEY);
  }
  const parts = upper.split(/_OR_|\s+OU\s+|\/|,/).map((p) => p.trim());
  const keys = parts.map((p) => ABILITY_CODE_TO_KEY[p]).filter((k): k is AbilityKey => !!k);
  return keys;
}

/**
 * Résout la caractéristique concrète bonifiée par l'ASI d'un don.
 * - Code fixe (STR/DEX/…) → directement cette caractéristique.
 * - "spellcasting" → la caractéristique magique de la classe (si connue).
 * - "any" / "X_or_Y" → nécessite `choice` (sélection du joueur).
 */
export function resolveFeatAsiAbilityKey(
  feat: RawFeatData | undefined,
  spellcastingAbility: AbilityKey | null,
  choice: AbilityKey | null | undefined,
): AbilityKey | null {
  const code = feat?.ability_score_increase?.ability;
  if (!code) return null;
  const upper = code.toUpperCase();
  if (upper === 'SPELLCASTING') return spellcastingAbility;
  if (ABILITY_CODE_TO_KEY[upper]) return ABILITY_CODE_TO_KEY[upper];
  return choice ?? null;
}

export function featAsiValue(feat: RawFeatData | undefined): number {
  return feat?.ability_score_increase?.value ?? 0;
}

/** Rayon de vision dans le noir accordé par un don (ex. Don "Pilier de taverne"). */
export function featDarkvisionRadius(feat: RawFeatData | undefined): number {
  const benefits = Array.isArray(feat?.benefits) ? feat!.benefits! : [];
  let radius = 0;
  for (const b of benefits) {
    if (b && typeof b === 'object' && (b as Record<string, unknown>)['type'] === 'darkvision') {
      const val = Number((b as Record<string, unknown>)['range_m']);
      if (Number.isFinite(val)) radius = Math.max(radius, val);
    }
  }
  return radius;
}

/** Maîtrise d'armure fixe accordée par un don (seuls des noms connus sont mappés vers un id). */
const ARMOR_NAME_TO_ID: Record<string, string> = {
  bouclier: 'ar-bouclier',
};

export function featBonusArmorProficiencies(feat: RawFeatData | undefined): string[] {
  const benefits = Array.isArray(feat?.benefits) ? feat!.benefits! : [];
  const out: string[] = [];
  for (const b of benefits) {
    if (!b || typeof b !== 'object') continue;
    const rec = b as Record<string, unknown>;
    if (rec['type'] !== 'proficiency' || rec['proficiency_type'] !== 'armor') continue;
    const value = typeof rec['value'] === 'string' ? rec['value'].toLowerCase().trim() : '';
    const id = ARMOR_NAME_TO_ID[value];
    if (id) out.push(id);
  }
  return out;
}
