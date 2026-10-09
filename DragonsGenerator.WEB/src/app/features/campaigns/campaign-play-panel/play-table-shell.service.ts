import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import type {
  CampaignData,
  CampaignDetail as CampaignDetailModel,
  CampaignSession,
  NotebookPage,
  SessionPlayPad,
  SessionTimelineItem,
} from '@core/models/Campaign/campaign';
import { ensureSessionPlayPads, sessionPlayPadsPreview } from '@core/utils/notebook.util';
import { buildPlayerRecapTemplate } from '@core/utils/player-recap-template.util';
import {
  formatSceneTimerDisplay,
  remainingSceneTimerSec,
  type PlaySessionView,
} from '@core/utils/play-table.util';
import { shouldFlushPlayNotesOnViewChange } from '@core/utils/play-keyboard.util';
import { readPlayZenMode, writePlayZenMode } from '@core/utils/play-zen.util';
import { softTablePulse } from '@core/utils/table-feedback.util';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';

export type PlayTableShellHooks = {
  campaign: () => CampaignDetailModel;
  fullscreen: () => boolean;
  isDm: () => boolean;
  activeSession: () => CampaignSession | null;
  resetFightStep: () => void;
  flushSession: () => void;
};

/**
 * Chrome de table : vues, zen, overlays, timer, fin de session.
 * Persist = CampaignPlaySessionStore uniquement.
 */
@Injectable()
export class PlayTableShellService {
  private readonly playStore = inject(CampaignPlaySessionStore);
  private readonly router = inject(Router);
  private readonly sessionDock = inject(CampaignSessionDockService);
  private hooks: PlayTableShellHooks | null = null;

  readonly sessionView = signal<PlaySessionView>('resume');
  readonly secretPanelOpen = signal(false);
  readonly dungeonPickerOpen = signal(false);
  readonly advancedToolsOpen = signal(false);
  readonly zenMode = signal(
    readPlayZenMode(typeof localStorage === 'undefined' ? null : localStorage),
  );
  readonly confirmDialog = signal<{
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  readonly endSessionDialog = signal<{ recap: string } | null>(null);
  readonly feedback = signal<{
    kind: 'ok' | 'err';
    text: string;
    undo?: () => void;
  } | null>(null);
  readonly sceneTimerSeconds = signal<number | null>(null);
  readonly sceneTimerPaused = signal(false);
  readonly sceneTimerLabel = signal('Scène');
  readonly sceneTimerTick = signal(0);
  readonly sceneTimerDisplay = computed(() => {
    this.sceneTimerTick();
    return formatSceneTimerDisplay(this.sceneTimerSeconds());
  });

  private sceneTimerHandle: ReturnType<typeof setInterval> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  configure(hooks: PlayTableShellHooks): void {
    this.hooks = hooks;
  }

  askConfirm(
    title: string,
    body: string,
    onConfirm: () => void,
    confirmLabel = 'Confirmer',
  ): void {
    this.confirmDialog.set({ title, body, confirmLabel, onConfirm });
  }

  cancelConfirmDialog(): void {
    this.confirmDialog.set(null);
  }

  runConfirmDialog(): void {
    const dialog = this.confirmDialog();
    if (!dialog) return;
    this.confirmDialog.set(null);
    dialog.onConfirm();
  }

  clearFeedback(): void {
    this.feedback.set(null);
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
  }

  setFeedback(
    kind: 'ok' | 'err',
    text: string,
    ttlMsOrOpts: number | { ttlMs?: number; undo?: () => void } = 4500,
  ): void {
    this.playStore.setFeedback(kind, text, ttlMsOrOpts);
    const opts =
      typeof ttlMsOrOpts === 'number' ? { ttlMs: ttlMsOrOpts } : (ttlMsOrOpts ?? {});
    const ttlMs = opts.ttlMs ?? (opts.undo ? 10_000 : 4500);
    this.feedback.set({ kind, text, undo: opts.undo });
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => {
      this.feedback.set(null);
      this.feedbackTimer = null;
    }, ttlMs);
  }

  runFeedbackUndo(): void {
    const undo = this.feedback()?.undo;
    this.clearFeedback();
    undo?.();
  }

  announceCodexImport(creatureName: string): void {
    const name = creatureName.trim();
    if (!name) return;
    this.setFeedback(
      'ok',
      `${name} ajouté depuis le Codex — ouvrez Combattre pour le voir sur la table.`,
      7000,
    );
  }

  openHandoutsOverlay(): void {
    this.playStore.openHandoutsOverlay();
  }

  openProposeOverlay(): void {
    this.playStore.openProposeOverlay();
  }

  closePlayerOverlay(): void {
    this.playStore.closePlayerOverlay();
  }

  selectHandout(id: string): void {
    this.playStore.selectHandout(id);
  }

  clearSelectedHandout(): void {
    this.playStore.clearSelectedHandout();
  }

  proposeCharacterFromPlay(characterId: string, onOk: () => void): void {
    this.playStore.proposeCharacter(characterId, onOk);
  }

  setSessionView(view: PlaySessionView): void {
    if (view === 'notes') {
      this.openSessionNotes();
      return;
    }
    if (shouldFlushPlayNotesOnViewChange(this.sessionView(), view)) {
      this.hooks?.flushSession();
    }
    this.sessionView.set(view);
    if (view !== 'combat') this.hooks?.resetFightStep();
    if (view !== 'dungeon') this.dungeonPickerOpen.set(false);
  }

  backToSessionHub(): void {
    if (shouldFlushPlayNotesOnViewChange(this.sessionView(), 'resume')) {
      this.hooks?.flushSession();
    }
    this.sessionView.set('resume');
    this.hooks?.resetFightStep();
    this.dungeonPickerOpen.set(false);
  }

  openSessionNotes(): void {
    const session = this.hooks?.activeSession();
    if (session && !session.playPads?.length) {
      const pads = ensureSessionPlayPads(session);
      this.playStore.updateSession(session.id, { playPads: pads }, { immediate: true });
    }
    this.sessionView.set('notes');
  }

  toggleSecretPanel(): void {
    this.secretPanelOpen.update((open) => !open);
  }

  openSecretPanel(): void {
    this.secretPanelOpen.set(true);
  }

  closeSecretPanel(): void {
    this.secretPanelOpen.set(false);
  }

  sessionNotesPreview(session: CampaignSession): string {
    return sessionPlayPadsPreview(session);
  }

  openSessionEncounters(): void {
    this.sessionView.set('encounters');
  }

  openSessionDungeon(): void {
    this.sessionView.set('dungeon');
  }

  openSessionHistory(): void {
    this.sessionView.set('history');
  }

  assignSessionMap(mapId: string | null): void {
    this.playStore.assignSessionMap(mapId);
    this.dungeonPickerOpen.set(false);
  }

  clearSessionMap(): void {
    this.askConfirm(
      'Retirer le donjon',
      'Retirer le donjon attribué à cette session ?',
      () => this.assignSessionMap(null),
      'Retirer',
    );
  }

  focusDungeonPicker(): void {
    this.dungeonPickerOpen.set(true);
    queueMicrotask(() => {
      document.getElementById('session-dungeon-picker')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }

  onDungeonMapsDataChange(patch: Partial<CampaignData>): void {
    this.playStore.saveData(patch);
  }

  onSessionTimelineChange(timeline: SessionTimelineItem[]): void {
    this.playStore.setSessionTimeline(timeline);
  }

  onSessionResumeChange(page: NotebookPage): void {
    this.playStore.setSessionResume(page);
  }

  onSessionPadsChange(payload: { playPads: SessionPlayPad[] }): void {
    const session = this.hooks?.activeSession();
    if (!session) return;
    this.playStore.updateSession(session.id, { playPads: payload.playPads });
  }

  startPlaySession(sessionId: string): void {
    if (!this.hooks?.isDm()) return;
    this.sessionView.set('resume');
    this.hooks.resetFightStep();
    this.playStore.startPlaySession(sessionId);
  }

  endPlaySession(): void {
    const c = this.hooks?.campaign();
    const session = this.hooks?.activeSession();
    if (!c?.isOwner || !session) return;
    const existing = session.playerRecap?.trim() ?? '';
    this.endSessionDialog.set({
      recap: existing || buildPlayerRecapTemplate(session),
    });
  }

  fillEndSessionRecapDraft(): void {
    const session = this.hooks?.activeSession();
    if (!session) return;
    this.endSessionDialog.set({ recap: buildPlayerRecapTemplate(session) });
  }

  cancelEndSessionDialog(): void {
    this.endSessionDialog.set(null);
  }

  confirmEndSessionDialog(): void {
    const draft = this.endSessionDialog();
    this.endSessionDialog.set(null);
    this.doEndPlaySession(draft?.recap?.trim() || undefined);
  }

  toggleZenMode(): void {
    this.zenMode.update((z) => {
      const next = !z;
      writePlayZenMode(next, typeof localStorage === 'undefined' ? null : localStorage);
      if (next && this.sessionView() === 'resume') {
        this.sessionView.set('combat');
      }
      return next;
    });
    this.setFeedback(
      'ok',
      this.zenMode()
        ? 'Mode zen — chrome minimal (Z pour sortir).'
        : 'Chrome complet rétabli.',
      { ttlMs: 2200 },
    );
    softTablePulse('dice');
  }

  toggleAdvancedTools(): void {
    this.advancedToolsOpen.update((v) => !v);
  }

  startSceneTimer(minutes: number, label = 'Scène'): void {
    this.playStore.startSceneTimer(minutes, label);
    this.ensureSceneTimerTick();
  }

  toggleSceneTimerPause(): void {
    this.playStore.toggleSceneTimerPause();
  }

  stopSceneTimer(): void {
    this.clearSceneTimerTick();
    this.playStore.stopSceneTimer();
    this.sceneTimerSeconds.set(null);
    this.sceneTimerPaused.set(false);
  }

  hydrateSceneTimer(timer: CampaignSession['sceneTimer'] | null | undefined): void {
    if (!timer?.endsAtIso && timer?.pausedRemainingSec == null) {
      this.clearSceneTimerTick();
      this.sceneTimerSeconds.set(null);
      this.sceneTimerPaused.set(false);
      return;
    }
    this.sceneTimerLabel.set(timer.label || 'Scène');
    const rem = remainingSceneTimerSec(timer);
    if (timer.pausedRemainingSec != null) {
      this.sceneTimerPaused.set(true);
      this.sceneTimerSeconds.set(rem);
      this.clearSceneTimerTick();
      return;
    }
    this.sceneTimerPaused.set(false);
    this.sceneTimerSeconds.set(rem);
    if ((rem ?? 0) <= 0) {
      this.clearSceneTimerTick();
      return;
    }
    this.ensureSceneTimerTick();
  }

  resetOnSessionChange(): void {
    this.sessionView.set('resume');
    this.dungeonPickerOpen.set(false);
    this.advancedToolsOpen.set(false);
  }

  destroy(): void {
    this.clearSceneTimerTick();
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
  }

  private doEndPlaySession(playerRecap?: string): void {
    if (!this.hooks?.isDm() || !this.hooks.activeSession()) return;
    this.sessionView.set('resume');
    this.hooks.resetFightStep();
    this.playStore.endPlaySession(playerRecap, (campaignId) => {
      this.sessionDock.forgetAfterSessionEnd(campaignId);
      if (this.hooks?.fullscreen()) {
        void this.router.navigate(['/campaigns', campaignId]);
      }
    });
  }

  private ensureSceneTimerTick(): void {
    if (this.sceneTimerHandle) return;
    this.sceneTimerHandle = setInterval(() => {
      this.sceneTimerTick.update((n) => n + 1);
      const t = this.hooks?.activeSession()?.sceneTimer;
      if (!t || t.pausedRemainingSec != null) return;
      const rem = remainingSceneTimerSec(t) ?? 0;
      this.sceneTimerSeconds.set(rem);
      if (rem <= 0) {
        this.clearSceneTimerTick();
        this.setFeedback('ok', `Timer « ${t.label || 'Scène'} » terminé.`);
        softTablePulse('turn');
      }
    }, 1000);
  }

  private clearSceneTimerTick(): void {
    if (this.sceneTimerHandle) {
      clearInterval(this.sceneTimerHandle);
      this.sceneTimerHandle = null;
    }
  }
}
