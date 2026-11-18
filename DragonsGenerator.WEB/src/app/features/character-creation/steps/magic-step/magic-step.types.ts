import type { Subclass } from '@core/models/CharacterClasses/character-class';

export interface SpellRaw {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: { amount: number | null; unit: string | null };
  range: { amount: number | string | null; unit: string | null };
  duration: { amount: number | string | null; unit: string | null };
  components: { v: boolean; s: boolean; m: string | null };
  isRitual: boolean;
  isConcentration: boolean;
  isCorrupted: boolean;
  description: string;
  modularOptions: unknown[];
  classes: string[];
  higherLevels: string | null;
}

export interface SpellDetailEntry {
  refId: string;
  name?: string;
  level?: number;
  prepared?: boolean;
  alwaysPrepared?: boolean;
  effectSummary?: string;
}

/** Forme brouillon de `creation.spellcastingDetails` lue / écrite par l’étape Magie. */
export interface SpellcastingDetailsDraft {
  cantrips?: SpellDetailEntry[];
  spells?: SpellDetailEntry[];
  deity?: string;
  deityId?: string | null;
  mysticArcanum?: { spellLevel: number; spellId: string }[];
  spellMastery?: { spellLevel: number; spellId: string }[];
  signatureSpells?: { spellId: string }[];
  byClass?: Record<string, { cantrips?: string[]; spells?: string[]; deityId?: string | null }>;
}

export interface BonusSpellGrant {
  level_unlocked?: number;
  spells?: string[];
}

export interface SubclassWithBonusSpells extends Subclass {
  bonus_spells_granted?: BonusSpellGrant[];
  bonus_spells_by_terrain?: Record<string, { grants?: BonusSpellGrant[] }>;
}

/** subcls-domaine-de-la-vie → dom-vie */
export const SUBCLASS_TO_DOMAIN: Record<string, string> = {
  'subcls-domaine-de-la-vie': 'dom-vie',
  'subcls-domaine-de-letrange': 'dom-etrange',
  'subcls-domaine-de-la-force': 'dom-force',
  'subcls-domaine-de-lindicible': 'dom-indicible',
  'subcls-domaine-du-partage': 'dom-partage',
  'subcls-domaine-du-temps': 'dom-temps',
  'subcls-domaine-du-voyage': 'dom-voyage',
};
