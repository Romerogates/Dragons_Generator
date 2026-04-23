// core/utils/ability-mapping.ts
//
// L'API retourne des codes courts (str, dex, con, int, wis, cha)
// tandis que le modèle Character utilise des clés françaises
// (force, dexterite, constitution, intelligence, sagesse, charisme).
// Ce fichier fait le pont.

import type { AbilityKey, AbilityScores } from '../models/Character/character';

const API_CODE_TO_KEY: Record<string, AbilityKey> = {
  str: 'force',
  dex: 'dexterite',
  con: 'constitution',
  int: 'intelligence',
  wis: 'sagesse',
  cha: 'charisme',
};

const KEY_TO_API_CODE: Record<AbilityKey, string> = {
  force: 'str',
  dexterite: 'dex',
  constitution: 'con',
  intelligence: 'int',
  sagesse: 'wis',
  charisme: 'cha',
};

/** Convertit un code API (str, dex…) en AbilityKey (force, dexterite…). */
export function apiCodeToAbilityKey(code: string): AbilityKey | null {
  return API_CODE_TO_KEY[code.toLowerCase()] ?? null;
}

/** Convertit une AbilityKey en code API. */
export function abilityKeyToApiCode(key: AbilityKey): string {
  return KEY_TO_API_CODE[key];
}

/**
 * Convertit un objet `{ str: 2, cha: 1 }` de l'API
 * en `Partial<AbilityScores>` `{ force: 2, charisme: 1 }`.
 */
export function apiAsiToPartialScores(
  asi: Record<string, number> | null | undefined,
): Partial<AbilityScores> {
  if (!asi) return {};
  const result: Partial<AbilityScores> = {};
  for (const [code, value] of Object.entries(asi)) {
    const key = apiCodeToAbilityKey(code);
    if (key && value) {
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

/**
 * Fusionne plusieurs Partial<AbilityScores> en un seul.
 * Ex: mergePartialScores({ force: 2 }, { force: 1, charisme: 1 })
 *   → { force: 3, charisme: 1 }
 */
export function mergePartialScores(...parts: Partial<AbilityScores>[]): Partial<AbilityScores> {
  const result: Partial<AbilityScores> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part) as [AbilityKey, number][]) {
      if (value) {
        result[key] = (result[key] ?? 0) + value;
      }
    }
  }
  return result;
}
