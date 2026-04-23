export type Ability =
  | 'Force'
  | 'Dextérité'
  | 'Constitution'
  | 'Intelligence'
  | 'Sagesse'
  | 'Charisme';

export interface ItemRef {
  id: string;
  qty: number;
}

export interface EquipmentSlot {
  slot: number;
  description?: string;
  fixed?: ItemRef[];
  alternatives?: ItemRef[][];
}

export interface Proficiencies {
  armor: string[];
  weapons: string[];
  saving_throws: Ability[];
  tools?: string[];
  skills: {
    count: number;
    options: string[];
  };
}

export interface ProgressionLevel {
  level: number;
  prof_bonus: number;
  features: string[];
  feature_upgrades?: string[];
  resources?: Record<string, string | number>;
  // Champs optionnels selon la classe (lanceurs de sorts, moine, etc.)
  cantrips_known?: number;
  spells_known?: number;
  spell_slots?: Record<string, number>;
  [key: string]: unknown;
}

export interface FeatureDetail {
  id: string;
  name: string;
  desc: string;
  level?: number;
  [key: string]: unknown;
}

export interface Subclass {
  id: string;
  name: string;
  desc?: string;
  features?: FeatureDetail[];
  [key: string]: unknown;
}

export interface Spellcasting {
  ability: Ability;
  ritual?: boolean;
  focus?: string;
  [key: string]: unknown;
}

export interface CharacterClassData {
  hit_die: number;
  primary_abilities: Ability[];
  proficiencies: Proficiencies;
  starting_equipment: EquipmentSlot[];
  progression: ProgressionLevel[];
  features_details?: FeatureDetail[];
  subclasses?: Subclass[];
  spellcasting?: Spellcasting;
  // Spécifiques (moine, sorcier…)
  ki_powers?: FeatureDetail[];
  pact_boons?: FeatureDetail[];
  invocations?: (FeatureDetail & { prerequisites?: Record<string, unknown> })[];
  [key: string]: unknown;
}

export interface CharacterClass {
  id: string;
  name: string;
  data: CharacterClassData;
}
