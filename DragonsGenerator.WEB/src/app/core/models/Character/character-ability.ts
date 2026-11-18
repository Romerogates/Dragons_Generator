import type { Ability } from '../CharacterClasses/character-class';

export type AbilityKey =
  | 'force'
  | 'dexterite'
  | 'constitution'
  | 'intelligence'
  | 'sagesse'
  | 'charisme';

export interface AbilityScores {
  force: number;
  dexterite: number;
  constitution: number;
  intelligence: number;
  sagesse: number;
  charisme: number;
}

/** Un palier ASI (ou don à la place). */
export interface AsiChoiceSlot {
  level: number;
  /** Classe d'origine du palier (multiclassage) — absent/primaire si non renseigné. */
  classId?: string | null;
  mode: 'plus2' | 'plus1plus1' | 'feat';
  primary?: AbilityKey | null;
  secondary?: AbilityKey | null;
  featId?: string | null;
  /** Caractéristique choisie quand le don propose un ASI flexible ("any" ou "X ou Y"). */
  featAbilityChoice?: AbilityKey | null;
  /** Type de dégâts choisi quand le don propose une résistance au choix (ex. Gladiateur). */
  featResistanceChoice?: string | null;
  /** Dépenses choisies quand le don utilise le système à points flexibles (ex. "Talent", 4 pts). */
  featTalentSpends?: TalentSpend[];
}

/** Type d'achat possible pour un don à points flexibles (ex. "Talent", 4 pts à répartir). */
export type TalentSpendType =
  | 'skill'
  | 'tool'
  | 'weapon'
  | 'languages_common'
  | 'saving_throw'
  | 'language_exotic'
  | 'ability_score'
  | 'armor'
  | 'expertise'
  | 'attack_bonus'
  | 'cantrips';

/** Une dépense de point choisie par le joueur pour un don à points flexibles (ex. Talent). */
export interface TalentSpend {
  id: string;
  type: TalentSpendType;
  skillId?: string | null;
  toolId?: string | null;
  weaponId?: string | null;
  languageIds?: string[];
  savingThrow?: AbilityKey | null;
  abilityKey?: AbilityKey | null;
  armorTier?: 'ar-light' | 'ar-medium' | 'ar-heavy' | null;
  expertiseSkillId?: string | null;
  attackCategory?: 'wp-cat-simple' | 'wp-cat-martial' | null;
  cantripIds?: string[];
}

export const ABILITY_KEYS: readonly AbilityKey[] = [
  'force',
  'dexterite',
  'constitution',
  'intelligence',
  'sagesse',
  'charisme',
] as const;

export const ABILITY_KEY_TO_LABEL: Record<AbilityKey, Ability> = {
  force: 'Force',
  dexterite: 'Dextérité',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  sagesse: 'Sagesse',
  charisme: 'Charisme',
};

export const ABILITY_LABEL_TO_KEY: Record<Ability, AbilityKey> = {
  Force: 'force',
  Dextérité: 'dexterite',
  Constitution: 'constitution',
  Intelligence: 'intelligence',
  Sagesse: 'sagesse',
  Charisme: 'charisme',
};

/** Impact en jeu de chaque caractéristique (verso des cartes ASI, etc.). */
export const ABILITY_IMPACT_DESC: Record<AbilityKey, string> = {
  force:
    'Puissance physique et athlétisme. Influe sur les attaques au corps à corps, les dégâts des armes de Force, la capacité de charge, ainsi que les jets d’Athlétisme (grimper, sauter, lutter).',
  dexterite:
    'Agilité, réflexes et précision. Influe sur l’initiative, la CA (sans armure lourde), les attaques à distance et fines, ainsi que Acrobaties, Discrétion et Tour de passe-passe.',
  constitution:
    'Endurance et vitalité. Détermine vos points de vie (à chaque niveau), la résistance à la fatigue, et les jets de sauvegarde liés à la santé (poison, maladie, concentration).',
  intelligence:
    'Mémoire, analyse et savoir. Sert aux sorts des magiciens, aux jets d’Arcane, Histoire, Investigation, Nature et Religion, et à la résolution de problèmes intellectuels.',
  sagesse:
    'Perception et intuition. Sert aux sorts de prêtres et druides, aux jets de Perception, Insight (intuition), Médecine, Survie et Dressage, et à repérer les dangers.',
  charisme:
    'Présence et force de personnalité. Sert aux sorts de barde, sorcier et ensorceleur, ainsi qu’à Persuasion, Tromperie, Intimidation et Représentation.',
};

export const ABILITY_POINT_COSTS: Record<number, number> = {
  6: -3,
  7: -2,
  8: -2,
  9: -1,
  10: 0,
  11: 1,
  12: 2,
  13: 3,
  14: 5,
  15: 7,
};

export const STARTING_POINTS = 15;
export const DEFAULT_ABILITY_SCORE = 10;
export const MIN_ABILITY_SCORE = 6;
export const MAX_ABILITY_SCORE = 15;

export function abilityKeyToLabel(key: AbilityKey): Ability {
  return ABILITY_KEY_TO_LABEL[key];
}

export function abilityLabelToKey(label: Ability): AbilityKey {
  return ABILITY_LABEL_TO_KEY[label];
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
