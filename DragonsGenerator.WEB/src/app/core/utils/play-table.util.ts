/** Vues table (/play) + hints combat / roster — extraits du shell play-panel. */

import type { Combatant } from '@core/models/Campaign/campaign';
import { combatantInitiativeTotal, isCombatantDefeated } from './combat-tracker.util';

export type PlaySessionView =
  | 'resume'
  | 'notes'
  | 'combat'
  | 'encounters'
  | 'dungeon'
  | 'history';

export const PLAY_SESSION_TABS: { id: PlaySessionView; label: string; shortLabel: string }[] = [
  { id: 'resume', label: 'Résumé', shortLabel: 'Résumé' },
  { id: 'notes', label: 'Notes', shortLabel: 'Notes' },
  { id: 'combat', label: 'Combat', shortLabel: 'Combat' },
  { id: 'encounters', label: 'Rencontres', shortLabel: 'Renc.' },
  { id: 'dungeon', label: 'Donjon', shortLabel: 'Donjon' },
  { id: 'history', label: 'Historique', shortLabel: 'Hist.' },
];

export function isPlaySessionView(t: string): t is PlaySessionView {
  return PLAY_SESSION_TABS.some((tab) => tab.id === t);
}

export function continueInitiativeHint(
  canContinue: boolean,
  allyCount: number,
  enemyCount: number,
): string | null {
  if (canContinue) return null;
  if (!allyCount && !enemyCount) return 'Ajoutez au moins un allié et un adversaire.';
  if (!allyCount) return 'Il manque encore un allié (PJ ou PNJ).';
  if (!enemyCount) return 'Il manque encore un adversaire.';
  return 'Ajoutez au moins un allié et un adversaire.';
}

export function openFightHint(canEnter: boolean, missingInitCount: number): string | null {
  if (canEnter) return null;
  if (missingInitCount > 0) return `Encore ${missingInitCount} combattant(s) sans initiative.`;
  return 'Tous les combattants actifs doivent avoir une initiative.';
}

export function combatantNeedsInit(cb: Combatant): boolean {
  return !isCombatantDefeated(cb) && combatantInitiativeTotal(cb) == null;
}

export function combatantNeedsHp(cb: Combatant): boolean {
  return (
    !isCombatantDefeated(cb) &&
    (cb.currentHp === undefined ||
      cb.currentHp === null ||
      cb.maxHp === undefined ||
      cb.maxHp === null)
  );
}

export function playerNeedsInitiative(mine: Combatant | null | undefined): boolean {
  if (!mine) return false;
  return combatantInitiativeTotal(mine) == null && !mine.playerSubmitted;
}

export function canActOnCombatTurn(
  isSpectator: boolean,
  isDm: boolean,
  hasCurrentTurn: boolean,
  isMyTurn: boolean,
): boolean {
  if (isSpectator) return false;
  if (isDm) return hasCurrentTurn;
  return isMyTurn;
}

export function compactPlayerRoster<T extends { id: string }>(
  order: T[],
  opts: {
    isDm: boolean;
    expanded: boolean;
    turnId: string | null | undefined;
    myId: string | null | undefined;
  },
): T[] {
  if (opts.isDm || opts.expanded) return order;
  const compact = order.filter((c) => c.id === opts.turnId || c.id === opts.myId);
  return compact.length ? compact : order.slice(0, 2);
}

export function formatSceneTimerDisplay(seconds: number | null): string | null {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const r = seconds % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export type SceneTimerState = {
  label: string;
  endsAtIso: string;
  pausedRemainingSec?: number | null;
};

export function remainingSceneTimerSec(
  timer: SceneTimerState | null | undefined,
  nowMs = Date.now(),
): number | null {
  if (!timer) return null;
  if (timer.pausedRemainingSec != null) return Math.max(0, timer.pausedRemainingSec);
  if (!timer.endsAtIso) return null;
  const parsed = Date.parse(timer.endsAtIso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.ceil((parsed - nowMs) / 1000));
}

export function buildSceneTimerStart(
  minutes: number,
  label: string,
  nowMs = Date.now(),
): SceneTimerState {
  const sec = Math.max(1, Math.round(minutes * 60));
  return {
    label,
    endsAtIso: new Date(nowMs + sec * 1000).toISOString(),
    pausedRemainingSec: null,
  };
}

export function toggleSceneTimerPauseState(
  timer: SceneTimerState,
  nowMs = Date.now(),
): SceneTimerState {
  if (timer.pausedRemainingSec != null && timer.pausedRemainingSec >= 0) {
    return {
      label: timer.label,
      endsAtIso: new Date(nowMs + timer.pausedRemainingSec * 1000).toISOString(),
      pausedRemainingSec: null,
    };
  }
  const rem = remainingSceneTimerSec({ ...timer, pausedRemainingSec: null }, nowMs) ?? 0;
  return {
    label: timer.label,
    endsAtIso: timer.endsAtIso,
    pausedRemainingSec: rem,
  };
}

export function clampHpAdjustAmount(raw: string | number): number {
  return Math.max(1, Number(raw) || 1);
}

export function canToggleTableReady(opts: {
  isSpectator: boolean;
  isDm: boolean;
  me: string | null | undefined;
  userId: string;
}): boolean {
  if (opts.isSpectator) return false;
  if (!opts.isDm && opts.me !== opts.userId) return false;
  return true;
}

export function toggleTableReadyUserIds(
  ids: string[] | undefined,
  userId: string,
): string[] {
  const cur = new Set(ids ?? []);
  if (cur.has(userId)) cur.delete(userId);
  else cur.add(userId);
  return [...cur];
}

export type PlayPlayerOverlay = 'handouts' | 'propose';

export function initialHandoutOverlayId(
  pinnedId: string | null | undefined,
  published: { id: string }[],
): string | null {
  return pinnedId && published.some((h) => h.id === pinnedId) ? pinnedId : null;
}

export type HeroProposalStatus = 'none' | 'pending' | 'rejected' | 'approved';

export function resolveHeroProposalStatus(
  mine: { proposalStatus: string; approvedCharacterId?: string | null } | null | undefined,
): HeroProposalStatus {
  if (!mine) return 'none';
  if (mine.proposalStatus === 'approved' && mine.approvedCharacterId) return 'approved';
  if (mine.proposalStatus === 'pending') return 'pending';
  if (mine.proposalStatus === 'rejected') return 'rejected';
  return 'none';
}

export function creatureHasMjSecretNotes(cr: {
  voice?: string | null;
  desire?: string | null;
  fear?: string | null;
  secret?: string | null;
  noteStats?: string | null;
  backstory?: string | null;
}): boolean {
  return !!(
    cr.voice?.trim() ||
    cr.desire?.trim() ||
    cr.fear?.trim() ||
    cr.secret?.trim() ||
    cr.noteStats?.trim() ||
    cr.backstory?.trim()
  );
}

export function formatPlaySessionDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function nextPlannedSession<T extends { status: string; scheduledAt: string }>(
  sessions: T[],
  nowMs = Date.now(),
): T | null {
  return (
    sessions
      .filter((s) => s.status === 'planned')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .find((s) => new Date(s.scheduledAt).getTime() >= nowMs) ??
    sessions.find((s) => s.status === 'planned') ??
    null
  );
}
