import type { Language } from '@core/models/Languages/language';
import type { Skill } from '@core/models/Skills/skill';
import { buildSkillMap, type SkillInfo } from '@core/utils/skill.utils';
import { pickRandomSubset } from './random';

export function pickBonusLanguages(languages: Language[], locked: Set<string>, count: number): string[] {
  const pool = languages
    .filter((l) => l.category === 'base' && !locked.has(l.name) && !l.speakers?.isExtinct)
    .map((l) => l.name);
  return pickRandomSubset(pool, count);
}

export function createSkillMapFromList(skills: Skill[]): Record<string, SkillInfo> {
  return buildSkillMap(skills);
}
