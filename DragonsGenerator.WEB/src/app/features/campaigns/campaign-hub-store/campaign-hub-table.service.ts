import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import type {
  CampaignActivityItem,
} from '@core/services/campaign-cloud.service';
import type {
  CampaignScheduleEvent,
  CampaignSession,
  HandoutKind,
} from '@core/models/Campaign/campaign';
import { formatScheduleOccurrenceLabel } from '@core/utils/campaign-hub-write.util';
import { buildHandoutsFromPack } from '@core/utils/campaign-content-presets.util';
import { prefillRunSheetFromCampaign } from '@core/utils/run-sheet-prefill.util';
import { handoutIdFromActivity } from '../campaign-detail/campaign-activity.util';
import type { SessionDateChangeEvent, SessionPatchEvent } from '../campaign-detail/campaign-detail-sessions/campaign-detail-sessions';
import type { HandoutPatchEvent, HandoutPublishEvent } from '../campaign-detail/campaign-detail-handouts/campaign-detail-handouts';
import * as hubView from '@core/utils/campaign-hub-view.util';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubMembersService } from './campaign-hub-members.service';
import { CampaignHubSyncService } from './campaign-hub-sync.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubPdfService } from './campaign-hub-pdf.service';
import { CampaignHubBootService } from './campaign-hub-boot.service';

/**
 * Sessions, calendrier, documents, entrée en table.
 * Persist = store uniquement.
 */
@Injectable()
export class CampaignHubTableService {
  private readonly router = inject(Router);
  private readonly hub = inject(CampaignHubStore);
  private readonly members = inject(CampaignHubMembersService);
  private readonly hubSync = inject(CampaignHubSyncService);
  private readonly hubNav = inject(CampaignHubNavService);
  private readonly hubPdf = inject(CampaignHubPdfService);
  private readonly boot = inject(CampaignHubBootService);
  private readonly sessionDock = inject(CampaignSessionDockService);

  readonly editingHandoutId = signal<string | null>(null);
  readonly previewHandoutId = signal<string | null>(null);
  readonly handoutKindFilter = signal<HandoutKind | 'all'>('all');
  readonly rosterSheetOpen = signal(false);
  readonly pinnedOverlayDismissed = signal(false);

  readonly previewHandout = computed(() => {
    const id = this.previewHandoutId();
    if (!id) return null;
    return (this.hub.campaign()?.data.handouts ?? []).find((h) => h.id === id) ?? null;
  });

  startPlaySession(sessionId: string): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.boot.askConfirm(
      'Entrer en session ?',
      'La table s’ouvre pour tous les joueurs connectés. Combat, notes et carte deviennent actifs.',
      () => {
        this.hub.flushSoftPersist();
        this.hub.flushSessionSave();
        this.boot.flushMaps();
        const data = { ...this.hub.campaign()!.data, activeSessionId: sessionId };
        this.hub.campaign.update((prev) => (prev ? { ...prev, data } : prev));
        this.hub.persistNow(data, () => {
          this.sessionDock.bindCampaign(this.hub.campaign());
          this.sessionDock.open();
          void this.router.navigate(['/campaigns', c.id, 'play']);
        });
      },
      'Entrer en session',
      false,
    );
  }

  openSessionDock(): void {
    this.sessionDock.bindCampaign(this.hub.campaign());
    this.sessionDock.open();
  }

  openPlayFullscreen(): void {
    const c = this.hub.campaign();
    if (!c?.data.activeSessionId) return;
    this.sessionDock.close();
    void this.router.navigate(['/campaigns', c.id, 'play']);
  }

  loadActivity(): void {
    this.hubSync.loadActivity();
  }

  openHandoutFromActivity(item: CampaignActivityItem): void {
    const handoutId = handoutIdFromActivity(item);
    if (item.kind !== 'handout_published') return;
    this.hubNav.focusHandoutId.set(handoutId);
    this.hubNav.setTab('handouts');
    const c = this.hub.campaign();
    if (handoutId && c && !c.isOwner) {
      const published = (c.data.handouts ?? []).some((h) => h.id === handoutId && h.published);
      if (published) this.previewHandoutAsPlayer(handoutId);
    }
  }

  onHandoutPatch(event: HandoutPatchEvent): void {
    this.hub.updateHandout(event.handoutId, event.patch);
  }

  onHandoutPatchImmediate(event: HandoutPatchEvent): void {
    this.hub.updateHandout(event.handoutId, event.patch, { immediate: true });
  }

  onHandoutTogglePublished(event: HandoutPublishEvent): void {
    this.toggleHandoutPublished(event.handoutId, event.published);
  }

  previewHandoutAsPlayer(handoutId: string): void {
    this.previewHandoutId.set(handoutId);
  }

  closeHandoutPreview(): void {
    this.previewHandoutId.set(null);
  }

  setHandoutKindFilter(kind: HandoutKind | 'all'): void {
    this.handoutKindFilter.set(kind);
  }

  onSessionPatch(event: SessionPatchEvent): void {
    this.hub.updateSession(event.sessionId, event.patch);
  }

  onSessionPatchImmediate(event: SessionPatchEvent): void {
    this.hub.updateSession(event.sessionId, event.patch, { immediate: true });
  }

  onSessionDateChangeEvent(event: SessionDateChangeEvent): void {
    this.onSessionDateChange(event.sessionId, event.value);
  }

  addHandout(): void {
    const handout = this.hub.addBlankHandout();
    if (!handout) return;
    this.editingHandoutId.set(handout.id);
  }

  insertHandoutPack(packId: string): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    const added = buildHandoutsFromPack(packId);
    if (!added.length) return;
    this.hub.flushHandoutSave();
    this.hub.saveData({ handouts: [...(c.data.handouts ?? []), ...added] });
  }

  exportSessionEveningPdf(sessionId: string): Promise<void> {
    return this.hubPdf.exportSessionEveningPdf(sessionId);
  }

  exportSessionUnifiedPack(sessionId: string): Promise<void> {
    return this.hubPdf.exportSessionUnifiedPack(sessionId);
  }

  prefillSessionRunSheet(sessionId: string): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    const session = (c.data.sessions ?? []).find((s) => s.id === sessionId);
    if (!session) return;
    const patch = prefillRunSheetFromCampaign(c.data, session);
    if (!Object.keys(patch).length) {
      this.hub.rosterFeedback.set('Run sheet déjà rempli — rien à préremplir.');
      return;
    }
    this.hub.updateSession(sessionId, patch, { immediate: true });
    this.hub.rosterFeedback.set('Run sheet prérempli depuis la prépa.');
  }

  startEditHandout(handoutId: string): void {
    const c = this.hub.campaign();
    const handout = c?.data.handouts?.find((h) => h.id === handoutId);
    if (handout?.kind === 'map') {
      const map = c?.data.dungeonMaps?.find((m) => m.handoutId === handoutId);
      if (map) {
        this.hubNav.setTab('maps');
        this.hubNav.focusDungeonMapId.set(map.id);
        return;
      }
    }
    this.hub.flushHandoutSave();
    this.editingHandoutId.set(handoutId);
  }

  stopEditHandout(): void {
    this.hub.flushHandoutSave();
    this.editingHandoutId.set(null);
  }

  toggleHandoutPublished(handoutId: string, published: boolean): void {
    this.hub.toggleHandoutPublished(handoutId, published);
  }

  pinHandout(handoutId: string): void {
    this.pinnedOverlayDismissed.set(false);
    this.hub.pinHandout(handoutId);
  }

  dismissPinnedOverlay(): void {
    this.pinnedOverlayDismissed.set(true);
  }

  toggleRosterSheet(): void {
    this.rosterSheetOpen.update((v) => !v);
  }

  deleteHandout(handoutId: string): void {
    if (!this.hub.campaign()?.isOwner) return;
    this.boot.askConfirm('Supprimer le document', 'Supprimer ce document ?', () => {
      if (this.editingHandoutId() === handoutId) this.editingHandoutId.set(null);
      this.hub.deleteHandout(handoutId);
    });
  }

  addSession(): void {
    const session = this.hub.addBlankSession();
    if (!session) return;
    this.focusSessionEditor(session.id);
  }

  onScheduleEventsChange(events: CampaignScheduleEvent[]): void {
    if (!this.hub.campaign()?.isOwner) return;
    this.hub.saveData({ scheduleEvents: events });
  }

  onScheduleRsvp(ev: { eventId: string; status: 'yes' | 'no' | 'maybe' }): void {
    this.members.applyScheduleRsvp(ev.eventId, ev.status);
  }

  convertNextHubSchedule(): void {
    const next = hubView.nextScheduleGame(this.hub.campaign()?.data.scheduleEvents);
    if (!next) return;
    const ev = (this.hub.campaign()?.data.scheduleEvents ?? []).find((e) => e.id === next.id);
    if (!ev) return;
    this.convertScheduleEventToSession(ev, next.startsAt);
  }

  convertScheduleEventToSession(ev: CampaignScheduleEvent, occurrenceStartsAt?: string): void {
    if (!this.hub.campaign()?.isOwner) return;
    const scheduledAt = occurrenceStartsAt || ev.startsAt || new Date().toISOString();
    const run = () => this.doConvertScheduleEventToSession(ev, scheduledAt);
    if (ev.rrule?.trim()) {
      const when = formatScheduleOccurrenceLabel(scheduledAt);
      this.boot.askConfirm(
        'Série récurrente → une session',
        `Cette date est récurrente. Créer une session one-shot le ${when} ? Le calendrier reste récurrent.`,
        run,
        'Créer la session',
        false,
      );
      return;
    }
    run();
  }

  openSessionFromCalendar(sessionId: string): void {
    this.startEditSession(sessionId);
  }

  startEditSession(sessionId: string): void {
    this.hub.flushSessionSave();
    this.focusSessionEditor(sessionId);
  }

  stopEditSession(): void {
    this.hub.flushSessionSave();
    this.hubNav.editingSessionId.set(null);
  }

  removeSession(sessionId: string): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.boot.askConfirm('Supprimer la session', 'Supprimer cette session ?', () => {
      if (this.hubNav.editingSessionId() === sessionId) this.hubNav.editingSessionId.set(null);
      const clearedActive = this.hub.removeSession(sessionId);
      if (clearedActive) this.sessionDock.forgetAfterSessionEnd(c.id);
    });
  }

  onSessionDateChange(sessionId: string, value: string): void {
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return;
    this.hub.updateSession(sessionId, { scheduledAt: parsed.toISOString() }, { immediate: true });
  }

  upcomingSessions(): CampaignSession[] {
    return hubView.upcomingPlannedSessions(this.hub.campaign()?.data.sessions);
  }

  sortedSessions(): CampaignSession[] {
    return hubView.sortedSessionsByDate(this.hub.campaign()?.data.sessions);
  }

  private focusSessionEditor(sessionId: string): void {
    this.hubNav.editingSessionId.set(sessionId);
    this.hubNav.setTab('sessions');
    setTimeout(() => {
      document.getElementById('session-edit-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }

  private doConvertScheduleEventToSession(ev: CampaignScheduleEvent, scheduledAt: string): void {
    const session = this.members.convertScheduleEventToSession(ev, scheduledAt);
    if (!session) return;
    this.focusSessionEditor(session.id);
  }
}
