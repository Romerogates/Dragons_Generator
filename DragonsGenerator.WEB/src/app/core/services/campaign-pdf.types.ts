import type { Creature } from '@core/models/Creatures/creature';

export interface CreaturePrintEntry {
  creature: Creature;
  customName?: string;
  role?: string;
  backstory?: string;
}

export interface PlayerGmSummary {
  name: string;
  species: string;
  className: string;
  armorClass: number | string;
  hitPoints: number | string;
  initiative: number | string;
  attacks: string;
}
