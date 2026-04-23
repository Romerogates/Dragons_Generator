// core/models/Spells/spell-summary.ts

export interface SpellSummary {
  id: string;
  name: string;
  level: number;
  school: string;
  isRitual: boolean;
  isConcentration: boolean;
  isCorrupted: boolean;
}
