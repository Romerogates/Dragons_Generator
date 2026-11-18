import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { extractProgressionChoices } from './extract';
import {
  PROGRESSION_MAX_LEVEL,
  type ClassChoicePool,
  type ProgressionChoiceDef,
  featureUnlockLevel,
  poolActiveAtLevel,
  poolQuantityAtLevel,
  progressionData,
} from './shared';

export function extractExpertiseChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): ProgressionChoiceDef[] {
  return extractProgressionChoices(cls, level, maxLevel).filter(
    (c) => c.deferred && (c.type === 'expertise' || c.type === 'expertise_proficiency'),
  );
}

export function extractWeaponProficiencyChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): ProgressionChoiceDef[] {
  const fromRoot = extractProgressionChoices(cls, level, maxLevel).filter(
    (c) => c.deferred && c.type === 'weapon_proficiency',
  );
  const fromSubclass = extractSubclassWeaponProficiencyChoices(cls, level, maxLevel, subclassId);
  const seen = new Set(fromRoot.map((c) => c.id));
  return [...fromRoot, ...fromSubclass.filter((c) => !seen.has(c.id))];
}

/** Armes de sous-classe (ex. Mage de Guerre) différées vers l'étape Savoirs. */
function extractSubclassWeaponProficiencyChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): ProgressionChoiceDef[] {
  if (!subclassId) return [];
  const data = progressionData(cls);
  const subs = data.subclasses as
    | { options?: { id?: string; choice_pools?: ClassChoicePool[] }[] }
    | { id?: string; choice_pools?: ClassChoicePool[] }[]
    | undefined;
  if (!subs) return [];

  const options = Array.isArray(subs) ? subs : (subs.options ?? []);
  const sub = options.find((o) => o.id === subclassId);
  if (!sub?.choice_pools?.length) return [];

  const effective = Math.min(Math.max(1, level), maxLevel);
  const out: ProgressionChoiceDef[] = [];
  for (const pool of sub.choice_pools) {
    if (String(pool.type ?? '') !== 'weapon_proficiency') continue;
    if (!poolActiveAtLevel(pool, effective)) continue;
    out.push({
      id: pool.id ?? `choice-weapon-${subclassId}`,
      type: 'weapon_proficiency',
      label: pool.name ?? 'Armes maîtrisées',
      count: poolQuantityAtLevel(pool, effective),
      options: [],
      deferred: true,
      meta: {
        poolIds: pool.pool ?? pool.options ?? [],
        maxPricePo:
          typeof pool.constraint_max_price_po === 'number'
            ? pool.constraint_max_price_po
            : undefined,
      },
    });
  }
  return out;
}

export function extractToolProficiencyChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): ProgressionChoiceDef[] {
  const fromRoot = extractProgressionChoices(cls, level, maxLevel).filter(
    (c) => c.deferred && c.type === 'tool_proficiency',
  );
  const fromSubclass = extractSubclassToolProficiencyChoices(cls, level, maxLevel, subclassId);
  const seen = new Set(fromRoot.map((c) => c.id));
  return [...fromRoot, ...fromSubclass.filter((c) => !seen.has(c.id))];
}

/** Outils de sous-classe (ex. Espion matériel de jeu) différés vers Savoirs. */
function extractSubclassToolProficiencyChoices(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): ProgressionChoiceDef[] {
  if (!subclassId) return [];
  const data = progressionData(cls);
  const subs = data.subclasses as
    | {
        options?: {
          id?: string;
          choice_pools?: ClassChoicePool[];
          features?: { id?: string; level?: number; mechanics?: Record<string, unknown> }[];
          features_details?: { id?: string; level?: number; mechanics?: Record<string, unknown> }[];
        }[];
      }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return [];

  const effective = Math.min(Math.max(1, level), maxLevel);
  const out: ProgressionChoiceDef[] = [];

  for (const pool of sub.choice_pools ?? []) {
    if (String(pool.type ?? '') !== 'tool_proficiency') continue;
    if (!poolActiveAtLevel(pool, effective)) continue;
    out.push({
      id: pool.id ?? `choice-tool-${subclassId}`,
      type: 'tool_proficiency',
      label: pool.name ?? "Maîtrises d'outils",
      count: poolQuantityAtLevel(pool, effective),
      options: [],
      deferred: true,
      meta: { poolIds: pool.pool ?? pool.options ?? [] },
    });
  }

  const feats = [...(sub.features ?? []), ...(sub.features_details ?? [])];
  for (const feat of feats) {
    const featLevel = featureUnlockLevel(feat as Record<string, unknown>);
    if (featLevel > effective) continue;
    const choice = feat.mechanics?.['grants_tool_proficiency_choice'] as
      | { type?: string; pool?: unknown[]; quantity?: number }
      | undefined;
    if (!choice) continue;
    out.push({
      id: `choice-tool-${feat.id ?? subclassId}`,
      type: 'tool_proficiency',
      label: "Matériel de jeu (Espion)",
      count: choice.quantity ?? 1,
      options: [],
      deferred: true,
      meta: { poolIds: choice.pool ?? [] },
    });
  }

  return out;
}

/** Jetons de pool signalant une contrainte « doit être une langue exotique » (ex. Prêtre
 * `category-exotic-languages`, Magicien `lang-category-exotique`, Sorcier `lang-exotic`). */
const EXOTIC_LANGUAGE_POOL_TOKENS = new Set([
  'category-exotic-languages',
  'category-exotique-languages',
  'lang-category-exotique',
  'lang-exotic',
  'lang-exotique',
]);

/** Jetons de pool signalant une contrainte « doit être une langue courante » (ex. Barde
 * `category-common-languages` "Langues communes"). */
const BASE_LANGUAGE_POOL_TOKENS = new Set([
  'category-common-languages',
  'category-base-languages',
  'lang-category-commune',
  'lang-common',
  'lang-commune',
]);

/** Langues supplémentaires de classe (ex. Lettré ×3, Espion) → étape Langues. */
export function classBonusLanguageCount(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
  subclassId?: string | null,
): number {
  const pools = progressionData(cls).choice_pools;
  const effective = Math.min(Math.max(1, level), maxLevel);
  let total = 0;
  if (pools?.length) {
    for (const pool of pools) {
      const type = String(pool.type ?? '');
      if (type !== 'language_proficiency' && type !== 'language') continue;
      if (!poolActiveAtLevel(pool, effective)) continue;
      total += poolQuantityAtLevel(pool, effective);
    }
  }
  total += subclassBonusLanguageCount(cls, effective, subclassId);
  return total;
}

/** Compte les slots des choix racine `language_proficiency`/`language` de classe dont le `pool`
 * JSON ne contient QUE des jetons de `matchTokens` (ex. uniquement exotique, ou uniquement
 * courant) — un pool générique ("any"/mixte) ne compte pas comme restreint. */
function classRootLanguagePoolCountMatching(
  cls: CharacterClass,
  level: number,
  maxLevel: number,
  matchTokens: Set<string>,
): number {
  const pools = progressionData(cls).choice_pools;
  const effective = Math.min(Math.max(1, level), maxLevel);
  let total = 0;
  if (pools?.length) {
    for (const pool of pools) {
      const type = String(pool.type ?? '');
      if (type !== 'language_proficiency' && type !== 'language') continue;
      if (!poolActiveAtLevel(pool, effective)) continue;
      const raw = (pool as { pool?: unknown; options?: unknown }).pool ?? (pool as { options?: unknown }).options ?? [];
      const tokens = Array.isArray(raw) ? raw.map(String) : [];
      if (tokens.length > 0 && tokens.every((t) => matchTokens.has(t))) {
        total += poolQuantityAtLevel(pool, effective);
      }
    }
  }
  return total;
}

/**
 * Parmi les langues bonus de `classBonusLanguageCount`, combien doivent obligatoirement être
 * exotiques d'après le `pool` du choix racine de classe (ex. Prêtre "Langue exotique", Magicien,
 * Sorcier). Contrairement au pool générique ("any"), un pool ne contenant QUE des jetons exotiques
 * restreint tout le choix — sans ça, le joueur peut piocher une langue courante à la place.
 */
export function classRootRequiredExoticLanguageCount(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): number {
  return classRootLanguagePoolCountMatching(cls, level, maxLevel, EXOTIC_LANGUAGE_POOL_TOKENS);
}

/**
 * Symétrique de `classRootRequiredExoticLanguageCount` pour les pools restreints aux langues
 * courantes (ex. Barde "Langues communes" ×2) : sans cette contrainte, le joueur pouvait piocher
 * une langue exotique à la place dans le pool bonus générique.
 */
export function classRootRequiredBaseLanguageCount(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): number {
  return classRootLanguagePoolCountMatching(cls, level, maxLevel, BASE_LANGUAGE_POOL_TOKENS);
}

function subclassBonusLanguageCount(
  cls: CharacterClass,
  level: number,
  subclassId?: string | null,
): number {
  if (!subclassId) return 0;
  const data = progressionData(cls);
  const subs = data.subclasses as
    | {
        options?: {
          id?: string;
          features?: { level?: number; mechanics?: Record<string, unknown> }[];
          features_details?: { level?: number; mechanics?: Record<string, unknown> }[];
        }[];
      }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return 0;

  let total = 0;
  const feats = [...(sub.features ?? []), ...(sub.features_details ?? [])];
  for (const feat of feats) {
    const bonuses = feat.mechanics?.['language_bonus'] as
      | { at_level?: number; quantity?: number }[]
      | undefined;
    if (!Array.isArray(bonuses)) continue;
    for (const b of bonuses) {
      if ((b.at_level ?? 99) <= level) total += b.quantity ?? 1;
    }
  }
  return total;
}

/** Outils fixes accordés par une sous-classe (ex. Espion déguisement / faussaire). */
export function subclassFixedToolProficiencies(
  cls: CharacterClass,
  level: number,
  subclassId?: string | null,
): string[] {
  if (!subclassId) return [];
  const data = progressionData(cls);
  const subs = data.subclasses as
    | {
        options?: {
          id?: string;
          features?: { level?: number; mechanics?: Record<string, unknown> }[];
          features_details?: { level?: number; mechanics?: Record<string, unknown> }[];
        }[];
      }
    | undefined;
  const options = Array.isArray(subs) ? subs : (subs?.options ?? []);
  const sub = options.find((o) => o?.id === subclassId);
  if (!sub) return [];

  const tools: string[] = [];
  const feats = [...(sub.features ?? []), ...(sub.features_details ?? [])];
  for (const feat of feats) {
    if (featureUnlockLevel(feat as Record<string, unknown>) > level) continue;
    const granted = feat.mechanics?.['grants_tool_proficiencies'];
    if (Array.isArray(granted)) {
      for (const id of granted) {
        if (typeof id === 'string' && id.trim()) tools.push(id.trim());
      }
    }
  }
  return [...new Set(tools)];
}
