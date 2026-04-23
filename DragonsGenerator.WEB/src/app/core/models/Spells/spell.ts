// core/models/Spells/spell.ts

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: CastingTime;
  range: SpellRange;
  duration: SpellDuration;
  components: SpellComponents;
  isRitual: boolean;
  isConcentration: boolean;
  isCorrupted: boolean;
  description: string;
  modularOptions: ModularOption[];
  classes: string[];
  higherLevels?: string | null;
}

export interface CastingTime {
  amount: number | string | null;
  unit: string | null;
}

export interface SpellRange {
  amount: number | string | null;
  unit: string | null;
}

export interface SpellDuration {
  amount: number | string | null;
  unit: string | null;
}

export interface SpellComponents {
  v: boolean;
  s: boolean;
  m: string | null;
}

export interface ModularOption {
  name: string;
  description: string;
}
