import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { PROGRESSION_MAX_LEVEL, progressionData } from './shared';

/** Niveaux de sort d'Arcane débloqués pour un sorcier au niveau donné. */
export function warlockArcanumSpellLevels(characterLevel: number): number[] {
  const slots: number[] = [];
  if (characterLevel >= 11) slots.push(6);
  if (characterLevel >= 13) slots.push(7);
  if (characterLevel >= 15) slots.push(8);
  if (characterLevel >= 17) slots.push(9);
  return slots;
}

/** Jalons d'apprentissage de sorts (niv. 1–20) pour l'étape Magie. */
export function spellProgressionMilestones(
  cls: CharacterClass,
  level: number,
  maxLevel = PROGRESSION_MAX_LEVEL,
): { level: number; count: number; label: string }[] {
  const data = progressionData(cls);
  if (!data.progression) return [];
  const effective = Math.min(Math.max(1, level), maxLevel);
  const out: { level: number; count: number; label: string }[] = [];
  for (const prog of data.progression) {
    if (prog.level < 1 || prog.level > effective) continue;
    for (const sc of prog.spell_choices ?? []) {
      out.push({
        level: prog.level,
        count: sc.count ?? sc.quantity ?? 1,
        label: sc.label ?? sc.name ?? 'Sort appris',
      });
    }
    for (const active of prog.choice_pools_active ?? []) {
      if (active.type === 'spell_known') {
        out.push({
          level: prog.level,
          count: active.quantity ?? active.cumulative_total ?? 1,
          label: active.label ?? active.name ?? 'Sort connu',
        });
      }
      if (active.type === 'cantrip') {
        out.push({
          level: prog.level,
          count: active.quantity ?? 1,
          label: active.label ?? 'Tour de magie',
        });
      }
    }
  }
  return out.sort((a, b) => a.level - b.level);
}
