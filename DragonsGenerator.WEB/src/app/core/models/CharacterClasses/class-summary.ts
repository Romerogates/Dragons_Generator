import { Ability } from './character-class';

export interface ClassSummary {
  id: string;
  name: string;
  hitDie: number;
  primaryAbilities: Ability[];
  hasSpellcasting: boolean;
}
