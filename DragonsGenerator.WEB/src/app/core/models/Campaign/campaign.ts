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

export type CampaignPregenStatus = 'draft' | 'ready' | 'assigned' | 'claimed';

export interface CampaignPregen {
  id: string;
  characterId: string;
  characterName: string;
  speciesLabel?: string;
  classLabel?: string;
  label?: string;
  publicHook: string;
  dmBackstory: string;
  dmSecrets: string;
  assignedUserId?: string | null;
  assignedDisplayName?: string | null;
  status: CampaignPregenStatus;
}

export type CampaignSessionStatus = 'planned' | 'played' | 'cancelled';

export type CombatantKind = 'player' | 'monster' | 'npc';

export interface CombatantEncounterLink {
  encounterId: string;
  creatureIndex: number;
  /** Index de l'unité dans le groupe (0 … quantity−1). */
  unitIndex: number;
}

export interface Combatant {
  id: string;
  name: string;
  kind: CombatantKind;
  initiativeBonus: number;
  initiativeRoll?: number;
  currentHp?: number;
  maxHp?: number;
  conditions?: string[];
  /** Lien vers une ligne de rencontre (monstres importés). */
  encounterLink?: CombatantEncounterLink;
  /** Unité hors de combat (sync +1 kill sur la rencontre). */
  defeated?: boolean;
}

export interface ActiveCombat {
  id: string;
  label?: string;
  encounterId?: string;
  round: number;
  turnIndex: number;
  combatants: Combatant[];
}

export interface CampaignSession {
  id: string;
  title: string;
  scheduledAt: string;
  location?: string;
  notes?: string;
  /** Notes prises en direct pendant la session (MJ). */
  playNotes?: string;
  /** Tracker initiative / ordre de combat en cours (MJ). */
  activeCombat?: ActiveCombat | null;
  status: CampaignSessionStatus;
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
  pregenCharacters: CampaignPregen[];
  sessions: CampaignSession[];
  /** Documents distribuables aux joueurs (MJ publie, joueurs voient published uniquement). */
  handouts: CampaignHandout[];
  /** Session en cours côté table de jeu MJ. */
  activeSessionId?: string | null;
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
  /** Campagne créée hors ligne, en attente de sync cloud. */
  pendingSync?: boolean;
  /** Id local tant que la campagne n'est pas synchronisée. */
  localId?: string;
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
  avatarEmoji?: string | null;
  accentColor?: string;
}

export interface FriendRequest {
  id: string;
  userId: string;
  displayName: string;
  avatarEmoji?: string | null;
  accentColor?: string;
  createdAt: string;
}

export interface CampaignInvite {
  id: string;
  campaignId: string;
  campaignTitle: string;
  invitedByName: string;
  createdAt: string;
}

/** Document / handout publiable par le MJ (sans spoiler). */
export interface CampaignHandout {
  id: string;
  title: string;
  body: string;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export function createCampaignHandout(title = 'Nouveau document'): CampaignHandout {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID?.() ?? `ho-${Date.now()}`,
    title,
    body: '',
    published: false,
    createdAt: now,
  };
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
    pregenCharacters: [],
    sessions: [],
    handouts: [],
    activeSessionId: null,
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

export function createCampaignPregenEntry(
  characterId: string,
  characterName: string,
  speciesLabel: string,
  classLabel: string,
): CampaignPregen {
  return {
    id: crypto.randomUUID?.() ?? `pregen-${Date.now()}`,
    characterId,
    characterName,
    speciesLabel,
    classLabel,
    publicHook: '',
    dmBackstory: '',
    dmSecrets: '',
    status: 'draft',
  };
}

export const PREGEN_STATUS_LABELS: Record<CampaignPregenStatus, string> = {
  draft: 'Brouillon',
  ready: 'Prêt',
  assigned: 'Assigné',
  claimed: 'Revendiqué',
};

export type { CreatureRole };
export { CREATURE_ROLE_LABELS };
