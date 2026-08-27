import { CreatureSummary } from '@core/models/Creatures/creature-summary';
import { CreatureRole, StoryCreatureSelection } from '@core/models/Story/story';
import { parseChallengeRating } from './creature-display.util';

export interface LevelRangePreset {
  id: string;
  label: string;
  min: number;
  max: number;
  /** FP minimum pour les créatures secondaires */
  fpMin: number;
  /** FP maximum pour les créatures secondaires */
  fpMax: number;
  /** FP maximum pour l'antagoniste principal */
  bossFpMax: number;
}

export const LEVEL_RANGE_PRESETS: LevelRangePreset[] = [
  { id: '1-2', label: 'Niveaux 1–2', min: 1, max: 2, fpMin: 0, fpMax: 0.5, bossFpMax: 1 },
  { id: '3-4', label: 'Niveaux 3–4', min: 3, max: 4, fpMin: 0.25, fpMax: 2, bossFpMax: 3 },
  { id: '5-6', label: 'Niveaux 5–6', min: 5, max: 6, fpMin: 1, fpMax: 4, bossFpMax: 5 },
  { id: '7-8', label: 'Niveaux 7–8', min: 7, max: 8, fpMin: 2, fpMax: 5, bossFpMax: 7 },
  { id: '9-10', label: 'Niveaux 9–10', min: 9, max: 10, fpMin: 4, fpMax: 7, bossFpMax: 9 },
  { id: '11-12', label: 'Niveaux 11–12', min: 11, max: 12, fpMin: 6, fpMax: 10, bossFpMax: 12 },
  { id: '13-14', label: 'Niveaux 13–14', min: 13, max: 14, fpMin: 8, fpMax: 12, bossFpMax: 14 },
  { id: '15-16', label: 'Niveaux 15–16', min: 15, max: 16, fpMin: 10, fpMax: 15, bossFpMax: 17 },
  { id: '17-20', label: 'Niveaux 17–20', min: 17, max: 20, fpMin: 12, fpMax: 20, bossFpMax: 24 },
];

export function getLevelRangePreset(id: string): LevelRangePreset | undefined {
  return LEVEL_RANGE_PRESETS.find((p) => p.id === id);
}

export function partyLevelFromRange(preset: LevelRangePreset): number {
  return Math.round((preset.min + preset.max) / 2);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function creatureFp(creature: CreatureSummary): number {
  return parseChallengeRating(creature.challengeRating);
}

function toSelection(
  creature: CreatureSummary,
  role: CreatureRole,
): StoryCreatureSelection {
  return {
    creatureId: creature.id,
    creatureName: creature.name,
    category: creature.category,
    challengeRating: creature.challengeRating,
    customName: creature.name,
    role,
    backstory: '',
  };
}

/** Choisit automatiquement des créatures adaptées à une plage de niveau. */
export function pickCreaturesForLevelRange(
  allCreatures: CreatureSummary[],
  preset: LevelRangePreset,
  count: number,
): StoryCreatureSelection[] {
  const target = Math.min(Math.max(count, 3), 15);

  const inSecondaryRange = allCreatures.filter((c) => {
    const fp = creatureFp(c);
    return fp >= preset.fpMin && fp <= preset.fpMax;
  });

  const bossCandidates = allCreatures.filter((c) => {
    const fp = creatureFp(c);
    return fp >= preset.fpMin && fp <= preset.bossFpMax;
  });

  if (inSecondaryRange.length === 0 && bossCandidates.length === 0) {
    return [];
  }

  const pool = inSecondaryRange.length > 0 ? inSecondaryRange : bossCandidates;
  const bossPool = bossCandidates.length > 0 ? bossCandidates : pool;

  const usedIds = new Set<string>();
  const picked: StoryCreatureSelection[] = [];

  const bossSorted = [...bossPool].sort((a, b) => creatureFp(b) - creatureFp(a));
  const antagonist = bossSorted.find((c) => !usedIds.has(c.id)) ?? bossSorted[0];
  if (antagonist) {
    usedIds.add(antagonist.id);
    picked.push(toSelection(antagonist, 'antagonist'));
  }

  const allySorted = shuffle(
    pool.filter((c) => !usedIds.has(c.id) && creatureFp(c) <= preset.fpMax * 0.6),
  );
  const ally = allySorted[0] ?? shuffle(pool.filter((c) => !usedIds.has(c.id)))[0];
  if (ally && picked.length < target) {
    usedIds.add(ally.id);
    picked.push(toSelection(ally, 'ally'));
  }

  const remaining = shuffle(pool.filter((c) => !usedIds.has(c.id)));
  const roles: CreatureRole[] = ['neutral', 'wildcard', 'neutral', 'neutral'];
  for (const creature of remaining) {
    if (picked.length >= target) break;
    usedIds.add(creature.id);
    picked.push(toSelection(creature, roles[picked.length - 2] ?? 'neutral'));
  }

  if (picked.length < target) {
    const extras = shuffle(
      allCreatures.filter((c) => !usedIds.has(c.id) && creatureFp(c) <= preset.bossFpMax),
    );
    for (const creature of extras) {
      if (picked.length >= target) break;
      picked.push(toSelection(creature, 'neutral'));
    }
  }

  return picked;
}
