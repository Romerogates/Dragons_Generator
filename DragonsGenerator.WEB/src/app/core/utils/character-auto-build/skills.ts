import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { extractToolProficiencyChoices, extractWeaponProficiencyChoices } from '@core/utils/progression-choices.util';
import { normalizeSkillId, type SkillInfo } from '@core/utils/skill.utils';
import { pickRandomSubset } from './random';

export function autoPickClassSkills(
  skillOptions: string[],
  chooseCount: number,
  skillMap: Record<string, SkillInfo>,
  taken: Set<string>,
): string[] {
  const pool =
    !skillOptions.length || skillOptions.some((o) => o === 'any' || o === 'any-skills')
      ? Object.keys(skillMap)
      : skillOptions.map(normalizeSkillId);
  return pickRandomSubset(
    pool.filter((id) => !taken.has(normalizeSkillId(id))),
    chooseCount,
  ).map(normalizeSkillId);
}

export function autoResolveClassProficiencies(
  cls: CharacterClass,
  weaponCatalog: { id: string; costPo: number }[],
  toolCatalog: { id: string }[],
  existingWeapons: string[],
  existingTools: string[],
): { weapons: string[]; tools: string[]; answers: Record<string, string[]> } {
  const answers: Record<string, string[]> = {};
  const extraWeapons: string[] = [];
  const extraTools: string[] = [];
  const weaponBase = new Set(existingWeapons);

  for (const choice of extractWeaponProficiencyChoices(cls, 1)) {
    const maxPrice = choice.meta?.['maxPricePo'] as number | undefined;
    const pool = weaponCatalog
      .filter((w) => !weaponBase.has(w.id) && (maxPrice == null || w.costPo <= maxPrice))
      .map((w) => w.id);
    const picks = pickRandomSubset(pool, choice.count || 1);
    answers[choice.id] = picks;
    extraWeapons.push(...picks);
    picks.forEach((id) => weaponBase.add(id));
  }

  const toolBase = new Set(existingTools);
  for (const choice of extractToolProficiencyChoices(cls, 1)) {
    const pool = toolCatalog.filter((t) => !toolBase.has(t.id)).map((t) => t.id);
    const picks = pickRandomSubset(pool, choice.count || 1);
    answers[choice.id] = picks;
    extraTools.push(...picks);
    picks.forEach((id) => toolBase.add(id));
  }

  return { weapons: extraWeapons, tools: extraTools, answers };
}
