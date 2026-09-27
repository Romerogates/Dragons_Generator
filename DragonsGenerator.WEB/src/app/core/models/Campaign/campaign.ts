import {
  AdventureTone,
  CREATURE_ROLE_LABELS,
  CreatureRole,
  StoryCreatureSelection,
} from '../Story/story';
import type { CampaignDungeonMap } from './dungeon-map';

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

export type CampaignSessionStatus = 'planned' | 'played' | 'cancelled';

/** Mode de table pour la session (jets dés vs encodage MJ). */
export type CampaignSessionMode = 'online' | 'in_person' | 'other';

/** Type d’entrée du calendrier de table (hors / autour du play). */
export type CampaignScheduleKind = 'game' | 'prep' | 'social' | 'other';

export const CAMPAIGN_SCHEDULE_KIND_LABELS: Record<CampaignScheduleKind, string> = {
  game: 'Soirée de jeu',
  prep: 'Préparation',
  social: 'Social / hors jeu',
  other: 'Autre',
};

export type CombatantKind = 'player' | 'monster' | 'npc';

export interface CombatantEncounterLink {
  encounterId: string;
  creatureIndex: number;
  /** Index de l'unité dans le groupe (0 … quantity−1). */
  unitIndex: number;
}

/** Snapshot d'attaque pour le tracker (import party / créature). */
export interface CombatantAttack {
  name: string;
  attackBonus: number;
  /** Ex. "1d8+3" ou "1d6". */
  damageDice?: string;
  damageBonus?: number;
  damageType?: string;
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
  /** Joueur lié (collecte d'initiative). */
  memberUserId?: string | null;
  /** Jet soumis par le joueur via la collecte. */
  playerSubmitted?: boolean;
  /** CA snapshot (affichage / résolution d'attaque). */
  armorClass?: number;
  /** Attaques snapshot à l'import. */
  attacks?: CombatantAttack[];
  /** Perso cloud lié (PJ). */
  characterId?: string | null;
  /** Id fiche Codex d’origine (bestiaire). */
  sourceCreatureId?: string | null;
  /** Position sur la carte de session (grille 0-based). */
  mapX?: number;
  mapY?: number;
}

export interface ActiveCombat {
  id: string;
  label?: string;
  encounterId?: string;
  round: number;
  turnIndex: number;
  combatants: Combatant[];
  /** Collecte ouverte : les joueurs peuvent saisir leur jet. */
  collectingInitiative?: boolean;
  /** Code court partagé avec les joueurs. */
  initiativeCode?: string;
  /** Ordre manuel entre combattants à égalité d'initiative (ids). */
  turnOrderIds?: string[];
  /**
   * Fil guidé MJ : setup (roster) → initiative (ordre) → fight (menu Pokémon).
   * Absent → déduit (rétrocompat).
   */
  flowPhase?: 'setup' | 'initiative' | 'fight';
}

export type SessionTimelineKind = 'encounter' | 'break' | 'note' | 'handout';

export interface SessionTimelineItem {
  id: string;
  kind: SessionTimelineKind;
  label: string;
  encounterId?: string;
  handoutId?: string;
  dungeonMapId?: string;
  durationMin?: number;
}

/** Message du fil de table (session live). */
export interface TableChatMessage {
  id: string;
  at: string;
  authorUserId: string;
  authorName: string;
  body: string;
}

export interface CampaignSession {
  id: string;
  title: string;
  scheduledAt: string;
  location?: string;
  /**
   * Mode de table : en ligne (dés), présentiel (MJ encode), autre (choix à chaque jet).
   * Absent → traité comme `online` pour rétrocompat.
   */
  mode?: CampaignSessionMode;
  notes?: string;
  /** Notes prises en direct pendant la session (MJ). */
  playNotes?: string;
  /** Mode / encre de la page de notes live (stylet). */
  playNotebook?: NotebookPage;
  /** Calepins de session (notes + checklists). */
  playPads?: SessionPlayPad[];
  /** Tracker initiative / ordre de combat en cours (MJ). */
  activeCombat?: ActiveCombat | null;
  status: CampaignSessionStatus;
  /** Combats terminés durant cette session (MJ). */
  combatHistory?: CombatHistoryEntry[];
  /** Ordre de la soirée (MJ) — rencontres, pauses, notes. */
  timeline?: SessionTimelineItem[];
  /** Journal court des actions de combat (MJ / table). */
  combatLog?: string[];
  /** Donjon de campagne consulté pendant cette session (id dans data.dungeonMaps). */
  activeMapId?: string | null;
  /** Fil de table minimal (MJ + joueurs) — sync live via blob campagne. */
  tableChat?: TableChatMessage[];
  /** Run sheet MJ — objectifs de la soirée. */
  objectives?: string;
  /** Run sheet MJ — scènes / actes prévus. */
  scenes?: string;
  /** Run sheet MJ — pense-bête (docs à publier, matériel…). */
  prepChecklist?: string;
  /** Récap publié aux joueurs après la session. */
  playerRecap?: string;
}

/** Date libre du calendrier de table (pas forcément une session de play). */
export interface CampaignScheduleEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  allDay?: boolean;
  kind: CampaignScheduleKind;
  location?: string;
  notes?: string;
  /** Héros liés (ids personnages cloud / pré-tirés). */
  characterIds?: string[];
  /** Optionnel : lier une vraie session de play. */
  linkedSessionId?: string | null;
  createdByUserId?: string;
  /**
   * Récurrence iCalendar (sous-ensemble) — ex. `FREQ=WEEKLY;INTERVAL=1`.
   * Absent / vide = ponctuel.
   */
  rrule?: string | null;
}

/** Presets RRULE pour l’UI calendrier. */
export const CAMPAIGN_SCHEDULE_RRULE_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'Une seule fois' },
  { value: 'FREQ=WEEKLY;INTERVAL=1', label: 'Chaque semaine' },
  { value: 'FREQ=WEEKLY;INTERVAL=2', label: 'Toutes les 2 semaines' },
  { value: 'FREQ=MONTHLY;INTERVAL=1', label: 'Chaque mois' },
];


export interface CombatHistoryEntry {
  id: string;
  endedAt: string;
  label?: string;
  encounterId?: string;
  round: number;
  summary: string;
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
  role: 'dm' | 'player';
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

export type HandoutKind = 'letter' | 'map' | 'summary' | 'other';

export const HANDOUT_KIND_LABELS: Record<HandoutKind, string> = {
  letter: 'Lettre',
  map: 'Carte',
  summary: 'Résumé',
  other: 'Autre',
};

/** Document / handout publiable par le MJ (sans spoiler). */
export interface CampaignHandout {
  id: string;
  title: string;
  body: string;
  kind: HandoutKind;
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
    kind: 'other',
    published: false,
    createdAt: now,
  };
}

export function normalizeHandoutKind(raw: unknown): HandoutKind {
  if (raw === 'letter' || raw === 'map' || raw === 'summary' || raw === 'other') return raw;
  return 'other';
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

export function createCampaignScheduleEvent(
  partial?: Partial<CampaignScheduleEvent>,
): CampaignScheduleEvent {
  const starts = partial?.startsAt ? new Date(partial.startsAt) : new Date();
  const ends =
    partial?.endsAt != null
      ? partial.endsAt
      : new Date(starts.getTime() + 3 * 60 * 60 * 1000).toISOString();
  return {
    id: partial?.id ?? crypto.randomUUID?.() ?? `sched-${Date.now()}`,
    title: partial?.title?.trim() || 'Soirée de table',
    startsAt: starts.toISOString(),
    endsAt: ends,
    allDay: partial?.allDay ?? false,
    kind: partial?.kind ?? 'game',
    location: partial?.location ?? '',
    notes: partial?.notes ?? '',
    characterIds: partial?.characterIds ? [...partial.characterIds] : [],
    linkedSessionId: partial?.linkedSessionId ?? null,
    createdByUserId: partial?.createdByUserId,
    rrule: partial?.rrule?.trim() || null,
  };
}

export type NotebookMode = 'text' | 'ink';

export interface InkPoint {
  x: number;
  y: number;
}

export interface InkStroke {
  color: string;
  width: number;
  points: InkPoint[];
  /** pen = trait opaque ; highlighter = semi-transparent */
  tool?: 'pen' | 'highlighter';
}

/** Page du carnet MJ (clavier et/ou stylet). */
export interface NotebookPage {
  id: string;
  title: string;
  mode: NotebookMode;
  text?: string;
  inkStrokes?: InkStroke[];
  /** Aperçu compressé (JPEG data URL) — pas d’OCR en V1. */
  inkImageDataUrl?: string;
  updatedAt: string;
}

export interface SessionChecklistItem {
  id: string;
  text: string;
  done?: boolean;
}

export type SessionPlayPadKind = 'note' | 'checklist';

/** @deprecated Prefer layout cells; kept for migration. */
export type SessionPlayPadWidgetSize = 'third' | 'half' | 'full';

/** Position / taille sur grille 12 colonnes. */
export interface SessionPlayPadLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SessionPlayPad {
  id: string;
  kind: SessionPlayPadKind;
  title: string;
  order: number;
  /** @deprecated Migrated to layout. */
  widgetSize?: SessionPlayPadWidgetSize;
  /** Grille aimantée (x,y,w,h en cellules). */
  layout?: SessionPlayPadLayout;
  page?: NotebookPage;
  items?: SessionChecklistItem[];
}

export const SESSION_PLAY_PAD_MAX = 8;

export function createNotebookPage(title = 'Nouvelle page'): NotebookPage {
  return {
    id: crypto.randomUUID?.() ?? `nb-${Date.now()}`,
    title,
    mode: 'text',
    text: '',
    inkStrokes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createChecklistItem(text = ''): SessionChecklistItem {
  return {
    id: crypto.randomUUID?.() ?? `cli-${Date.now()}`,
    text,
    done: false,
  };
}

export function createSessionPlayPad(
  kind: SessionPlayPadKind,
  title?: string,
  order = 0,
  layout?: SessionPlayPadLayout,
): SessionPlayPad {
  const id = crypto.randomUUID?.() ?? `pad-${Date.now()}`;
  const resolvedLayout = layout ?? { x: (order % 2) * 6, y: Math.floor(order / 2) * 6, w: 6, h: 6 };
  if (kind === 'checklist') {
    return {
      id,
      kind,
      title: title ?? 'Liste',
      order,
      layout: resolvedLayout,
      items: [createChecklistItem('')],
    };
  }
  const page = createNotebookPage(title ?? 'Notes');
  return {
    id,
    kind: 'note',
    title: page.title,
    order,
    layout: resolvedLayout,
    page,
  };
}

/** Plafond soft pour éviter d’exploser le JSON campagne. */
export const NOTEBOOK_MAX_PAGES = 24;
export const NOTEBOOK_INK_MAX_DIMENSION = 1280;
export const NOTEBOOK_INK_JPEG_QUALITY = 0.55;

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
