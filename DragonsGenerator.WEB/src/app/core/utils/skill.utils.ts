import type { Skill } from '@core/models/Skills/skill';
import type { AbilityKey } from '@core/models/Character/character';

export interface SkillInfo {
  id: string;
  label: string;
  ability: string;
  icon: string;
}

/** ski-athletisme ↔ skill-athletisme */
export function normalizeSkillId(id: string): string {
  if (id.startsWith('ski-')) return `skill-${id.slice(4)}`;
  return id;
}

const ABILITY_LABELS: Record<string, string> = {
  FOR: 'Force',
  DEX: 'Dextérité',
  CON: 'Constitution',
  INT: 'Intelligence',
  SAG: 'Sagesse',
  CHA: 'Charisme',
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme',
};

const SKILL_ICONS: Record<string, string> = {
  'skill-acrobaties': 'fluent-emoji:person-cartwheeling',
  'skill-arcanes': 'fluent-emoji:crystal-ball',
  'skill-athletisme': 'fluent-emoji:flexed-biceps',
  'skill-discretion': 'fluent-emoji:ninja',
  'skill-dressage': 'fluent-emoji:wolf',
  'skill-escamotage': 'fluent-emoji:coin',
  'skill-histoire': 'fluent-emoji:scroll',
  'skill-intimidation': 'fluent-emoji:anger-symbol',
  'skill-intuition': 'fluent-emoji:eye',
  'skill-investigation': 'fluent-emoji:magnifying-glass-tilted-right',
  'skill-medecine': 'fluent-emoji:medical-symbol',
  'skill-nature': 'fluent-emoji:herb',
  'skill-perception': 'fluent-emoji:ear',
  'skill-persuasion': 'fluent-emoji:handshake',
  'skill-religion': 'fluent-emoji:prayer-beads',
  'skill-representation': 'fluent-emoji:performing-arts',
  'skill-survie': 'fluent-emoji:camping',
  'skill-tromperie': 'fluent-emoji:joker',
};

export function buildSkillMap(skills: Skill[]): Record<string, SkillInfo> {
  const map: Record<string, SkillInfo> = {};
  for (const skill of skills) {
    const id = normalizeSkillId(skill.id);
    map[id] = {
      id,
      label: skill.name,
      ability: ABILITY_LABELS[skill.ability] ?? skill.ability,
      icon: SKILL_ICONS[id] ?? 'fluent-emoji:bookmark-tabs',
    };
  }
  return map;
}

export function prettifySkillId(id: string, map: Record<string, SkillInfo>): string {
  const normalized = normalizeSkillId(id);
  return (
    map[normalized]?.label ??
    id
      .replace(/^skill-|^ski-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Résout une compétence (ski-* ou skill-*) depuis le catalogue chargé. */
export function resolveSkillInfo(
  id: string,
  map: Record<string, SkillInfo>,
): SkillInfo | undefined {
  return map[normalizeSkillId(id)];
}

export function formatSkillModifier(
  abilityMod: number,
  proficient: boolean,
  expertise: boolean,
  proficiencyBonus: number,
): string {
  const total =
    abilityMod + (proficient ? proficiencyBonus : 0) + (expertise ? proficiencyBonus : 0);
  return total >= 0 ? `+${total}` : `${total}`;
}

/** Caractéristique liée à une compétence (id normalisé skill-*). */
const SKILL_ABILITY_KEY: Record<string, AbilityKey> = {
  'skill-acrobaties': 'dexterite',
  'skill-arcanes': 'intelligence',
  'skill-athletisme': 'force',
  'skill-discretion': 'dexterite',
  'skill-dressage': 'sagesse',
  'skill-escamotage': 'dexterite',
  'skill-histoire': 'intelligence',
  'skill-intimidation': 'charisme',
  'skill-intuition': 'sagesse',
  'skill-investigation': 'intelligence',
  'skill-medecine': 'sagesse',
  'skill-nature': 'intelligence',
  'skill-perception': 'sagesse',
  'skill-persuasion': 'charisme',
  'skill-religion': 'intelligence',
  'skill-representation': 'charisme',
  'skill-survie': 'sagesse',
  'skill-tromperie': 'charisme',
};

export function abilityKeyForSkillId(skillId: string): AbilityKey | null {
  return SKILL_ABILITY_KEY[normalizeSkillId(skillId)] ?? null;
}
