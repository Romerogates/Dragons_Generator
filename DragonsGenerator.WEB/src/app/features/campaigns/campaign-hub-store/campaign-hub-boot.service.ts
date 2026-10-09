import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { DataService } from '@core/services/data.service';
import { FriendsService } from '@core/services/friends.service';
import {
  UI_BANNER_IDS,
  UiBannerPreferencesService,
} from '@core/services/ui-banner-preferences.service';
import type { CampaignDetail as CampaignDetailModel, FriendUser } from '@core/models/Campaign/campaign';
import {
  campaignDetailTabHintFromQuery,
  shouldApplyCampaignDetailRouteQuery,
} from '@core/utils/campaign-detail-tabs.util';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubSyncService } from './campaign-hub-sync.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubPdfService } from './campaign-hub-pdf.service';

export type CampaignHubConfirmDialog = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

export interface CampaignHubBootHooks {
  flushMaps: () => void;
  attachPregen: (characterId: string) => Promise<void>;
  openLevelUp: () => void;
  mjUi: (c: CampaignDetailModel) => boolean;
}

/**
 * Boot hub : init route, bannières, confirm, initiative.
 * Persist = store uniquement.
 */
@Injectable()
export class CampaignHubBootService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hub = inject(CampaignHubStore);
  private readonly hubSync = inject(CampaignHubSyncService);
  private readonly hubNav = inject(CampaignHubNavService);
  private readonly hubPdf = inject(CampaignHubPdfService);
  private readonly auth = inject(AuthService);
  private readonly live = inject(CampaignLiveService);
  private readonly friends = inject(FriendsService);
  private readonly characters = inject(CharacterCloudService);
  private readonly data = inject(DataService);
  private readonly banners = inject(UiBannerPreferencesService);
  private hooks: CampaignHubBootHooks | null = null;
  private initiativePollTimer: ReturnType<typeof setInterval> | null = null;

  readonly welcomeBanner = signal<string | null>(null);
  readonly friendsList = signal<FriendUser[]>([]);
  readonly myCharacters = signal<{ id: string; name: string }[]>([]);
  readonly dmCharacters = signal<{ id: string; name: string }[]>([]);
  readonly creatureXpMap = signal<Record<string, number>>({});
  readonly confirmDialog = signal<CampaignHubConfirmDialog | null>(null);
  readonly mobileMoreOpen = signal(false);

  configure(hooks: CampaignHubBootHooks): void {
    this.hooks = hooks;
  }

  flushMaps(): void {
    this.hooks?.flushMaps();
  }

  toggleMobileMore(): void {
    this.mobileMoreOpen.update((v) => !v);
  }

  askConfirm(
    title: string,
    body: string,
    onConfirm: () => void,
    confirmLabel = 'Supprimer',
    danger = true,
  ): void {
    this.confirmDialog.set({ title, body, confirmLabel, danger, onConfirm });
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

  dismissWelcomeBanner(): void {
    this.welcomeBanner.set(null);
    this.banners.dismiss(UI_BANNER_IDS.welcomeCampaign);
  }

  start(): void {
    if (!this.auth.isLoggedIn()) {
      this.hub.loading.set(false);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/campaigns']);
      return;
    }

    this.data
      .getCreaturesSummary()
      .pipe(catchError(() => of([])))
      .subscribe((list) => {
        const map: Record<string, number> = {};
        for (const c of list) map[c.id] = c.xp;
        this.creatureXpMap.set(map);
      });

    this.reload(id);
    this.friends.listFriends().subscribe((f) => this.friendsList.set(f));
    this.characters.list().subscribe((chars) => {
      this.myCharacters.set(chars.map((c) => ({ id: c.id, name: c.name })));
      if (this.hub.campaign()?.isOwner) {
        this.dmCharacters.set(chars.map((c) => ({ id: c.id, name: c.name })));
      }
    });

    if (!this.live.connected()) {
      this.hubSync.startFallbackPoll();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onWindowFocus);
    }

    this.applyInitialDeepLink();
    this.route.queryParamMap.subscribe((params) => {
      const query = {
        tab: params.get('tab'),
        sub: params.get('sub'),
        mapId: params.get('map'),
        sessionId: params.get('session'),
        eventId: params.get('event'),
        mapsAction: params.get('mapsAction'),
      };
      if (shouldApplyCampaignDetailRouteQuery(query)) {
        this.hubNav.applyDeepLink(
          campaignDetailTabHintFromQuery(query),
          params.get('handout') ?? params.get('handoutId'),
          params.get('map'),
          params.get('session'),
          params.get('event'),
          params.get('mapsAction'),
          params.get('sub'),
        );
      }
    });
    this.applyWelcomeQueryFlags();
  }

  destroy(): void {
    this.hub.destroy();
    this.hooks?.flushMaps();
    this.stopInitiativeBannerPoll();
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
    }
    this.hubPdf.destroy();
  }

  afterCampaignLoaded(c: CampaignDetailModel): void {
    const mj = this.hooks?.mjUi(c) === true;
    this.hubNav.clampAfterLoad(mj, c.data.pregenCharacters?.length ?? 0);
    if (!mj) {
      this.startInitiativeBannerPoll(c.id);
    } else {
      this.stopInitiativeBannerPoll();
      this.hub.initiativeBoard.set(null);
    }
  }

  onInitiativeSubmitted(): void {
    const id = this.hub.campaign()?.id;
    if (!id) return;
    this.hubSync.refreshInitiativeBoard(id);
  }

  reload(id?: string): void {
    const campaignId = id ?? this.hub.campaign()?.id;
    if (!campaignId) return;
    this.hubSync.reload(campaignId);
  }

  private applyInitialDeepLink(): void {
    const q = this.route.snapshot.queryParamMap;
    const tab = q.get('tab');
    const sub = q.get('sub');
    const mapId = q.get('map');
    const sessionId = q.get('session');
    const scheduleEventId = q.get('event');
    const mapsAction = q.get('mapsAction');
    const handoutId = q.get('handout') ?? q.get('handoutId');
    if (tab || sub || mapId || sessionId || scheduleEventId || mapsAction) {
      this.hubNav.applyDeepLink(
        tab ?? (sessionId ? 'sessions' : scheduleEventId ? 'calendar' : 'maps'),
        handoutId,
        mapId,
        sessionId,
        scheduleEventId,
        mapsAction,
        sub,
      );
    }
  }

  private applyWelcomeQueryFlags(): void {
    const q = this.route.snapshot.queryParamMap;
    if (q.get('joined') === '1') {
      this.welcomeBanner.set(
        'Bienvenue dans la campagne — proposez un héros dans l’onglet Joueurs, ou forgez-en un.',
      );
      this.clearQuery({ joined: null });
    }
    if (q.get('levelUp') === '1') {
      this.hooks?.openLevelUp();
      this.clearQuery({ levelUp: null, characterId: null });
    }
    if (q.get('proposed') === '1') {
      this.welcomeBanner.set('Héros proposé au MJ — il apparaîtra ici dès validation.');
      this.clearQuery({ proposed: null });
    }
    const addPregenId = q.get('addPregen')?.trim();
    if (addPregenId) {
      this.clearQuery({ addPregen: null });
      const waitOwner = setInterval(() => {
        const c = this.hub.campaign();
        if (!c) return;
        clearInterval(waitOwner);
        if (c.isOwner) void this.hooks?.attachPregen(addPregenId);
      }, 50);
      setTimeout(() => clearInterval(waitOwner), 8_000);
    }
  }

  private clearQuery(queryParams: Record<string, null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private startInitiativeBannerPoll(campaignId: string): void {
    this.stopInitiativeBannerPoll();
    const refresh = () => this.hubSync.refreshInitiativeBoard(campaignId);
    refresh();
    const ms = this.live.fallbackPollMs(8_000);
    this.initiativePollTimer = setInterval(refresh, ms);
  }

  private stopInitiativeBannerPoll(): void {
    if (!this.initiativePollTimer) return;
    clearInterval(this.initiativePollTimer);
    this.initiativePollTimer = null;
  }

  private readonly onWindowFocus = (): void => {
    if (this.auth.isLoggedIn()) this.hubSync.softReload({ syncOwnerIfNewer: true });
  };
}
