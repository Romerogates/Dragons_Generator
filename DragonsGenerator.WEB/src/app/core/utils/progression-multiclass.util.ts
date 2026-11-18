/**
 * Multiclassage (RAW 5e) : prérequis, maîtrises réduites, niveau de lanceur combiné.
 */
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { AbilityKey, AbilityScores, SpellcastingKind } from '@core/models/Character/character';

const MULTICLASS_ABILITY_KEY: Record<string, AbilityKey> = {
  str: 'force',
  dex: 'dexterite',
  con: 'constitution',
  int: 'intelligence',
  wis: 'sagesse',
  cha: 'charisme',
};

export interface MulticlassPrerequisites {
  /** Toutes ces caractéristiques doivent être ≥ 13 (ex. Paladin : Force ET Charisme). */
  all?: string[];
  /** Au moins une de ces caractéristiques doit être ≥ 13 (ex. Guerrier : Force OU Dextérité). */
  any?: string[];
}

const MULTICLASS_PREREQUISITE_SCORE = 13;

export function multiclassPrerequisitesMet(
  cls: CharacterClass,
  abilities: AbilityScores,
): boolean {
  const raw = (cls.data as Record<string, unknown>)['multiclass_prerequisites'] as
    | MulticlassPrerequisites
    | undefined;
  if (!raw) return true;
  const scoreFor = (code: string): number => {
    const key = MULTICLASS_ABILITY_KEY[code.toLowerCase()];
    return key ? (abilities[key] ?? 0) : 0;
  };
  if (raw.all?.length && !raw.all.every((code) => scoreFor(code) >= MULTICLASS_PREREQUISITE_SCORE)) {
    return false;
  }
  if (raw.any?.length && !raw.any.some((code) => scoreFor(code) >= MULTICLASS_PREREQUISITE_SCORE)) {
    return false;
  }
  return true;
}

export function multiclassPrerequisitesPossibleAtMaxBuy(
  cls: CharacterClass,
  racialBonuses: Partial<AbilityScores> = {},
  maxBuyScore = 15,
): boolean {
  const maxScores: AbilityScores = {
    force: maxBuyScore + (racialBonuses.force ?? 0),
    dexterite: maxBuyScore + (racialBonuses.dexterite ?? 0),
    constitution: maxBuyScore + (racialBonuses.constitution ?? 0),
    intelligence: maxBuyScore + (racialBonuses.intelligence ?? 0),
    sagesse: maxBuyScore + (racialBonuses.sagesse ?? 0),
    charisme: maxBuyScore + (racialBonuses.charisme ?? 0),
  };
  return multiclassPrerequisitesMet(cls, maxScores);
}

export function multiclassPrerequisiteLabel(cls: CharacterClass): string | null {
  const raw = (cls.data as Record<string, unknown>)['multiclass_prerequisites'] as
    | MulticlassPrerequisites
    | undefined;
  if (!raw) return null;
  const labelFor = (code: string) => {
    const map: Record<string, string> = {
      str: 'Force',
      dex: 'Dextérité',
      con: 'Constitution',
      int: 'Intelligence',
      wis: 'Sagesse',
      cha: 'Charisme',
    };
    return `${map[code.toLowerCase()] ?? code} ${MULTICLASS_PREREQUISITE_SCORE}`;
  };
  const parts: string[] = [];
  if (raw.all?.length) parts.push(raw.all.map(labelFor).join(' et '));
  if (raw.any?.length) parts.push(raw.any.map(labelFor).join(' ou '));
  return parts.length ? parts.join(' et ') : null;
}

export interface MulticlassProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  skillChooseCount: number;
  skillOptions: string[];
}

const EMPTY_MULTICLASS_PROFICIENCIES: MulticlassProficiencies = {
  armor: [],
  weapons: [],
  tools: [],
  skillChooseCount: 0,
  skillOptions: [],
};

export function multiclassProficiencies(cls: CharacterClass): MulticlassProficiencies {
  const raw = (cls.data as Record<string, unknown>)['multiclass_proficiencies'] as
    | Partial<MulticlassProficiencies>
    | undefined;
  if (!raw) return EMPTY_MULTICLASS_PROFICIENCIES;
  return {
    armor: raw.armor ?? [],
    weapons: raw.weapons ?? [],
    tools: raw.tools ?? [],
    skillChooseCount: raw.skillChooseCount ?? 0,
    skillOptions: raw.skillOptions ?? [],
  };
}

const FULL_CASTER_KINDS = new Set<SpellcastingKind>(['wizard', 'sorcerer', 'cleric', 'druid', 'bard']);
const HALF_CASTER_KINDS = new Set<SpellcastingKind>(['ranger', 'paladin']);
const THIRD_CASTER_KINDS = new Set<SpellcastingKind>(['fighter_eldritch_knight']);

function casterLevelFraction(kind: SpellcastingKind | null | undefined): 'full' | 'half' | 'third' | null {
  if (!kind) return null;
  if (FULL_CASTER_KINDS.has(kind)) return 'full';
  if (HALF_CASTER_KINDS.has(kind)) return 'half';
  if (THIRD_CASTER_KINDS.has(kind)) return 'third';
  return null;
}

export function combinedCasterLevel(
  entries: { level: number; spellcastingKind: SpellcastingKind | null | undefined }[],
): number {
  let total = 0;
  for (const entry of entries) {
    const fraction = casterLevelFraction(entry.spellcastingKind);
    if (!fraction) continue;
    if (fraction === 'full') total += entry.level;
    else if (fraction === 'half') total += Math.floor(entry.level / 2);
    else total += Math.floor(entry.level / 3);
  }
  return total;
}

export const MULTICLASS_SPELL_SLOTS_TABLE: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export function multiclassSpellSlotsForCasterLevel(casterLevel: number): { level: number; max: number }[] {
  if (casterLevel < 1) return [];
  const row = MULTICLASS_SPELL_SLOTS_TABLE[Math.min(20, casterLevel) - 1];
  return row
    .map((max, idx) => ({ level: idx + 1, max }))
    .filter((s) => s.max > 0);
}
