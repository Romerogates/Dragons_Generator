export type CreatureRole = 'antagonist' | 'ally' | 'neutral' | 'wildcard';

export type AdventureTone = 'classic' | 'dark' | 'heroic' | 'humorous' | 'mysterious';

export type StoryRegionChoice =
  | { kind: 'unknown' }
  | { kind: 'civilization'; id: string; name: string };

export interface StoryCreatureSelection {
  creatureId: string;
  creatureName: string;
  category: string;
  challengeRating: string;
  customName: string;
  role: CreatureRole;
  backstory: string;
}

export interface GenerateCreatureStoryRequest {
  creatureId: string;
  customName: string;
  role?: CreatureRole | null;
  setting?: string | null;
}

export interface GenerateCreatureStoryResponse {
  backstory: string;
}

export interface GenerateCreatureStoriesBatchRequest {
  creatures: {
    creatureId: string;
    customName: string;
    role?: CreatureRole | null;
  }[];
  setting?: string | null;
}

export interface GenerateCreatureStoriesBatchResponse {
  backstories: { creatureId: string; backstory: string }[];
}

export interface GenerateAdventureRequest {
  title: string;
  setting?: string | null;
  partyLevel?: number | null;
  tone?: AdventureTone | null;
  creatures: {
    creatureId: string;
    creatureName: string;
    customName: string;
    role?: CreatureRole | null;
    backstory?: string | null;
  }[];
}

export interface GenerateAdventureResponse {
  adventure: string;
}

export const CREATURE_ROLE_LABELS: Record<CreatureRole, string> = {
  antagonist: 'Antagoniste',
  ally: 'Allié',
  neutral: 'Neutre',
  wildcard: 'Imprévisible',
};

export const ADVENTURE_TONE_LABELS: Record<AdventureTone, string> = {
  classic: 'Classique',
  dark: 'Sombre',
  heroic: 'Héroïque',
  humorous: 'Humour',
  mysterious: 'Mystérieux',
};
