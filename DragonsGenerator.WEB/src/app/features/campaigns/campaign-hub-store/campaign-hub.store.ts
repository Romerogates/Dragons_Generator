import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CampaignCloudService,
  type CampaignActivityItem,
  type CampaignPendingInvite,
  type InitiativeBoard,
} from '@core/services/campaign-cloud.service';
import {
  CampaignSessionCacheService,
  type SessionCachePayload,
} from '@core/services/campaign-session-cache.service';
import { stripTableChatForPersist } from '@core/utils/campaign-persist.util';
import {
  canWriteCampaignHub,
  dataAfterDeletingHandout,
  dataAfterRemovingSession,
  handoutPublishPatch,
  shouldDebounceCampaignPersist,
  withMappedHandout,
  withMappedSession,
} from '@core/utils/campaign-hub-write.util';
import {
  createCampaignHandout,
  type CampaignAtlasPin,
  type CampaignData,
  type CampaignDetail as CampaignDetailModel,
  type CampaignHandout,
  type CampaignSession,
} from '@core/models/Campaign/campaign';

export type { CampaignPendingInvite };

export type CampaignHubSyncHooks = {
  onOk?: () => void;
  onFail?: () => void;
};

export type CampaignPregenAttachHooks = {
  onShowPregens?: () => void;
};

/**
 * État + persist unique du hub (PUT debounce / sessions / handouts / notes).
 * Sync, roster HTTP et pré-tirés sont des collaborateurs fournis sur la page.
 */
@Injectable()
export class CampaignHubStore {
  private readonly campaigns = inject(CampaignCloudService);
  private readonly sessionCache = inject(CampaignSessionCacheService);
  private readonly teardowns: Array<() => void> = [];

  readonly campaign = signal<CampaignDetailModel | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly offlineSnapshot = signal<SessionCachePayload | null>(null);
  readonly syncNotice = signal<string | null>(null);
  readonly xpLevelUpAvailable = signal(false);
  readonly staleRemote = signal<CampaignDetailModel | null>(null);
  readonly activity = signal<CampaignActivityItem[]>([]);
  readonly activityLoading = signal(false);
  readonly initiativeBoard = signal<InitiativeBoard | null>(null);
  readonly awardingXpId = signal<string | null>(null);
  readonly pendingInviteUserIds = signal<Set<string>>(new Set());
  readonly pendingInvites = signal<CampaignPendingInvite[]>([]);
  readonly rosterFeedback = signal<string | null>(null);
  readonly joinLink = signal<{ token: string | null; enabled: boolean } | null>(null);
  readonly joinLinkBusy = signal(false);
  readonly characterRequestLoadingId = signal<string | null>(null);
  readonly importingPregen = signal(false);
  readonly generatingAutoPregen = signal(false);
  readonly pregenFeedback = signal<string | null>(null);
  readonly pregenUndoAvailable = signal(false);
  readonly archiving = signal(false);
  readonly leaving = signal(false);
  readonly deletingCampaign = signal(false);
  readonly deleteCampaignError = signal<string | null>(null);

  private persistSeq = 0;
  private persistTail: Promise<void> = Promise.resolve();
  private softPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private handoutSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private isSupportInspect: () => boolean = () => false;
  private onPersisted: (() => void) | null = null;
  private isOverviewTab: () => boolean = () => false;
  private onCampaignLoaded: ((c: CampaignDetailModel) => void) | null = null;

  registerTeardown(fn: () => void): void {
    this.teardowns.push(fn);
  }

  configure(opts: {
    isSupportInspect: () => boolean;
    onPersisted?: () => void;
    isOverviewTab?: () => boolean;
    onCampaignLoaded?: (c: CampaignDetailModel) => void;
  }): void {
    this.isSupportInspect = opts.isSupportInspect;
    this.onPersisted = opts.onPersisted ?? null;
    this.isOverviewTab = opts.isOverviewTab ?? (() => false);
    this.onCampaignLoaded = opts.onCampaignLoaded ?? null;
  }

  isInspecting(): boolean {
    return this.isSupportInspect();
  }

  isOverview(): boolean {
    return this.isOverviewTab();
  }

  notifyCampaignLoaded(c: CampaignDetailModel): void {
    this.onCampaignLoaded?.(c);
  }

  saveData(patch: Partial<CampaignData>, onSuccess?: () => void): void {
    const c = this.campaign();
    if (!c || !canWriteCampaignHub(c, this.isSupportInspect())) return;
    const data = { ...c.data, ...patch };
    this.campaign.update((prev) => (prev ? { ...prev, data } : prev));

    if (shouldDebounceCampaignPersist(patch)) {
      this.scheduleSoftPersist();
      return;
    }

    this.clearSoftPersistTimer();
    const latest = this.campaign();
    if (!latest) return;
    this.persist(latest.title, latest.data, onSuccess);
  }

  saveTitle(title: string): void {
    const c = this.campaign();
    if (!c) return;
    this.campaign.update((prev) => (prev ? { ...prev, title } : prev));
    this.scheduleSoftPersist();
  }

  persistNow(data: CampaignData, onSuccess?: () => void): void {
    const c = this.campaign();
    if (!c) return;
    this.persist(c.title, data, onSuccess);
  }

  flushSoftPersist(): void {
    if (!this.softPersistTimer) return;
    this.clearSoftPersistTimer();
    const latest = this.campaign();
    if (!latest?.isOwner) return;
    this.persist(latest.title, latest.data);
  }

  updateSession(
    sessionId: string,
    patch: Partial<CampaignSession>,
    options?: { immediate?: boolean },
  ): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const sessions = withMappedSession(c.data.sessions, sessionId, patch);
    this.campaign.update((prev) =>
      prev ? { ...prev, data: { ...prev.data, sessions } } : prev,
    );
    if (options?.immediate) {
      this.clearSessionSaveTimer();
      this.saveData({ sessions });
      return;
    }
    this.scheduleSessionSave();
  }

  flushSessionSave(): void {
    if (!this.sessionSaveTimer) return;
    this.clearSessionSaveTimer();
    const latest = this.campaign();
    if (!latest?.isOwner) return;
    this.saveData({ sessions: latest.data.sessions ?? [] });
  }

  addBlankSession(): CampaignSession | null {
    const c = this.campaign();
    if (!c?.isOwner) return null;
    this.flushSessionSave();
    const session: CampaignSession = {
      id: crypto.randomUUID?.() ?? `session-${Date.now()}`,
      title: 'Session 1',
      scheduledAt: new Date().toISOString(),
      status: 'planned',
      mode: 'online',
    };
    this.saveData({ sessions: [session, ...(c.data.sessions ?? [])] });
    return session;
  }

  /** @returns true si la session active a été coupée. */
  removeSession(sessionId: string): boolean {
    const c = this.campaign();
    if (!c?.isOwner) return false;
    this.flushSessionSave();
    const { patch, clearedActive } = dataAfterRemovingSession(c.data, sessionId);
    this.saveData(patch);
    return clearedActive;
  }

  updateHandout(
    handoutId: string,
    patch: Partial<CampaignHandout>,
    options?: { immediate?: boolean },
  ): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const handouts = withMappedHandout(
      c.data.handouts,
      handoutId,
      patch,
      new Date().toISOString(),
    );
    this.campaign.update((prev) =>
      prev ? { ...prev, data: { ...prev.data, handouts } } : prev,
    );
    if (options?.immediate) {
      this.clearHandoutSaveTimer();
      this.saveData({ handouts });
      return;
    }
    this.scheduleHandoutSave();
  }

  flushHandoutSave(): void {
    if (!this.handoutSaveTimer) return;
    this.clearHandoutSaveTimer();
    const latest = this.campaign();
    if (!latest?.isOwner) return;
    this.saveData({ handouts: latest.data.handouts ?? [] });
  }

  addBlankHandout(): CampaignHandout | null {
    const c = this.campaign();
    if (!c?.isOwner) return null;
    this.flushHandoutSave();
    const handout = createCampaignHandout();
    this.saveData({ handouts: [...(c.data.handouts ?? []), handout] });
    return handout;
  }

  toggleHandoutPublished(handoutId: string, published: boolean): void {
    this.updateHandout(handoutId, handoutPublishPatch(published, new Date().toISOString()), {
      immediate: true,
    });
  }

  pinHandout(handoutId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const next = c.data.pinnedHandoutId === handoutId ? null : handoutId;
    this.saveData({ pinnedHandoutId: next });
  }

  deleteHandout(handoutId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.flushHandoutSave();
    this.saveData(dataAfterDeletingHandout(c.data, handoutId));
  }

  pushAtlasPin(pin: CampaignAtlasPin): void {
    const c = this.campaign();
    if (!c) return;
    this.saveData({ atlasPins: [...(c.data.atlasPins ?? []), pin] });
  }

  removeAtlasPin(pinId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.saveData({ atlasPins: (c.data.atlasPins ?? []).filter((p) => p.id !== pinId) });
  }

  destroy(): void {
    this.flushSessionSave();
    this.flushHandoutSave();
    this.flushSoftPersist();
    for (const fn of this.teardowns) fn();
    this.teardowns.length = 0;
  }

  private scheduleSoftPersist(): void {
    if (this.softPersistTimer) clearTimeout(this.softPersistTimer);
    this.softPersistTimer = setTimeout(() => {
      this.softPersistTimer = null;
      const latest = this.campaign();
      if (!latest?.isOwner) return;
      this.persist(latest.title, latest.data);
    }, 450);
  }

  private clearSoftPersistTimer(): void {
    if (!this.softPersistTimer) return;
    clearTimeout(this.softPersistTimer);
    this.softPersistTimer = null;
  }

  private scheduleSessionSave(): void {
    if (this.sessionSaveTimer) clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = setTimeout(() => {
      this.sessionSaveTimer = null;
      const latest = this.campaign();
      if (!latest) return;
      this.saveData({ sessions: latest.data.sessions ?? [] });
    }, 700);
  }

  private clearSessionSaveTimer(): void {
    if (!this.sessionSaveTimer) return;
    clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = null;
  }

  private scheduleHandoutSave(): void {
    if (this.handoutSaveTimer) clearTimeout(this.handoutSaveTimer);
    this.handoutSaveTimer = setTimeout(() => {
      this.handoutSaveTimer = null;
      const latest = this.campaign();
      this.saveData({ handouts: latest?.data.handouts ?? [] });
    }, 700);
  }

  private clearHandoutSaveTimer(): void {
    if (!this.handoutSaveTimer) return;
    clearTimeout(this.handoutSaveTimer);
    this.handoutSaveTimer = null;
  }

  private persist(title: string, data: CampaignData, onSuccess?: () => void): void {
    const c = this.campaign();
    if (!c || this.isSupportInspect()) return;
    const campaignId = c.id;
    const seq = ++this.persistSeq;
    this.saving.set(true);
    this.error.set(null);
    const payload = stripTableChatForPersist(data);

    this.persistTail = this.persistTail
      .catch(() => undefined)
      .then(async () => {
        try {
          const summary = await firstValueFrom(this.campaigns.update(campaignId, title, payload));
          this.campaign.update((prev) => {
            if (!prev || prev.id !== campaignId) return prev;
            return { ...prev, updatedAt: summary.updatedAt };
          });
          const latest = this.campaign();
          this.sessionCache.cache(campaignId, latest?.title ?? title, latest?.data ?? data);
          if (seq === this.persistSeq) this.saving.set(false);
          this.onPersisted?.();
          onSuccess?.();
        } catch {
          if (seq === this.persistSeq) {
            this.error.set('Échec de la sauvegarde.');
            this.saving.set(false);
          }
        }
      });
  }
}
