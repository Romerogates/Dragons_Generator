import type { Ability } from '@core/models/Character/character';
import type { ClassStepPhase } from '@core/utils/class-step-flow.util';

export interface ClassStepCardOption {
  id: string;
  title: string;
  subtitle?: string;
  desc: string;
  stats?: string;
  badge?: string;
  icon: string;
  emoji?: string;
}

export interface FeatureMechanicsOption {
  id?: string;
  name?: string;
  description?: string;
  desc?: string;
}

export interface FeatureJson {
  id: string;
  name: string;
  level: number;
  desc: string;
  rechargeType?: 'unlimited' | 'short_rest' | 'long_rest' | 'special';
  recharge?: string;
  resource_key?: string;
  unlocks_at_level?: number;
  uses?:
    | number
    | {
        formula?: string;
        base?: number;
        source_column?: string;
        null_means_unlimited?: boolean;
        upgrades?: { at_level: number; value: number }[];
      };
  mechanics?: {
    points_formula?: string;
    uses_key?: string;
    upgrades?: { at_level: number; uses?: number; value?: number }[];
    options?: FeatureMechanicsOption[];
    range_m_initial?: number;
    range_m_improved?: number;
    range_improves_at_level?: number;
    [key: string]: unknown;
  };
  resolves_to_choice_pool?: string;
}

export type ClassStepPhaseAlias = ClassStepPhase;

export interface SubChoice {
  id: string;
  type: string;
  count: number;
  level_required: number;
  label: string;
  options: string[];
  option_labels?: Record<string, string>;
  option_descs?: Record<string, string>;
}

export interface SubclassOption {
  id: string;
  name: string;
  desc: string;
  features: FeatureJson[];
  sub_choices?: SubChoice[];
  [key: string]: unknown;
}

export interface SubclassesConfig {
  name: string;
  level_unlocked: number;
  options: SubclassOption[];
}

export const ABILITY_CODE_TO_LABEL: Record<string, Ability> = {
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme',
};
