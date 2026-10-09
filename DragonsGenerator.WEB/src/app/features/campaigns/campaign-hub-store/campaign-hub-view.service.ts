import { computed, inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';
import {
  UI_BANNER_IDS,
  UiBannerPreferencesService,
} from '@core/services/ui-banner-preferences.service';
import {
  CREATURE_ROLE_LABELS,
  PREGEN_STATUS_LABELS,
  encounterPendingXp,
  encounterTotalXp,
} from '@core/models/Campaign/campaign';
import { ADVENTURE_TONE_LABELS, CreatureRole, StoryCreatureSelection } from '@core/models/Story/story';
import { formatChallengeRating, getCreatureCategoryLabel } from '@core/utils/creature-display.util';
import { shouldShowPlayerInitiativePrompt } from '@core/utils/campaign-initiative.util';
import type { HubNextAction } from '@core/utils/hub-next-action.util';
import {
  campaignPrepSubTabs,
  visibleCampaignHubTabs,
  type CampaignHubTabDef,
} from '@core/utils/campaign-detail-tabs.util';
import * as hubView from '@core/utils/campaign-hub-view.util';
import {
  campaignIsSupportInspect,
  campaignLoginReturnUrl,
  campaignMjUi,
} from '@core/utils/campaign-hub-access.util';
import type { CalendarHeroOption } from '@core/utils/schedule-ics.util';
import {
  dispatchCampaignSetupGuide,
  type CampaignSetupAction,
  type CampaignSetupGuideInput,
} from '../campaign-detail/campaign-setup-guide/campaign-setup-guide.util';
import type {
  FirstSessionAction,
  FirstSessionChecklistInput,
} from '../campaign-detail/campaign-first-session-checklist.util';
import {
  formatSessionDate,
  sessionModeLabel,
  sessionStatusLabel,
} from '../campaign-detail/campaign-session.util';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubPdfService } from './campaign-hub-pdf.service';
import { CampaignHubSheetsService } from './campaign-hub-sheets.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubBootService } from './campaign-hub-boot.service';
import { CampaignHubRosterService } from './campaign-hub-roster.service';
import { CampaignHubTableService } from './campaign-hub-table.service';
import { CampaignHubPrepService } from './campaign-hub-prep.service';

type TabDef = CampaignHubTabDef;

/**
 * Vue hub (dérivés + CTA). Persist = `CampaignHubStore`. Atlas reste sur la page.
 */
@Injectable()
export class CampaignHubViewService {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly banners = inject(UiBannerPreferencesService);

  readonly hub = inject(CampaignHubStore);
  readonly hubPdf = inject(CampaignHubPdfService);
  readonly hubSheets = inject(CampaignHubSheetsService);
  readonly hubNav = inject(CampaignHubNavService);
  readonly boot = inject(CampaignHubBootService);
  readonly roster = inject(CampaignHubRosterService);
  readonly table = inject(CampaignHubTableService);
  readonly prep = inject(CampaignHubPrepService);
  readonly aiProgress = inject(AiGenerationProgressService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly currentUserId = computed(() => this.auth.user()?.id ?? null);
  readonly isSpectator = computed(() => this.hub.campaign()?.role === 'spectator');
  readonly isSupportInspect = computed(() =>
    campaignIsSupportInspect(
      this.hub.campaign()?.role,
      this.route.snapshot.queryParamMap.get('support'),
    ),
  );

  mjUi(c: { isOwner: boolean; role?: string } | null | undefined): boolean {
    return campaignMjUi(c, this.route.snapshot.queryParamMap.get('support'));
  }

  readonly loginReturnUrl = computed(() =>
    campaignLoginReturnUrl(this.route.snapshot.paramMap.get('id'), this.router.url),
  );

  readonly showWelcomeBanner = computed(
    () =>
      !!this.boot.welcomeBanner() &&
      this.banners.hydrated() &&
      this.banners.isVisible(UI_BANNER_IDS.welcomeCampaign),
  );
  readonly showGuideLinks = computed(() =>
    this.banners.isVisible(UI_BANNER_IDS.contextualGuideLinks),
  );

  readonly players = computed(() => hubView.membersByRole(this.hub.campaign()?.members, 'player'));
  readonly spectators = computed(() => hubView.membersByRole(this.hub.campaign()?.members, 'spectator'));
  readonly approvedPlayersWithCharacter = computed(() =>
    hubView.approvedPlayersWithCharacter(this.players()),
  );
  readonly pdfSheetMembers = computed(() => hubView.pdfSheetMembers(this.players()));
  readonly pdfUnassignedPregens = computed(() =>
    hubView.pdfUnassignedPregens(this.hub.campaign()?.data.pregenCharacters, this.pdfSheetMembers()),
  );
  readonly pendingProposals = computed(() => hubView.pendingProposals(this.players()));
  readonly playersNeedingCharacter = computed(() => hubView.playersNeedingCharacter(this.players()));
  readonly invitableFriends = computed(() =>
    hubView.invitableFriends(this.boot.friendsList(), this.players(), this.hub.pendingInviteUserIds()),
  );
  readonly otherPlayers = computed(() => hubView.otherPlayers(this.players(), this.auth.user()?.id));
  readonly totalXpAwarded = computed(() => hubView.totalXpAwarded(this.hub.campaign()?.members));
  readonly myPlayerMember = computed(() => hubView.findPlayerMember(this.players(), this.auth.user()?.id));
  readonly myXpEarned = computed(() => this.myPlayerMember()?.xpEarnedInCampaign ?? 0);
  readonly pastSessions = computed(() => hubView.pastSessions(this.hub.campaign()?.data.sessions));

  readonly showOverviewRoster = computed(() => {
    const c = this.hub.campaign();
    if (!c?.isOwner) return false;
    return (
      this.approvedPlayersWithCharacter().length > 0 ||
      this.pendingProposals().length > 0 ||
      this.playersNeedingCharacter().length > 0
    );
  });

  readonly playersTabBadgeCount = computed(() => {
    if (!this.hub.campaign()?.isOwner) return 0;
    return this.pendingProposals().length;
  });

  readonly activeSession = computed(() => hubView.ownerActiveSession(this.hub.campaign()));
  readonly nextPlannedSession = computed(() =>
    hubView.nextPlannedSession(this.hub.campaign()?.data.sessions),
  );
  readonly pendingHubRsvp = computed(() =>
    hubView.pendingHubRsvp(this.hub.campaign(), this.currentUserId(), formatSessionDate),
  );
  readonly hubNextAction = computed((): HubNextAction | null =>
    hubView.hubNextActionForPlayer(
      this.hub.campaign(),
      this.myPlayerMember(),
      this.nextPlannedSession(),
      this.pendingHubRsvp(),
    ),
  );
  readonly nextScheduleGame = computed(() =>
    hubView.nextScheduleGame(this.hub.campaign()?.data.scheduleEvents),
  );
  readonly nextHubTable = computed(() =>
    hubView.nextHubTableSlot(this.nextPlannedSession(), this.nextScheduleGame()),
  );

  readonly setupGuideState = computed((): CampaignSetupGuideInput => {
    const c = this.hub.campaign();
    const data = c?.data;
    return {
      hasAdventure: !!(data?.adventure?.trim()),
      creatureCount: data?.creatures?.length ?? 0,
      mapCount: data?.dungeonMaps?.length ?? 0,
      encounterCount: data?.encounters?.length ?? 0,
      approvedPlayerCount: this.approvedPlayersWithCharacter().length,
      playerCount: this.players().length,
      readyPregenCount: hubView.readyPregenCount(data?.pregenCharacters),
      hasPlannedSession: hubView.countSessionsByStatus(data?.sessions, 'planned') > 0,
      hasActiveSession: !!this.activePlaySession(),
      nextSessionTitle: this.nextHubTable()?.title ?? null,
      mapsSkipped: this.prep.mapsStepSkipped(),
    };
  });

  readonly firstSessionChecklist = computed((): FirstSessionChecklistInput => {
    const data = this.hub.campaign()?.data;
    const link = this.hub.joinLink();
    return {
      hasInviteActivity:
        this.hub.pendingInvites().length > 0 ||
        this.players().length > 1 ||
        !!(link?.enabled && link.token),
      approvedPlayerCount: this.approvedPlayersWithCharacter().length,
      readyPregenCount: hubView.readyPregenCount(data?.pregenCharacters),
      hasPlannedSession: hubView.countSessionsByStatus(data?.sessions, 'planned') > 0,
      hasActiveSession: !!this.activePlaySession(),
      playedSessionCount: this.playedSessionCount(),
    };
  });

  readonly visibleTabs = computed((): TabDef[] =>
    visibleCampaignHubTabs(
      this.hub.campaign()?.isOwner === true,
      this.hub.campaign()?.data.pregenCharacters?.length ?? 0,
    ),
  );
  readonly prepSubTabs = computed(() => campaignPrepSubTabs(this.hub.campaign()?.isOwner === true));
  readonly plannedSessionCount = computed(() =>
    hubView.countSessionsByStatus(this.hub.campaign()?.data.sessions, 'planned'),
  );
  readonly playedSessionCount = computed(() =>
    hubView.countSessionsByStatus(this.hub.campaign()?.data.sessions, 'played'),
  );
  readonly documentCount = computed(() => hubView.documentCount(this.hub.campaign()));
  readonly pinnedHandout = computed(() => hubView.pinnedPublishedHandout(this.hub.campaign()));
  readonly showPinnedOverlay = computed(
    () => !this.hub.campaign()?.isOwner && !!this.pinnedHandout() && !this.table.pinnedOverlayDismissed(),
  );
  readonly lastPublishedHandoutTitle = computed(() =>
    hubView.lastPublishedHandoutTitle(this.hub.campaign()?.data.handouts),
  );
  readonly activePlaySession = computed(() =>
    hubView.sessionById(this.hub.campaign()?.data.sessions, this.hub.campaign()?.data.activeSessionId),
  );
  readonly allyCreatures = computed(() =>
    hubView.creaturesByRoleBucket(this.hub.campaign()?.data.creatures, 'ally'),
  );
  readonly adversaryCreatures = computed(() =>
    hubView.creaturesByRoleBucket(this.hub.campaign()?.data.creatures, 'antagonist'),
  );
  readonly otherCreatures = computed(() =>
    hubView.creaturesByRoleBucket(this.hub.campaign()?.data.creatures, 'other'),
  );
  readonly creatureGroups = computed(() => {
    const groups: { id: string; label: string; items: StoryCreatureSelection[] }[] = [
      { id: 'ally', label: 'Alliés', items: this.allyCreatures() },
      { id: 'adversary', label: 'Adversaires', items: this.adversaryCreatures() },
      { id: 'other', label: 'Autres (à classer)', items: this.otherCreatures() },
    ];
    return groups.filter((g) => g.items.length > 0);
  });
  readonly creatureRoleOptions = Object.entries(CREATURE_ROLE_LABELS) as [CreatureRole, string][];
  readonly showMobileSessionBar = computed(
    () =>
      !!this.activePlaySession() ||
      this.hubNav.tab() === 'handouts' ||
      this.hubNav.tab() === 'overview' ||
      this.hubNav.tab() === 'sessions' ||
      this.hubNav.tab() === 'calendar' ||
      this.hubNav.tab() === 'prep' ||
      this.hubNav.tab() === 'players',
  );
  readonly calendarHeroOptions = computed((): CalendarHeroOption[] =>
    hubView.calendarHeroOptions(this.hub.campaign()),
  );
  readonly publishedHandoutsCount = computed(
    () => (this.hub.campaign()?.data.handouts ?? []).filter((h) => h.published).length,
  );
  readonly showInitiativeBanner = computed(() =>
    shouldShowPlayerInitiativePrompt(this.hub.initiativeBoard(), this.auth.user()?.id),
  );
  readonly initiativeBannerCode = computed(() => this.hub.initiativeBoard()?.code ?? null);
  readonly sortedHandouts = computed(() =>
    hubView.sortedHandouts(this.hub.campaign()?.data.handouts, this.table.handoutKindFilter()),
  );

  readonly roleLabels = CREATURE_ROLE_LABELS;
  readonly toneLabels = ADVENTURE_TONE_LABELS;
  readonly pregenStatusLabels = PREGEN_STATUS_LABELS;
  readonly formatSessionDate = formatSessionDate;
  readonly sessionStatusLabel = sessionStatusLabel;
  readonly sessionModeLabel = sessionModeLabel;
  readonly formatCr = formatChallengeRating;
  readonly categoryLabel = getCreatureCategoryLabel;
  readonly encounterTotalXp = encounterTotalXp;
  readonly encounterPendingXp = encounterPendingXp;

  runHubNextActionCta(): void {
    const action = this.hubNextAction();
    const c = this.hub.campaign();
    if (!action?.cta || !c) return;
    switch (action.cta) {
      case 'players':
        this.hubNav.setTab('players');
        break;
      case 'sessions':
        this.hubNav.setTab('sessions');
        break;
      case 'play':
        this.table.openPlayFullscreen();
        break;
      case 'create_hero':
        void this.router.navigate(['/create'], {
          queryParams: { campaignId: c.id, returnUrl: `/campaigns/${c.id}` },
        });
        break;
    }
  }

  onSetupGuideAction(action: CampaignSetupAction): void {
    const cmd = dispatchCampaignSetupGuide(action);
    switch (cmd.type) {
      case 'tab':
        this.hubNav.setTab(cmd.tab);
        break;
      case 'editScenario':
        this.prep.editScenario();
        break;
      case 'generateEncounters':
        this.prep.generateEncountersFromStory();
        this.hubNav.setTab('encounters');
        break;
      case 'addSession':
        this.table.addSession();
        break;
      case 'startNextSession': {
        const next = this.nextPlannedSession();
        if (next) this.table.startPlaySession(next.id);
        else this.table.addSession();
        break;
      }
      case 'openPlay':
        this.table.openSessionDock();
        break;
      case 'openPlayFullscreen':
        this.table.openPlayFullscreen();
        break;
      case 'skipMaps':
        this.prep.skipMapsStep();
        break;
    }
  }

  onFirstSessionAction(action: FirstSessionAction): void {
    switch (action) {
      case 'invite':
        this.roster.copyCampaignJoinLink();
        break;
      case 'openPlayers':
        this.hubNav.setTab('players');
        break;
      case 'openPregens':
        this.hubNav.setTab('pregens');
        break;
      case 'openSessions':
        this.hubNav.setTab('sessions');
        break;
      case 'addSession':
        this.table.addSession();
        break;
      case 'openPrep':
        this.hubNav.setTab('prep');
        break;
      case 'openPlay': {
        const live = this.activePlaySession();
        const next = this.nextPlannedSession();
        if (live) this.table.openPlayFullscreen();
        else if (next) this.table.startPlaySession(next.id);
        else this.table.addSession();
        break;
      }
    }
  }

  onStatsNavigate(target: 'creatures' | 'encounters' | 'players' | 'handouts' | 'sessions' | 'prep'): void {
    this.hubNav.setTab(target === 'prep' ? 'prep' : target);
  }
}
