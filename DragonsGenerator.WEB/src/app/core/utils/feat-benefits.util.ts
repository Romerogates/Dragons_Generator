import type { AbilityKey, TalentSpend, TalentSpendType } from '@core/models/Character/character';

export type { TalentSpend, TalentSpendType };

/** Représentation minimale d'un don (`Feat.data` brut, clés snake_case telles quelles). */
export interface RawFeatData {
  ability_score_increase?: {
    ability?: string;
    value?: number;
    max?: number;
  };
  benefits?: unknown[];
}

/** Coût en points d'un type de dépense de Talent (1 pt ou 2 pts selon la description du don). */
export const TALENT_SPEND_COST: Record<TalentSpendType, number> = {
  skill: 1,
  tool: 1,
  weapon: 1,
  languages_common: 1,
  saving_throw: 2,
  language_exotic: 2,
  ability_score: 2,
  armor: 2,
  expertise: 2,
  attack_bonus: 2,
  cantrips: 2,
};

export const TALENT_SPEND_LABEL: Record<TalentSpendType, string> = {
  skill: 'Maîtrise de compétence',
  tool: "Maîtrise d'outil",
  weapon: "Maîtrise d'une arme",
  languages_common: '2 langues communes',
  saving_throw: 'Maîtrise de jet de sauvegarde',
  language_exotic: 'Langue exotique',
  ability_score: '+1 caractéristique',
  armor: "Maîtrise d'armures (palier suivant)",
  expertise: 'Expertise (double maîtrise)',
  attack_bonus: "+1 aux jets d'attaque (catégorie d'arme)",
  cantrips: '2 sorts mineurs',
};

/** Un don utilise-t-il le système de points flexibles (ex. "Talent") plutôt qu'un bénéfice fixe ? */
export function featIsFlexiblePoints(feat: RawFeatData | null | undefined): boolean {
  const benefits = Array.isArray(feat?.benefits) ? feat!.benefits! : [];
  return benefits.some(
    (b) => b && typeof b === 'object' && (b as Record<string, unknown>)['type'] === 'flexible_points',
  );
}

/** Nombre total de points flexibles accordés par le don (ex. 4 pour "Talent"). */
export function featFlexiblePointsTotal(feat: RawFeatData | null | undefined): number {
  const benefits = Array.isArray(feat?.benefits) ? feat!.benefits! : [];
  const b = benefits.find(
    (x) => x && typeof x === 'object' && (x as Record<string, unknown>)['type'] === 'flexible_points',
  ) as Record<string, unknown> | undefined;
  const total = b?.['total'];
  return typeof total === 'number' ? total : 0;
}

/** Coût total (en points) d'une liste de dépenses de Talent. */
export function talentSpendsTotalCost(spends: TalentSpend[] | null | undefined): number {
  return (spends ?? []).reduce((sum, s) => sum + (TALENT_SPEND_COST[s.type] ?? 0), 0);
}

/** Une dépense de Talent a-t-elle bien tous ses sous-choix requis renseignés ? */
export function isTalentSpendComplete(spend: TalentSpend): boolean {
  switch (spend.type) {
    case 'skill':
      return !!spend.skillId;
    case 'tool':
      return !!spend.toolId;
    case 'weapon':
      return !!spend.weaponId;
    case 'languages_common':
      // Le choix des langues précises se fait plus loin dans l'assistant (étape Langues), qui lit
      // le compteur de langues bonus agrégé : rien à valider ici.
      return true;
    case 'saving_throw':
      return !!spend.savingThrow;
    case 'language_exotic':
      // Idem : résolu à l'étape Langues via le compteur de langues exotiques requises.
      return true;
    case 'ability_score':
      return !!spend.abilityKey;
    case 'armor':
      return !!spend.armorTier;
    case 'expertise':
      return !!spend.expertiseSkillId;
    case 'attack_bonus':
      return !!spend.attackCategory;
    case 'cantrips':
      return (spend.cantripIds ?? []).length === 2;
    default:
      return false;
  }
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

/** Maîtrise d'outil fixe accordée par un don (seuls des noms connus sont mappés vers un id). */
const TOOL_NAME_TO_ID: Record<string, string> = {
  "nécessaire d'herboristerie": 'tl-necessaire-dherboristerie',
};

function featBonusProficienciesOfType(feat: RawFeatData | undefined, kind: string, map: Record<string, string>): string[] {
  const benefits = Array.isArray(feat?.benefits) ? feat!.benefits! : [];
  const out: string[] = [];
  for (const b of benefits) {
    if (!b || typeof b !== 'object') continue;
    const rec = b as Record<string, unknown>;
    if (rec['type'] !== 'proficiency' || rec['proficiency_type'] !== kind) continue;
    const value = typeof rec['value'] === 'string' ? rec['value'].toLowerCase().trim() : '';
    const id = map[value];
    if (id) out.push(id);
  }
  return out;
}

export function featBonusArmorProficiencies(feat: RawFeatData | undefined): string[] {
  return featBonusProficienciesOfType(feat, 'armor', ARMOR_NAME_TO_ID);
}

export function featBonusToolProficiencies(feat: RawFeatData | undefined): string[] {
  return featBonusProficienciesOfType(feat, 'tool', TOOL_NAME_TO_ID);
}

/** Mots FR (singulier ou pluriel) → id `damage-*` utilisé par l'app pour les résistances. */
const DAMAGE_WORD_TO_ID: Record<string, string> = {
  contondant: 'damage-contondant',
  contondants: 'damage-contondant',
  tranchant: 'damage-tranchant',
  tranchants: 'damage-tranchant',
  perforant: 'damage-perforant',
  perforants: 'damage-perforant',
  acide: 'damage-acide',
  feu: 'damage-feu',
  foudre: 'damage-foudre',
  froid: 'damage-froid',
  tonnerre: 'damage-tonnerre',
  poison: 'damage-poison',
  necrotique: 'damage-necrotique',
  radiant: 'damage-radiant',
  psychique: 'damage-psychique',
};

/** Un don propose-t-il un choix de résistance à un type de dégâts (ex. Gladiateur, Insensibilité élémentaire) ? */
export function featNeedsResistanceChoice(feat: RawFeatData | undefined): boolean {
  const benefits = Array.isArray(feat?.benefits) ? feat!.benefits! : [];
  return benefits.some(
    (b) =>
      b &&
      typeof b === 'object' &&
      (b as Record<string, unknown>)['type'] === 'damage_resistance' &&
      Array.isArray((b as Record<string, unknown>)['choose_from']),
  );
}

/** Options de résistance proposées par un don à choix (id `damage-*` + libellé FR d'origine). */
export function featResistanceOptions(feat: RawFeatData | undefined): { id: string; label: string }[] {
  const benefits = Array.isArray(feat?.benefits) ? feat!.benefits! : [];
  for (const b of benefits) {
    if (!b || typeof b !== 'object') continue;
    const rec = b as Record<string, unknown>;
    if (rec['type'] !== 'damage_resistance' || !Array.isArray(rec['choose_from'])) continue;
    return (rec['choose_from'] as unknown[])
      .filter((w): w is string => typeof w === 'string')
      .map((word) => ({ id: DAMAGE_WORD_TO_ID[word.toLowerCase().trim()] ?? word, label: word }))
      .filter((o) => !!o.id);
  }
  return [];
}
