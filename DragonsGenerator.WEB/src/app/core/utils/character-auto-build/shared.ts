import type { Ability, AbilityKey, SpellcastingKind } from '@core/models/Character/character';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { resolveClassSpellcasting } from '@core/utils/class-spellcasting.util';

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export const ABILITY_LABEL_TO_KEY: Record<string, AbilityKey> = {
  Force: 'force',
  Dextérité: 'dexterite',
  Constitution: 'constitution',
  Intelligence: 'intelligence',
  Sagesse: 'sagesse',
  Charisme: 'charisme',
};

export const SAVE_CODE_TO_LABEL: Record<string, Ability> = {
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme',
};

export function isFightingStylePool(pool: Record<string, unknown>): boolean {
  const t = String(pool['type'] ?? '');
  const id = String(pool['id'] ?? '');
  return (
    t === 'fighting_style' ||
    /style.*combat|combat.*style|fighting.?style/i.test(id + t) ||
    (t === 'feature_option' && /style|combat|fighting/i.test(id))
  );
}

export function resolveSpellcasting(
  cls: CharacterClass,
  level: number,
): { kind: SpellcastingKind; ability: Ability } | null {
  return resolveClassSpellcasting(cls.id, level);
}
