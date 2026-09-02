import type { FeatureInstance } from '@core/models/Character/character';

/** Normalise un ID compétence historique (ski-* → skill-*). */
export function normalizeBackgroundSkillId(skill: string): string {
  if (skill.startsWith('skill-') || skill.startsWith('ski-')) {
    return skill.startsWith('ski-') ? `skill-${skill.slice(4)}` : skill;
  }
  return skill;
}

export function mergeWeaponProficiencies(existing: string[], extra: string[]): string[] {
  return [...new Set([...existing, ...extra])];
}

export function mergeToolProficiencies(existing: string[], extra: string[]): string[] {
  return [...new Set([...existing, ...extra])];
}

/** Préfixes d'aptitudes remplacées par les choix de progression (invocations, métamagie…). */
export const CLASS_PROGRESSION_FEATURE_STRIP_PREFIXES = [
  'invoc-',
  'meta-',
  'pact-boon-',
  'ennemi-',
  'terrain-',
  'dragon-',
  'feat-astuce-',
  'feat-conquete-',
] as const;

export function stripProgressionChoiceFeatures(
  existing: FeatureInstance[],
  extras: FeatureInstance[],
): FeatureInstance[] {
  return existing.filter((f) => {
    const id = f.refId ?? '';
    if (extras.some((e) => e.refId === id)) return false;
    return !CLASS_PROGRESSION_FEATURE_STRIP_PREFIXES.some((p) => id.startsWith(p));
  });
}

/** Bascule une compétence dans la sélection (respecte le quota). */
export function toggleSkillSelection(
  selected: string[],
  skill: string,
  maxCount: number,
): string[] {
  if (selected.includes(skill)) {
    return selected.filter((s) => s !== skill);
  }
  if (selected.length < maxCount) {
    return [...selected, skill];
  }
  return selected;
}
