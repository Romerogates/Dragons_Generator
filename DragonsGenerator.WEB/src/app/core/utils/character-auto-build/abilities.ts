import type { AbilityKey } from '@core/models/Character/character';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { ABILITY_LABEL_TO_KEY, STANDARD_ARRAY, resolveSpellcasting } from './shared';

export function primaryAbilityKeys(cls: CharacterClass): AbilityKey[] {
  const spell = resolveSpellcasting(cls, 1);
  const keys: AbilityKey[] = [];
  for (const label of cls.data.primary_abilities ?? []) {
    const key = ABILITY_LABEL_TO_KEY[label];
    if (key) keys.push(key);
  }
  if (spell?.ability) {
    const key = ABILITY_LABEL_TO_KEY[spell.ability];
    if (key && !keys.includes(key)) keys.unshift(key);
  }
  if (!keys.length) keys.push('force', 'dexterite');
  return keys;
}

export function buildStandardAbilityScores(primaryKeys: AbilityKey[]): Record<AbilityKey, number> {
  const scores: Record<AbilityKey, number> = {
    force: 8,
    dexterite: 8,
    constitution: 8,
    intelligence: 8,
    sagesse: 8,
    charisme: 8,
  };
  const arr = [...STANDARD_ARRAY];
  const order: AbilityKey[] = [
    ...primaryKeys,
    'constitution',
    'dexterite',
    'force',
    'intelligence',
    'sagesse',
    'charisme',
  ];
  const seen = new Set<AbilityKey>();
  for (const key of order) {
    if (seen.has(key) || !arr.length) continue;
    seen.add(key);
    scores[key] = arr.shift()!;
  }
  for (const key of Object.keys(scores) as AbilityKey[]) {
    if (scores[key] === 8 && arr.length) scores[key] = arr.shift()!;
  }
  return scores;
}
