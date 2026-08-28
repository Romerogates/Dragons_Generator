import {
  AdventureTone,
  CREATURE_ROLE_LABELS,
  CreatureRole,
  StoryCreatureSelection,
} from '../Story/story';

export interface EncounterCreature {
  creatureId: string;
  creatureName: string;
  customName?: string;
  challengeRating: string;
  xp: number;
  quantity: number;
  defeated: number;
}

export interface EncounterGroup {
  id: string;
  name: string;
  description?: string;
  creatures: EncounterCreature[];
  xpAwarded?: boolean;
}

export interface CampaignData {
  setting: string;
  regionId: string | null;
  regionName: string;
  partyLevel: number;
  tone: AdventureTone;
  adventure: string;
  creatures: StoryCreatureSelection[];
  encounters: EncounterGroup[];
  notes: string;
}

export interface CampaignMember {
  id: string;
  userId: string;
  displayName: string;
  role: 'dm' | 'player';
  proposalStatus: 'none' | 'pending' | 'approved' | 'rejected';
  approvedCharacterId?: string | null;
  approvedCharacterName?: string | null;
  approvedCharacterLevel?: number | null;
  proposedCharacterId?: string | null;
  proposedCharacterName?: string | null;
  proposedCharacterLevel?: number | null;
  xpEarnedInCampaign: number;
}

export interface CampaignSummary {
  id: string;
  title: string;
  role: 'dm' | 'player';
  updatedAt: string;
  playerCount: number;
  regionName?: string | null;
}

export interface CampaignDetail {
  id: string;
  title: string;
  data: CampaignData;
  role: 'dm' | 'player';
  isOwner: boolean;
  updatedAt: string;
  members: CampaignMember[];
}

export interface FriendUser {
  id: string;
  displayName: string;
}

export interface FriendRequest {
  id: string;
  userId: string;
  displayName: string;
  createdAt: string;
}

export interface CampaignInvite {
  id: string;
  campaignId: string;
  campaignTitle: string;
  invitedByName: string;
  createdAt: string;
}

export function emptyCampaignData(partyLevel = 3): CampaignData {
  return {
    setting: '',
    regionId: null,
    regionName: '',
    partyLevel,
    tone: 'classic',
    adventure: '',
    creatures: [],
    encounters: [],
    notes: '',
  };
}

export function createEncounterFromCreatures(
  name: string,
  creatures: StoryCreatureSelection[],
  xpMap: Record<string, number>,
): EncounterGroup {
  return {
    id: crypto.randomUUID?.() ?? `enc-${Date.now()}`,
    name,
    creatures: creatures.map((c) => ({
      creatureId: c.creatureId,
      creatureName: c.creatureName,
      customName: c.customName,
      challengeRating: c.challengeRating,
      xp: xpMap[c.creatureId] ?? 0,
      quantity: 1,
      defeated: 0,
    })),
  };
}

export function encounterTotalXp(encounter: EncounterGroup): number {
  return encounter.creatures.reduce((sum, c) => sum + c.xp * c.defeated, 0);
}

export function encounterPendingXp(encounter: EncounterGroup): number {
  return encounter.creatures.reduce(
    (sum, c) => sum + c.xp * Math.max(0, c.quantity - c.defeated),
    0,
  );
}

export type { CreatureRole };
export { CREATURE_ROLE_LABELS };
