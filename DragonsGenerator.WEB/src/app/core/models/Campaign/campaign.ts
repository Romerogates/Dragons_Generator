import {
  AdventureTone,
  CREATURE_ROLE_LABELS,
  CreatureRole,
  StoryCreatureSelection,
} from '../Story/story';
import type { CampaignDungeonMap } from './dungeon-map';
import type { CampaignHandout } from './campaign-handout';
import type { NotebookPage } from './campaign-notebook';
import type { CampaignScheduleEvent } from './campaign-schedule';
import type { CampaignSession } from './campaign-session';

export type {
  CombatantKind,
  CombatantEncounterLink,
  CombatantAttack,
  Combatant,
  ActiveCombat,
  CombatHistoryEntry,
} from './campaign-combat';

export type {
  NotebookMode,
  InkPoint,
  InkStroke,
  NotebookPage,
  SessionChecklistItem,
  SessionPlayPadKind,
  SessionPlayPadWidgetSize,
  SessionPlayPadLayout,
  SessionPlayPad,
} from './campaign-notebook';
export {
  SESSION_PLAY_PAD_MAX,
  NOTEBOOK_MAX_PAGES,
  NOTEBOOK_INK_MAX_DIMENSION,
  NOTEBOOK_INK_JPEG_QUALITY,
  createNotebookPage,
  createChecklistItem,
  createSessionPlayPad,
} from './campaign-notebook';

export type {
  HandoutKind,
  CampaignHandoutPage,
  CampaignHandout,
} from './campaign-handout';
export {
  HANDOUT_KIND_LABELS,
  createCampaignHandout,
  createHandoutPage,
  handoutPlayerBody,
  normalizeHandoutKind,
} from './campaign-handout';

export type {
  CampaignScheduleKind,
  ScheduleRsvpStatus,
  ScheduleRsvp,
  CampaignScheduleEvent,
} from './campaign-schedule';
export {
  CAMPAIGN_SCHEDULE_KIND_LABELS,
  CAMPAIGN_SCHEDULE_RRULE_PRESETS,
  createCampaignScheduleEvent,
} from './campaign-schedule';

export type {
  CampaignSessionStatus,
  CampaignSessionMode,
  SessionTablePawn,
  SessionTimelineKind,
  SessionTimelineItem,
  TableChatMessage,
  TablePinHistoryEntry,
  TableMacroKind,
  TableMacroDef,
  CampaignSession,
} from './campaign-session';
export { DEFAULT_TABLE_MACROS } from './campaign-session';

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
  /** Résumé visible côté joueur (sans spoilers MJ). */
  playerSummary?: string;
  /** Lien vers une carte donjon associée. */
  dungeonMapId?: string;
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
  /** Carnet MJ (texte + pages manuscrites). */
  notebookPages?: NotebookPage[];
  /** Résumé de campagne (persiste d’une session à l’autre). */
  sessionResume?: NotebookPage;
  pregenCharacters: CampaignPregen[];
  sessions: CampaignSession[];
  /** Dates libres du calendrier de table (réunions, hors-jeu, etc.). */
  scheduleEvents?: CampaignScheduleEvent[];
  /** Documents distribuables aux joueurs (MJ publie, joueurs voient published uniquement). */
  handouts: CampaignHandout[];
  /** Session en cours côté table de jeu MJ. */
  activeSessionId?: string | null;
  /** Document épinglé visible par les joueurs (overlay). */
  pinnedHandoutId?: string | null;
  /** Cartes / donjons générés (MJ uniquement). */
  dungeonMaps?: CampaignDungeonMap[];
  /** Pins Atlas Eana liés à la campagne (en plus de regionId primaire). */
  atlasPins?: CampaignAtlasPin[];
}

/** Point d’intérêt Atlas rattaché à une campagne. */
export interface CampaignAtlasPin {
  id: string;
  name: string;
  civId?: string | null;
  note?: string;
}

export interface CampaignMember {
  id: string;
  userId: string;
  displayName: string;
  role: 'dm' | 'player' | 'spectator';
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
  role: 'dm' | 'player' | 'spectator';
  updatedAt: string;
  playerCount: number;
  regionName?: string | null;
  /** Archivage personnel : masquée de la liste active, toujours accessible. */
  isArchived?: boolean;
  /** Fermée par le MJ — historique lecture seule. */
  isClosed?: boolean;
  /** Quitter / viré / fermée — consultation historique. */
  isHistory?: boolean;
  membershipStatus?: 'active' | 'left' | 'removed' | 'closed';
  hasPlayerHistory?: boolean;
  /** Campagne créée hors ligne, en attente de sync cloud. */
  pendingSync?: boolean;
  /** Id local tant que la campagne n'est pas synchronisée. */
  localId?: string;
}

export interface CampaignDetail {
  id: string;
  title: string;
  data: CampaignData;
  role: 'dm' | 'player' | 'spectator' | 'support';
  isOwner: boolean;
  updatedAt: string;
  members: CampaignMember[];
  /** Archivage personnel pour l’utilisateur courant. */
  isArchived?: boolean;
  isClosed?: boolean;
  isHistory?: boolean;
  membershipStatus?: 'active' | 'left' | 'removed' | 'closed';
  hasPlayerHistory?: boolean;
}

export interface FriendUser {
  id: string;
  displayName: string;
  avatarEmoji?: string | null;
  accentColor?: string;
  friendSince?: string;
}

export type FriendRelationshipStatus = 'none' | 'friend' | 'pending_sent' | 'pending_received';

export interface UserSearchResult {
  id: string;
  displayName: string;
  avatarEmoji?: string | null;
  accentColor?: string;
  bio?: string | null;
  memberSince: string;
  relationshipStatus: FriendRelationshipStatus;
}

export interface UserSuggestion extends UserSearchResult {
  suggestionReason: string;
  sharedCampaignCount: number;
  sampleCampaignTitle?: string | null;
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
    notebookPages: [],
    pregenCharacters: [],
    sessions: [],
    scheduleEvents: [],
    handouts: [],
    activeSessionId: null,
    dungeonMaps: [],
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
  claimed: 'Copié dans Mes héros',
};

export type { CreatureRole };
export { CREATURE_ROLE_LABELS };
