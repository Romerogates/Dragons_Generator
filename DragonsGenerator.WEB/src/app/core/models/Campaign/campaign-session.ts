import type { ActiveCombat, CombatHistoryEntry } from './campaign-combat';
import type { NotebookPage, SessionPlayPad } from './campaign-notebook';

export type CampaignSessionStatus = 'planned' | 'played' | 'cancelled';

/** Mode de table pour la session (jets dés vs encodage MJ). */
export type CampaignSessionMode = 'online' | 'in_person' | 'other';

/** Jeton héros sur la carte de soirée. */
export interface SessionTablePawn {
  id: string;
  memberUserId?: string | null;
  characterId?: string | null;
  name: string;
  mapX: number;
  mapY: number;
  tokenImageUrl?: string | null;
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

/** Entrée d’historique des pins du fil de table. */
export interface TablePinHistoryEntry {
  at: string;
  body: string;
  messageId?: string;
}

/** Macro MJ partageable sur la session (sync blob). */
export type TableMacroKind = 'perception' | 'next_turn' | 'end_combat';

export interface TableMacroDef {
  id: string;
  label: string;
  kind: TableMacroKind;
}

export const DEFAULT_TABLE_MACROS: TableMacroDef[] = [
  { id: 'macro-perception', label: 'Perception', kind: 'perception' },
  { id: 'macro-next-turn', label: 'Tour +', kind: 'next_turn' },
  { id: 'macro-end-combat', label: 'Fin combat', kind: 'end_combat' },
];

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
  status?: CampaignSessionStatus;
  /** Combats terminés durant cette session (MJ). */
  combatHistory?: CombatHistoryEntry[];
  /** Ordre de la soirée (MJ) — rencontres, pauses, notes. */
  timeline?: SessionTimelineItem[];
  /** Journal court des actions de combat (MJ / table). */
  combatLog?: string[];
  /** Donjon de campagne consulté pendant cette session (id dans data.dungeonMaps). */
  activeMapId?: string | null;
  /** Pions de la carte de soirée (hors combat, ou positions de départ). */
  tablePawns?: SessionTablePawn[];
  /** Fil de table minimal (MJ + joueurs) — sync live via blob campagne. */
  tableChat?: TableChatMessage[];
  /** Message épinglé en haut du fil (objectif de scène / indice). */
  tablePin?: string | null;
  /** Historique des pins retirés / remplacés (MJ, cap ~10). */
  tablePinHistory?: TablePinHistoryEntry[];
  /** Macros MJ partagées (sinon défauts client). */
  tableMacros?: TableMacroDef[];
  /** Run sheet MJ — objectifs de la soirée. */
  objectives?: string;
  /** Run sheet MJ — scènes / actes prévus. */
  scenes?: string;
  /** Run sheet MJ — pense-bête (docs à publier, matériel…). */
  prepChecklist?: string;
  /** Récap publié aux joueurs après la session. */
  playerRecap?: string;
  /** UserIds des joueurs « prêts » avant combat (table live). */
  tableReadyUserIds?: string[];
  /** Timer de scène partagé (horloge murale) — sync via blob session. */
  sceneTimer?: {
    label: string;
    endsAtIso: string;
    pausedRemainingSec?: number | null;
  } | null;
}
