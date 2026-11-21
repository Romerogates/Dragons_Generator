import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import {
  campaignHubQueryParams,
  campaignHubQueryUnchanged,
  clampHubTabsForViewer,
  clampPrepSubForRole,
  isCampaignPrepSub,
  playerPrepTabBlocked,
  resolveCampaignHubDeepLink,
  resolveCampaignPrepSub,
  type CampaignPrepSub,
  type CampaignPrimaryTab,
} from '@core/utils/campaign-detail-tabs.util';
import { campaignIsTableDm } from '@core/utils/campaign-hub-access.util';
import { KEEP_SCROLL_STATE } from '@core/routing/keep-scroll-viewport-scroller';

export type CampaignHubTabTarget = CampaignPrimaryTab | CampaignPrepSub | 'activity';

export interface CampaignHubNavHooks {
  campaign: () => CampaignDetail | null;
  flushMaps: () => void;
  loadActivity: () => void;
  onHandoutsOpened: () => void;
  ensureNotebook: () => void;
}

/**
 * Onglets / deep-links du hub. Fourni sur `CampaignDetailPage`.
 * Persist = store (cette classe ne PUT pas).
 */
@Injectable()
export class CampaignHubNavService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private hooks: CampaignHubNavHooks | null = null;

  readonly tab = signal<CampaignPrimaryTab>('overview');
  readonly prepSub = signal<CampaignPrepSub>('scenario');
  readonly editingSessionId = signal<string | null>(null);
  readonly focusHandoutId = signal<string | null>(null);
  readonly focusScheduleEventId = signal<string | null>(null);
  readonly focusDungeonMapId = signal<string | null>(null);
  readonly mapsAutoAction = signal<'generate' | 'import' | null>(null);

  configure(hooks: CampaignHubNavHooks): void {
    this.hooks = hooks;
  }

  isOnMapsView(): boolean {
    return this.tab() === 'prep' && this.prepSub() === 'maps';
  }

  applyDeepLink(
    tab: string,
    handoutId: string | null,
    mapId: string | null = null,
    sessionId: string | null = null,
    scheduleEventId: string | null = null,
    mapsAction: string | null = null,
    sub: string | null = null,
  ): void {
    const intent = resolveCampaignHubDeepLink(
      tab,
      handoutId,
      mapId,
      sessionId,
      scheduleEventId,
      mapsAction,
      sub,
    );
    switch (intent.kind) {
      case 'map':
        this.setTab('maps');
        this.focusDungeonMapId.set(intent.mapId);
        return;
      case 'session':
        this.setTab('sessions');
        this.editingSessionId.set(intent.sessionId);
        setTimeout(() => {
          document.getElementById('session-edit-panel')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 120);
        return;
      case 'event':
        this.setTab('calendar');
        this.focusScheduleEventId.set(intent.eventId);
        return;
      case 'mapsAction':
        this.setTab('maps');
        this.mapsAutoAction.set(intent.action);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { mapsAction: null, tab: 'prep', sub: 'maps' },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        setTimeout(() => this.mapsAutoAction.set(null), 8000);
        return;
      case 'primary':
        this.setTab(intent.tab);
        if (intent.tab === 'handouts' && intent.handoutId) {
          this.focusHandoutId.set(intent.handoutId);
        }
        return;
      case 'prep':
        this.setTab(intent.sub ?? 'prep');
        return;
      case 'activity':
        this.setTab('overview');
        return;
      case 'legacyPrep':
        this.setTab(intent.sub);
        return;
      case 'none':
        return;
    }
  }

  setPrepSub(sub: CampaignPrepSub): void {
    const next = clampPrepSubForRole(sub, campaignIsTableDm(this.hooks?.campaign()));
    if (this.isOnMapsView() && next !== 'maps') this.hooks?.flushMaps();
    this.prepSub.set(next);
    if (next === 'notebook') this.hooks?.ensureNotebook();
    this.syncTabQueryParams();
  }

  setTab(t: CampaignHubTabTarget): void {
    const campaign = this.hooks?.campaign();
    // Campagne pas encore chargée : ne pas traiter le MJ comme un joueur (sinon maps → pré-tirés).
    const owner = campaign ? campaignIsTableDm(campaign) : true;

    if (t === 'activity') {
      if (this.isOnMapsView()) this.hooks?.flushMaps();
      this.tab.set('overview');
      this.hooks?.loadActivity();
      this.syncTabQueryParams();
      return;
    }

    if (t === 'prep' || isCampaignPrepSub(t)) {
      const c = this.hooks?.campaign();
      if (c && playerPrepTabBlocked(campaignIsTableDm(c), c.data.pregenCharacters?.length ?? 0)) {
        this.tab.set('overview');
        this.syncTabQueryParams();
        return;
      }
      const finalSub = resolveCampaignPrepSub(t, owner, this.prepSub());
      if (this.isOnMapsView() && finalSub !== 'maps') this.hooks?.flushMaps();
      this.tab.set('prep');
      this.prepSub.set(finalSub);
      if (finalSub === 'notebook') this.hooks?.ensureNotebook();
      this.syncTabQueryParams();
      return;
    }

    if (this.isOnMapsView()) this.hooks?.flushMaps();
    this.tab.set(t);
    this.syncTabQueryParams();
    if (t === 'handouts' && owner) this.hooks?.onHandoutsOpened();
    if (t === 'overview') this.hooks?.loadActivity();
  }

  clampAfterLoad(mjUi: boolean, pregenCount: number): void {
    const next = clampHubTabsForViewer(mjUi, pregenCount, this.tab(), this.prepSub());
    this.tab.set(next.tab);
    this.prepSub.set(next.prepSub);
  }

  /** Si le haut de la section est passé au-dessus de l'écran, le ramener juste sous l'en-tête collant. */
  private revealHubContent(): void {
    requestAnimationFrame(() => {
      const content = document.querySelector('app-campaign-detail-tabs');
      if (!content) return;
      const tabs = document.querySelector('.campaign-hub-tabs');
      const stickyTop = tabs ? parseFloat(getComputedStyle(tabs).top) || 0 : 0;
      const top = content.getBoundingClientRect().top;
      if (top >= stickyTop) return;
      window.scrollTo({ top: window.scrollY + top - stickyTop - 8, behavior: 'smooth' });
    });
  }

  private syncTabQueryParams(): void {
    this.revealHubContent();
    const queryParams = campaignHubQueryParams(this.tab(), this.prepSub());
    if (campaignHubQueryUnchanged(this.route.snapshot.queryParamMap, queryParams)) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
      state: KEEP_SCROLL_STATE,
    });
  }
}
