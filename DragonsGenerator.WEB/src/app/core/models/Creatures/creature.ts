export interface CreatureAbility {
  score: number;
  modifier: string;
}

export interface CreatureNamedEntry {
  name: string;
  description: string;
}

export interface Creature {
  id: string;
  name: string;
  category: string;
  part: string | null;
  section: string | null;
  type: string;
  armorClass: number;
  armorNote: string | null;
  hitPoints: string;
  woundThreshold: number | null;
  speed: string;
  abilities: Record<string, CreatureAbility>;
  savingThrows: string | null;
  skills: string | null;
  senses: string | null;
  languages: string | null;
  challengeRating: string;
  xp: number;
  traits: CreatureNamedEntry[];
  actions: CreatureNamedEntry[];
  reactions: CreatureNamedEntry[];
  legendaryActions: CreatureNamedEntry[];
  description: string;
}
