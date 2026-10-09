import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignSessionCacheService } from '@core/services/campaign-session-cache.service';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { mergeRemoteLiveTable } from '@core/utils/campaign-persist.util';
import { isRemoteNewer } from '@core/utils/campaign-remote-newer.util';
import type { CampaignDetail as CampaignDetailModel } from '@core/models/Campaign/campaign';
import { CampaignHubStore } from './campaign-hub.store';

/**
 * Load / live / stale / activity. Aucun PUT — persist = store.
 */
@Injectable()
export class CampaignHubSyncService {
  private readonly hub = inject(CampaignHubStore);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly sessionCache = inject(CampaignSessionCacheService);
  private readonly live = inject(CampaignLiveService);
  private readonly sessionDock = inject(CampaignSessionDockService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  private liveSub: Subscription | null = null;
  private softPollTimer: ReturnType<typeof setInterval> | null = null;
  private softPollIntervalMs = 12_000;
  private xpNoticeTimer: ReturnType<typeof setTimeout> | null = null;
  private staleNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.hub.registerTeardown(() => this.teardown());
  }

  reload(campaignId: string): void {
    if (!campaignId) return;
    this.hub.loading.set(true);
    this.campaigns.get(campaignId).subscribe({
      next: (c) => {
        this.hub.campaign.set(c);
        this.hub.loading.set(false);
        this.sessionCache.cache(c.id, c.title, c.data);
        this.notifications.refresh();
        this.bindLive(c.id);
        if (c.isOwner) {
          this.hub.initiativeBoard.set(null);
          this.onOwnerReloaded?.();
        } else {
          this.hub.pendingInvites.set([]);
        }
        if (this.hub.isOverview()) this.loadActivity();
        this.hub.notifyCampaignLoaded(c);
      },
      error: () => {
        const cached = this.sessionCache.read(campaignId);
        if (cached) {
          this.hub.offlineSnapshot.set(cached);
          this.hub.error.set(null);
        } else {
          this.hub.error.set('Campagne introuvable.');
        }
        this.hub.loading.set(false);
      },
    });
  }

  /** Invites / join-link owner load — branché par la page via configureOwnerReload. */
  private onOwnerReloaded: (() => void) | null = null;

  configureOwnerReload(fn: () => void): void {
    this.onOwnerReloaded = fn;
  }

  loadActivity(): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.hub.activityLoading.set(true);
    this.campaigns.listActivity(c.id).subscribe({
      next: (items) => {
        this.hub.activity.set(items);
        this.hub.activityLoading.set(false);
      },
      error: () => {
        this.hub.activity.set([]);
        this.hub.activityLoading.set(false);
      },
    });
  }

  maybeLoadActivity(): void {
    if (this.hub.isOverview()) this.loadActivity();
  }

  refreshInitiativeBoard(campaignId: string): void {
    this.campaigns.getInitiativeBoard(campaignId).subscribe({
      next: (board) => this.hub.initiativeBoard.set(board),
      error: () => this.hub.initiativeBoard.set(null),
    });
  }

  softReload(opts?: { syncOwnerIfNewer?: boolean }): void {
    const campaignId = this.hub.campaign()?.id;
    if (!campaignId || this.hub.loading() || this.hub.saving()) return;
    this.campaigns.get(campaignId).subscribe({
      next: (c) => {
        const current = this.hub.campaign();
        if (!current || current.id !== c.id) {
          this.hub.campaign.set(c);
        } else if (!current.isOwner) {
          this.announcePlayerXpGain(current, c);
          this.hub.campaign.set(c);
          this.maybeLoadActivity();
        } else if (opts?.syncOwnerIfNewer && isRemoteNewer(c.updatedAt, current.updatedAt)) {
          this.hub.staleRemote.set(c);
          this.hub.syncNotice.set(
            'Un autre onglet a une version plus récente de cette campagne.',
          );
        } else {
          if (isRemoteNewer(c.updatedAt, current.updatedAt)) {
            this.hub.staleRemote.set(c);
            this.hub.syncNotice.set(
              'Un autre onglet a une version plus récente de cette campagne.',
            );
          }
          this.hub.campaign.set({
            ...current,
            title: c.title,
            members: c.members,
            isOwner: c.isOwner,
            role: c.role,
          });
        }
        const memberIds = new Set(c.members.filter((m) => m.role === 'player').map((m) => m.userId));
        this.hub.pendingInviteUserIds.update((prev) => {
          const next = new Set([...prev].filter((id) => !memberIds.has(id)));
          return next.size === prev.size ? prev : next;
        });
        this.tuneSoftPollInterval(c);
        if (current?.isOwner) this.onOwnerReloaded?.();
      },
      error: () => {
        /* ignore soft poll */
      },
    });
  }

  softReloadLiveTable(): void {
    const campaignId = this.hub.campaign()?.id;
    if (!campaignId || this.hub.loading() || this.hub.saving()) return;
    this.campaigns.get(campaignId).subscribe({
      next: (remote) => {
        const current = this.hub.campaign();
        if (!current || current.id !== remote.id) {
          this.hub.campaign.set(remote);
          return;
        }
        if (!current.isOwner) {
          this.announcePlayerXpGain(current, remote);
          this.hub.campaign.set(remote);
          return;
        }
        const merged = mergeRemoteLiveTable(current, remote);
        this.announcePlayerXpGain(current, remote);
        this.hub.campaign.set(merged);
        this.sessionDock.patchLiveCampaign(merged);
      },
      error: () => {
        /* ignore */
      },
    });
  }

  applyStaleRemote(): void {
    const remote = this.hub.staleRemote();
    if (!remote) return;
    this.hub.campaign.set(remote);
    this.sessionCache.cache(remote.id, remote.title, remote.data);
    this.hub.staleRemote.set(null);
    this.hub.syncNotice.set('Campagne rechargée depuis l’autre onglet.');
    if (this.staleNoticeTimer) clearTimeout(this.staleNoticeTimer);
    this.staleNoticeTimer = setTimeout(() => this.hub.syncNotice.set(null), 4_000);
    this.maybeLoadActivity();
  }

  dismissStaleRemote(): void {
    this.hub.staleRemote.set(null);
    if (this.hub.syncNotice()?.includes('version plus récente')) {
      this.hub.syncNotice.set(null);
    }
  }

  startFallbackPoll(): void {
    if (this.live.connected()) return;
    this.clearSoftPollTimer();
    this.softPollIntervalMs = 12_000;
    this.softPollTimer = setInterval(() => this.softReload(), 12_000);
  }

  tuneSoftPollInterval(c: CampaignDetailModel | null): void {
    if (!c) {
      if (this.live.connected()) this.clearSoftPollTimer();
      return;
    }
    if (this.live.connected()) {
      this.clearSoftPollTimer();
      this.softPollIntervalMs = 0;
      return;
    }
    const sessionId = c.data.activeSessionId;
    const session = sessionId
      ? (c.data.sessions ?? []).find((s) => s.id === sessionId)
      : undefined;
    const liveTable =
      !c.isOwner && !!(sessionId || session?.activeCombat?.combatants?.length);
    const nextMs = liveTable ? 4_000 : 12_000;
    if (this.softPollIntervalMs === nextMs && this.softPollTimer) return;
    this.softPollIntervalMs = nextMs;
    this.clearSoftPollTimer();
    this.softPollTimer = setInterval(() => this.softReload(), nextMs);
  }

  teardown(): void {
    this.clearSoftPollTimer();
    this.liveSub?.unsubscribe();
    this.liveSub = null;
    void this.live.unwatch();
    if (this.xpNoticeTimer) clearTimeout(this.xpNoticeTimer);
    if (this.staleNoticeTimer) clearTimeout(this.staleNoticeTimer);
  }

  private bindLive(campaignId: string): void {
    void this.live.watch(campaignId);
    this.liveSub?.unsubscribe();
    this.liveSub = this.live.updates(campaignId).subscribe((evt) => {
      const owner = this.hub.campaign()?.isOwner === true;
      if (owner && (evt.reason === 'combat' || evt.reason === 'initiative' || evt.reason === 'xp')) {
        this.softReloadLiveTable();
      } else {
        this.softReload();
      }
      if (evt.reason === 'initiative' || !owner) {
        this.refreshInitiativeBoard(campaignId);
      }
    });
  }

  private announcePlayerXpGain(
    previous: CampaignDetailModel,
    next: CampaignDetailModel,
  ): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const before =
      previous.members.find((m) => m.userId === userId && m.role === 'player')?.xpEarnedInCampaign ??
      0;
    const after =
      next.members.find((m) => m.userId === userId && m.role === 'player')?.xpEarnedInCampaign ?? 0;
    const delta = after - before;
    if (delta <= 0) return;
    this.hub.staleRemote.set(null);
    this.hub.syncNotice.set(`+${delta} XP reçue — total campagne ${after}`);
    this.hub.xpLevelUpAvailable.set(
      !!next.members.find((m) => m.userId === userId && m.role === 'player')?.approvedCharacterId,
    );
    if (this.xpNoticeTimer) clearTimeout(this.xpNoticeTimer);
    this.xpNoticeTimer = setTimeout(() => {
      if (this.hub.syncNotice()?.startsWith('+') && this.hub.syncNotice()?.includes('XP reçue')) {
        this.hub.syncNotice.set(null);
        this.hub.xpLevelUpAvailable.set(false);
      }
    }, 12_000);
  }

  private clearSoftPollTimer(): void {
    if (this.softPollTimer) {
      clearInterval(this.softPollTimer);
      this.softPollTimer = null;
    }
  }
}
