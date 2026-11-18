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
  armor?: string[] | string | null;
  weapons?: string[] | string | null;
  saving_throws?: Ability[] | string[];
  tools?: string[] | string | null;
  skills?: {
    count?: number;
    options?: string[] | null;
  };
}

export interface ProgressionLevel {
  level: number;
  prof_bonus?: number;
  features?: string[];
  feature_upgrades?: string[];
  resources?: Record<string, unknown>;
  // Champs optionnels selon la classe (lanceurs de sorts, moine, etc.)
  cantrips_known?: number;
  spells_known?: number;
  spell_slots?: Record<string, number>;
  choice_pools_active?: {
    type?: string;
    quantity?: number;
    cumulative_total?: number;
    pool?: unknown[];
    label?: string;
    name?: string;
  }[];
  invocation_choices?: { count?: number }[];
  spell_choices?: { count?: number; quantity?: number; label?: string; name?: string }[];
  pact_boon_choices?: {
    id?: string;
    pool?: string[];
    options?: string[];
    label?: string;
    count?: number;
    quantity?: number;
  }[];
  skill_choices?: {
    id?: string;
    type?: string;
    label?: string;
    name?: string;
    quantity?: number;
    count?: number;
  }[];
  level_up_choice_pools?: {
    id?: string;
    name?: string;
    quantity?: number;
    pool_ref?: string;
    pool?: unknown[];
    type?: string;
  }[];
  [key: string]: unknown;
}

export interface FeatureDetail {
  id: string;
  name?: string;
  desc?: string;
  level?: number;
  [key: string]: unknown;
}

export interface SubclassChoice {
  id?: string;
  type?: string;
  count?: number;
  level_required?: number;
  label?: string;
  options?: unknown[];
  option_labels?: Record<string, string>;
  option_descs?: Record<string, string>;
}

export interface Subclass {
  id: string;
  name?: string;
  desc?: string;
  features?: FeatureDetail[];
  sub_choices?: SubclassChoice[];
  [key: string]: unknown;
}

/** Catalogue JSON : `{ "options": [ … ] }` ou tableau direct. */
export interface SubclassCatalog {
  options?: Subclass[];
  unlocked_at_level?: number;
  level_unlocked?: number;
}

export interface Spellcasting {
  ability: Ability | string;
  ritual?: boolean;
  focus?: string;
  [key: string]: unknown;
}

/** Pools JSON de classe (styles de combat, compétences, astuces…). */
export interface ClassChoicePool {
  id?: string;
  type?: string;
  name?: string;
  quantity?: number;
  pool?: unknown[];
  options?: unknown[];
  unlocked_at_level?: number;
  unlock_level?: number;
  level_unlocked?: number;
  unlocked_at_levels?: number[];
  constraint_max_price_po?: number;
  fixed_features?: string[];
}

export interface CharacterClassData {
  hit_die: number;
  primary_abilities: Ability[];
  proficiencies: Proficiencies;
  starting_equipment: EquipmentSlot[];
  progression: ProgressionLevel[];
  features_details?: FeatureDetail[];
  subclasses?: Subclass[] | SubclassCatalog;
  choice_pools?: ClassChoicePool[];
  spellcasting?: Spellcasting;
  flavor?: { summary?: string; lore_note?: string; loreNote?: string };
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
