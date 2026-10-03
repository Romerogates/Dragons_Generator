import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  signal,
  untracked,
  viewChild,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CampaignCloudService, CampaignActivityItem, InitiativeBoard } from '@core/services/campaign-cloud.service';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { FriendsService } from '@core/services/friends.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { NotificationService } from '@core/services/notification.service';
import { DataService } from '@core/services/data.service';
import {
  UI_BANNER_IDS,
  UiBannerPreferencesService,
} from '@core/services/ui-banner-preferences.service';
import { forkJoin, catchError, map, of, Observable, throwError, firstValueFrom, Subscription } from 'rxjs';
import { getCampaignPdfService } from '@core/services/campaign-pdf.loader';
import type { CreaturePrintEntry, PlayerGmSummary } from '@core/services/campaign-pdf.types';
import { ProfileAvatarComponent } from '@shared/components/profile-avatar/profile-avatar';
import { Character } from '@core/models/Character/character';
import {
  CampaignAtlasPin,
  CampaignData,
  CampaignHandout,
  HandoutKind,
  CampaignMember,
  CampaignPregen,
  CampaignSession,
  CampaignScheduleEvent,
  CREATURE_ROLE_LABELS,
  NOTEBOOK_MAX_PAGES,
  PREGEN_STATUS_LABELS,
  createCampaignPregenEntry,
  createCampaignHandout,
  createEncounterFromCreatures,
  createNotebookPage,
  encounterPendingXp,
  encounterTotalXp,
  EncounterGroup,
  FriendUser,
  type CampaignDetail as CampaignDetailModel,
  type NotebookPage,
} from '@core/models/Campaign/campaign';
import { ADVENTURE_TONE_LABELS, CreatureRole, StoryCreatureSelection } from '@core/models/Story/story';
import { formatChallengeRating, getCreatureCategoryLabel } from '@core/utils/creature-display.util';
import { shouldShowPlayerInitiativePrompt } from '@core/utils/campaign-initiative.util';
import { resolveHubNextAction, type HubNextAction } from '@core/utils/hub-next-action.util';
import { mergeRemoteLiveTable, stripTableChatForPersist } from '@core/utils/campaign-persist.util';
import { isRemoteNewer } from '@core/utils/campaign-remote-newer.util';
import { seedNotebookFromLegacyNotes } from '@core/utils/notebook.util';
import {
  downloadBlobUrl,
  namedPdfObjectUrl,
  prefersNativePdfFallback,
} from '@core/utils/pdf-preview.util';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { CampaignPregenGeneratorService } from '@core/services/campaign-pregen-generator.service';
import { maxCampaignPregens } from '@core/constants/character-limits';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';
import { isAiGenerationAborted } from '@core/models/ai-generation.model';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { CampaignDungeonMaps } from '../campaign-dungeon-maps/campaign-dungeon-maps';
import { CampaignDetailOverview } from './campaign-detail-overview/campaign-detail-overview';
import { CampaignDetailRoster } from './campaign-detail-roster/campaign-detail-roster';
import { CampaignDetailSessions } from './campaign-detail-sessions/campaign-detail-sessions';
import { CampaignDetailHandouts } from './campaign-detail-handouts/campaign-detail-handouts';
import { CampaignDetailPrepScenario } from './campaign-detail-prep-scenario/campaign-detail-prep-scenario';
import { CampaignDetailPrepCreatures } from './campaign-detail-prep-creatures/campaign-detail-prep-creatures';
import type { CreatureCardFieldEvent } from './campaign-detail-prep-creatures/campaign-detail-prep-creatures';
import { CampaignDetailPrepEncounters } from './campaign-detail-prep-encounters/campaign-detail-prep-encounters';
import { CampaignDetailPrepPregens } from './campaign-detail-prep-pregens/campaign-detail-prep-pregens';
import type { PregenPatchEvent } from './campaign-detail-prep-pregens/campaign-detail-prep-pregens';
import { CampaignNotebook } from '../campaign-notebook/campaign-notebook';
import { CampaignCalendar } from '../campaign-calendar/campaign-calendar';
import { nextScheduleOccurrenceAt } from '@core/utils/schedule-ics.util';
import { formatRsvpSummary } from '@core/utils/schedule-rsvp.util';
import {
  buildEncountersFromPack,
  buildHandoutsFromPack,
} from '@core/utils/campaign-content-presets.util';
import { exportEveningPdf, exportUnifiedEveningPack } from '@core/utils/evening-pdf.util';
import { prefillRunSheetFromCampaign } from '@core/utils/run-sheet-prefill.util';
import type { MemberCharacterAction } from './campaign-detail-roster/campaign-detail-roster';
import type { SessionDateChangeEvent, SessionPatchEvent } from './campaign-detail-sessions/campaign-detail-sessions';
import type { HandoutPatchEvent, HandoutPublishEvent } from './campaign-detail-handouts/campaign-detail-handouts';
import type { CalendarHeroOption } from '@core/utils/schedule-ics.util';
import { handoutIdFromActivity } from './campaign-activity.util';
import { CampaignSessionCacheService } from '@core/services/campaign-session-cache.service';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { CampaignInitiativeInline } from '../campaign-initiative-inline/campaign-initiative-inline';
import { CampaignSetupGuide } from './campaign-setup-guide/campaign-setup-guide';
import type {
  CampaignSetupAction,
  CampaignSetupGuideInput,
} from './campaign-setup-guide/campaign-setup-guide.util';
import type {
  FirstSessionAction,
  FirstSessionChecklistInput,
} from './campaign-first-session-checklist.util';
import {
  formatSessionDate,
  sessionModeLabel,
  sessionStatusLabel,
} from './campaign-session.util';
import { LightMarkdownPipe } from '@shared/pipes/light-markdown.pipe';

/** Onglets de la nav haute. */
type PrimaryTab = 'overview' | 'sessions' | 'calendar' | 'handouts' | 'prep' | 'players';
/** Sous-onglets de Préparation. */
type PrepSub = 'scenario' | 'creatures' | 'maps' | 'pregens' | 'encounters' | 'notebook';
/** Cibles acceptées par setTab (compat deep-links / guide / stats). */
type Tab = PrimaryTab | PrepSub | 'activity' | 'creatures' | 'encounters' | 'maps' | 'pregens' | 'notebook';
type TabDef = { id: PrimaryTab; label: string; icon: string };
type PrepSubDef = { id: PrepSub; label: string; icon: string };

const PREP_SUBS: PrepSub[] = ['scenario', 'creatures', 'maps', 'pregens', 'encounters', 'notebook'];

function isPrepSub(t: string): t is PrepSub {
  return (PREP_SUBS as string[]).includes(t);
}

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ProfileAvatarComponent,
    CampaignDungeonMaps,
    CampaignDetailOverview,
    CampaignDetailRoster,
    CampaignDetailSessions,
    CampaignCalendar,
    CampaignDetailHandouts,
    CampaignDetailPrepScenario,
    CampaignDetailPrepCreatures,
    CampaignDetailPrepEncounters,
    CampaignDetailPrepPregens,
    CampaignNotebook,
    CampaignSetupGuide,
    CampaignInitiativeInline,
    LightMarkdownPipe,
    ConfirmDialog,
  ],
  templateUrl: './campaign-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private campaigns = inject(CampaignCloudService);
  private live = inject(CampaignLiveService);
  private friends = inject(FriendsService);
  private characters = inject(CharacterCloudService);
  private auth = inject(AuthService);
  readonly currentUserId = computed(() => this.auth.user()?.id ?? null);
  readonly isSpectator = computed(() => this.campaign()?.role === 'spectator');
  private notifications = inject(NotificationService);
  private banners = inject(UiBannerPreferencesService);
  private data = inject(DataService);
  private injector = inject(Injector);
  private sanitizer = inject(DomSanitizer);
  private storyBuilder = inject(StoryBuilderService);
  private pregenGenerator = inject(CampaignPregenGeneratorService);
  private sessionCache = inject(CampaignSessionCacheService);
  private sessionDock = inject(CampaignSessionDockService);
  private handoff = inject(CharacterHandoffService);
  readonly aiProgress = inject(AiGenerationProgressService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly offlineSnapshot = signal<import('@core/services/campaign-session-cache.service').SessionCachePayload | null>(null);
  /** Bannière sync multi-onglets MJ. */
  readonly syncNotice = signal<string | null>(null);
  /** CTA « Monter de niveau » après XP reçue. */
  readonly xpLevelUpAvailable = signal(false);
  /** Version distante plus récente (MJ) — à appliquer manuellement. */
  readonly staleRemote = signal<CampaignDetailModel | null>(null);
  readonly tab = signal<PrimaryTab>('overview');
  readonly prepSub = signal<PrepSub>('scenario');
  readonly campaign = signal<CampaignDetailModel | null>(null);
  readonly printing = signal(false);
  readonly friendsList = signal<FriendUser[]>([]);
  readonly myCharacters = signal<{ id: string; name: string }[]>([]);
  readonly dmCharacters = signal<{ id: string; name: string }[]>([]);
  readonly importingPregen = signal(false);
  readonly generatingAutoPregen = signal(false);
  readonly pregenPdfLoadingId = signal<string | null>(null);
  readonly memberCharacterLoadingId = signal<string | null>(null);
  readonly characterRequestLoadingId = signal<string | null>(null);
  readonly rosterFeedback = signal<string | null>(null);

  /** Picker Atlas (+ Lieu) : civilisations Codex + Autre. */
  readonly atlasPinPickerOpen = signal(false);
  readonly atlasCivOptions = signal<{ id: string; name: string }[]>([]);
  readonly atlasCivsLoading = signal(false);
  readonly atlasPinFilter = signal('');
  readonly atlasCustomName = signal('');
  readonly atlasShowCustom = signal(false);

  readonly atlasRegionOption = computed(() => {
    const c = this.campaign();
    if (!c) return null;
    const id = c.data.regionId?.trim();
    const name = c.data.regionName?.trim();
    if (!id || !name) return null;
    const pinned = (c.data.atlasPins ?? []).some((p) => p.civId === id);
    if (pinned) return null;
    return { id, name };
  });

  readonly atlasFilteredCivs = computed(() => {
    const q = this.atlasPinFilter().trim().toLowerCase();
    const regionId = this.campaign()?.data.regionId ?? null;
    const pinned = new Set(
      (this.campaign()?.data.atlasPins ?? [])
        .map((p) => p.civId)
        .filter((id): id is string => !!id),
    );
    return this.atlasCivOptions()
      .filter((civ) => civ.id !== regionId && !pinned.has(civ.id))
      .filter((civ) => !q || civ.name.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });
  /** Erreurs / succès locaux Pré-tirés (ne démonte pas le hub). */
  readonly pregenFeedback = signal<string | null>(null);
  readonly pregenUndoAvailable = signal(false);
  private pregenUndo: (() => void) | null = null;
  private pregenUndoTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bannière one-shot après /join ou proposition depuis la forge. */
  readonly welcomeBanner = signal<string | null>(null);
  readonly showWelcomeBanner = computed(
    () =>
      !!this.welcomeBanner() &&
      this.banners.hydrated() &&
      this.banners.isVisible(UI_BANNER_IDS.welcomeCampaign),
  );
  readonly showGuideLinks = computed(() =>
    this.banners.isVisible(UI_BANNER_IDS.contextualGuideLinks),
  );
  readonly joinLink = signal<{ token: string | null; enabled: boolean } | null>(null);
  readonly joinLinkBusy = signal(false);
  /** Amis déjà invités (en attente d’acceptation) — masqués de la liste invitable. */
  readonly pendingInviteUserIds = signal<Set<string>>(new Set());
  readonly pendingInvites = signal<
    { id: string; userId: string; displayName: string; createdAt: string }[]
  >([]);
  readonly activity = signal<CampaignActivityItem[]>([]);
  readonly activityLoading = signal(false);
  /** Session en mode édition (MJ) — sinon carte lecture. */
  readonly editingSessionId = signal<string | null>(null);

  /** Handout en mode édition (MJ). */
  readonly editingHandoutId = signal<string | null>(null);
  readonly previewHandoutId = signal<string | null>(null);
  readonly focusHandoutId = signal<string | null>(null);
  /** Deep-link `?event=` → ouvrir le panneau date calendrier. */
  readonly focusScheduleEventId = signal<string | null>(null);
  readonly focusDungeonMapId = signal<string | null>(null);
  readonly mapsAutoAction = signal<'generate' | 'import' | null>(null);
  readonly handoutKindFilter = signal<HandoutKind | 'all'>('all');
  readonly initiativeBoard = signal<InitiativeBoard | null>(null);
  readonly rosterSheetOpen = signal(false);
  readonly pinnedOverlayDismissed = signal(false);
  readonly activeNotebookPageId = signal<string | null>(null);
  readonly confirmDialog = signal<{
    title: string;
    body: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  private initiativePollTimer: ReturnType<typeof setInterval> | null = null;
  private softPollTimer: ReturnType<typeof setInterval> | null = null;
  private softPollIntervalMs = 12_000;
  private liveSub: Subscription | null = null;
  /** Menu « Plus » de la barre mobile (Docs / Joueurs). */
  readonly mobileMoreOpen = signal(false);

  toggleMobileMore(): void {
    this.mobileMoreOpen.update((v) => !v);
  }
  /** returnUrl soft-gate login → URL campagne courante. */
  readonly loginReturnUrl = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) return `/campaigns/${id}`;
    const url = this.router.url;
    return url && url !== '/' ? url : '/campaigns';
  });

  readonly creatureXpMap = signal<Record<string, number>>({});
  readonly isLoadingPreview = signal(false);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  readonly pdfPreviewRawUrl = signal<string | null>(null);
  readonly pdfPreviewKind = signal<'pack' | 'bestiary'>('pack');
  private rawBlobUrl: string | null = null;
  private previewCacheKey: string | null = null;
  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private handoutSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private softPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistSeq = 0;
  private persistTail: Promise<void> = Promise.resolve();

  private readonly dungeonMapsComp = viewChild(CampaignDungeonMaps);

  constructor() {
    effect(() => {
      const c = this.campaign();
      untracked(() => this.sessionDock.bindCampaign(c));
    });
    effect(() => {
      this.live.connected();
      const c = this.campaign();
      untracked(() => {
        if (c) this.tuneSoftPollInterval(c);
        else if (this.live.connected()) this.clearSoftPollTimer();
      });
    });
    effect(() => {
      const live = this.sessionDock.liveCampaign();
      const cur = this.campaign();
      if (!live || !cur || live.id !== cur.id || live === cur) return;
      untracked(() => this.campaign.set(live));
    });
    effect(() => {
      const id = this.campaign()?.id;
      if (!id) return;
      untracked(() => {
        try {
          this.mapsStepSkipped.set(
            sessionStorage.getItem(`dg-campaign-skip-maps:${id}`) === '1',
          );
        } catch {
          this.mapsStepSkipped.set(false);
        }
      });
    });
    /** Répare un activeSessionId orphelin (session supprimée). */
    effect(() => {
      const c = this.campaign();
      if (!c?.isOwner) return;
      const activeId = c.data.activeSessionId;
      if (!activeId) return;
      if ((c.data.sessions ?? []).some((s) => s.id === activeId)) return;
      untracked(() => {
        this.saveData({ activeSessionId: null });
        this.sessionDock.bindCampaign({
          ...c,
          data: { ...c.data, activeSessionId: null },
        });
      });
    });
  }

  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly players = computed(() =>
    (this.campaign()?.members ?? []).filter((m) => m.role === 'player'),
  );

  readonly spectators = computed(() =>
    (this.campaign()?.members ?? []).filter((m) => m.role === 'spectator'),
  );

  readonly approvedPlayersWithCharacter = computed(() =>
    this.players().filter((p) => p.proposalStatus === 'approved' && p.approvedCharacterId),
  );

  /** Membres avec une fiche PDF (proposée ou approuvée) — hub Documents. */
  readonly pdfSheetMembers = computed(() =>
    this.players().filter(
      (p) =>
        (p.proposalStatus === 'pending' && !!p.proposedCharacterId) ||
        (p.proposalStatus === 'approved' && !!p.approvedCharacterId),
    ),
  );

  /**
   * Pré-tirés encore « libres » pour le hub Documents :
   * on masque ceux déjà assignés / revendiqués, ou dont la fiche est déjà
   * rattachée à un joueur (évite le doublon Mira pré-tiré + Mira joueur).
   */
  readonly pdfUnassignedPregens = computed(() => {
    const pregens = this.campaign()?.data.pregenCharacters ?? [];
    const usedCharacterIds = new Set(
      this.pdfSheetMembers().flatMap((m) =>
        [m.approvedCharacterId, m.proposedCharacterId].filter((id): id is string => !!id),
      ),
    );
    return pregens.filter((p) => {
      if (p.status === 'assigned' || p.status === 'claimed') return false;
      if (p.assignedUserId) return false;
      if (usedCharacterIds.has(p.characterId)) return false;
      return true;
    });
  });

  readonly pendingProposals = computed(() =>
    this.players().filter((p) => p.proposalStatus === 'pending' && p.proposedCharacterId),
  );

  readonly playersNeedingCharacter = computed(() =>
    this.players().filter(
      (p) => !p.approvedCharacterId && p.proposalStatus !== 'pending',
    ),
  );

  readonly invitableFriends = computed(() => {
    const memberUserIds = new Set(this.players().map((m) => m.userId));
    const pending = this.pendingInviteUserIds();
    return this.friendsList().filter((f) => !memberUserIds.has(f.id) && !pending.has(f.id));
  });

  /** Autres joueurs (pas soi) — pour voir leurs fiches approuvées. */
  readonly otherPlayers = computed(() => {
    const me = this.auth.user()?.id;
    return this.players().filter((p) => p.userId !== me);
  });

  readonly totalXpAwarded = computed(() =>
    (this.campaign()?.members ?? [])
      .filter((m) => m.role === 'player')
      .reduce((s, m) => s + m.xpEarnedInCampaign, 0),
  );

  readonly myPlayerMember = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return undefined;
    return this.players().find((p) => p.userId === userId);
  });

  readonly myXpEarned = computed(() => this.myPlayerMember()?.xpEarnedInCampaign ?? 0);

  readonly pastSessions = computed(() => {
    const sessions = this.campaign()?.data.sessions ?? [];
    return [...sessions]
      .filter((s) => s.status === 'played' || s.status === 'cancelled')
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  });

  readonly showOverviewRoster = computed(() => {
    const c = this.campaign();
    if (!c?.isOwner) return false;
    return (
      this.approvedPlayersWithCharacter().length > 0 ||
      this.pendingProposals().length > 0 ||
      this.playersNeedingCharacter().length > 0
    );
  });

  /** Badge onglet Joueurs : propositions à accepter / refuser (MJ). */
  readonly playersTabBadgeCount = computed(() => {
    if (!this.campaign()?.isOwner) return 0;
    return this.pendingProposals().length;
  });

  readonly activeSession = computed(() => {
    const c = this.campaign();
    const id = c?.data.activeSessionId;
    if (!c?.isOwner || !id) return null;
    return (c.data.sessions ?? []).find((s) => s.id === id) ?? null;
  });

  readonly nextPlannedSession = computed(() => {
    const now = Date.now();
    return (this.campaign()?.data.sessions ?? [])
      .filter((s) => s.status === 'planned')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .find((s) => new Date(s.scheduledAt).getTime() >= now)
      ?? (this.campaign()?.data.sessions ?? []).find((s) => s.status === 'planned')
      ?? null;
  });

  /** Bandeau coercitif joueur (hub) — une prochaine action claire. */
  readonly hubNextAction = computed((): HubNextAction | null => {
    const c = this.campaign();
    if (!c || c.isOwner) return null;
    const mine = this.myPlayerMember();
    let heroStatus: 'none' | 'pending' | 'rejected' | 'approved' = 'none';
    if (mine?.proposalStatus === 'approved' && mine.approvedCharacterId) heroStatus = 'approved';
    else if (mine?.proposalStatus === 'pending') heroStatus = 'pending';
    else if (mine?.proposalStatus === 'rejected') heroStatus = 'rejected';
    return resolveHubNextAction({
      isOwner: false,
      isSpectator: c.role === 'spectator',
      heroStatus,
      hasActiveSession: !!c.data.activeSessionId,
      hasPlannedSession: !!this.nextPlannedSession(),
    });
  });

  /** Prochaine date libre « game » (calendrier), hors sessions de play. */
  readonly nextScheduleGame = computed(() => {
    const now = Date.now();
    const events = this.campaign()?.data.scheduleEvents ?? [];
    let best: {
      id: string;
      title: string;
      startsAt: string;
      rsvpSummary: string;
    } | null = null;
    for (const e of events) {
      if (e.kind && e.kind !== 'game') continue;
      const at = nextScheduleOccurrenceAt(e);
      if (!at) continue;
      const t = new Date(at).getTime();
      if (t < now) continue;
      if (!best || t < new Date(best.startsAt).getTime()) {
        best = {
          id: e.id,
          title: e.title || 'Soirée de table',
          startsAt: at,
          rsvpSummary: formatRsvpSummary(e.rsvps),
        };
      }
    }
    return best;
  });

  /**
   * Slot hub : session planifiée ou date calendrier, le plus tôt des deux.
   * Source schedule → CTA calendrier ; session → entrer en session.
   */
  readonly nextHubTable = computed((): {
    source: 'session' | 'schedule';
    title: string;
    at: string;
    sessionId?: string;
    rsvpSummary?: string;
  } | null => {
    const session = this.nextPlannedSession();
    const schedule = this.nextScheduleGame();
    const sessionAt = session ? new Date(session.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
    const scheduleAt = schedule ? new Date(schedule.startsAt).getTime() : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(sessionAt) && !Number.isFinite(scheduleAt)) return null;
    if (session && sessionAt <= scheduleAt) {
      return {
        source: 'session',
        title: session.title,
        at: session.scheduledAt,
        sessionId: session.id,
      };
    }
    if (schedule) {
      return {
        source: 'schedule',
        title: schedule.title,
        at: schedule.startsAt,
        rsvpSummary: schedule.rsvpSummary,
      };
    }
    return null;
  });

  /** Skip optionnel de l’étape carte (local, par campagne). */
  readonly mapsStepSkipped = signal(false);

  readonly setupGuideState = computed((): CampaignSetupGuideInput => {
    const c = this.campaign();
    const data = c?.data;
    const readyPregenCount = (data?.pregenCharacters ?? []).filter((p) => p.status === 'ready').length;
    return {
      hasAdventure: !!(data?.adventure?.trim()),
      creatureCount: data?.creatures?.length ?? 0,
      mapCount: data?.dungeonMaps?.length ?? 0,
      encounterCount: data?.encounters?.length ?? 0,
      approvedPlayerCount: this.approvedPlayersWithCharacter().length,
      playerCount: this.players().length,
      readyPregenCount,
      hasPlannedSession: !!(data?.sessions ?? []).some((s) => s.status === 'planned'),
      hasActiveSession: !!this.activePlaySession(),
      nextSessionTitle: this.nextHubTable()?.title ?? null,
      mapsSkipped: this.mapsStepSkipped(),
    };
  });

  readonly firstSessionChecklist = computed((): FirstSessionChecklistInput => {
    const data = this.campaign()?.data;
    const link = this.joinLink();
    const readyPregenCount = (data?.pregenCharacters ?? []).filter((p) => p.status === 'ready').length;
    return {
      hasInviteActivity:
        this.pendingInvites().length > 0 ||
        this.players().length > 1 ||
        !!(link?.enabled && link.token),
      approvedPlayerCount: this.approvedPlayersWithCharacter().length,
      readyPregenCount,
      hasPlannedSession: !!(data?.sessions ?? []).some((s) => s.status === 'planned'),
      hasActiveSession: !!this.activePlaySession(),
      playedSessionCount: this.playedSessionCount(),
    };
  });

  readonly visibleTabs = computed((): TabDef[] => {
    const tabs: TabDef[] = [
      { id: 'overview', label: 'Résumé', icon: 'fluent-emoji:clipboard' },
      { id: 'sessions', label: 'Sessions', icon: 'fluent-emoji:calendar' },
      { id: 'calendar', label: 'Calendrier', icon: 'fluent-emoji:spiral-calendar' },
      { id: 'handouts', label: 'Documents', icon: 'fluent-emoji:page-facing-up' },
    ];
    const c = this.campaign();
    const showPrep =
      c?.isOwner === true || (c?.data.pregenCharacters?.length ?? 0) > 0;
    if (showPrep) {
      tabs.push({ id: 'prep', label: 'Préparation', icon: 'fluent-emoji:hammer-and-wrench' });
    }
    tabs.push({ id: 'players', label: 'Joueurs', icon: 'fluent-emoji:busts-in-silhouette' });
    return tabs;
  });

  readonly prepSubTabs = computed((): PrepSubDef[] => {
    const owner = this.campaign()?.isOwner === true;
    if (!owner) {
      return [{ id: 'pregens', label: 'Pré-tirés', icon: 'fluent-emoji:performing-arts' }];
    }
    return [
      { id: 'scenario', label: 'Scénario', icon: 'fluent-emoji:scroll' },
      { id: 'creatures', label: 'Créatures', icon: 'fluent-emoji:dragon' },
      { id: 'maps', label: 'Donjons', icon: 'fluent-emoji:world-map' },
      { id: 'pregens', label: 'Pré-tirés', icon: 'fluent-emoji:performing-arts' },
      { id: 'encounters', label: 'Rencontres', icon: 'fluent-emoji:crossed-swords' },
      { id: 'notebook', label: 'Carnet', icon: 'fluent-emoji:memo' },
    ];
  });

  readonly plannedSessionCount = computed(
    () => (this.campaign()?.data.sessions ?? []).filter((s) => s.status === 'planned').length,
  );

  readonly playedSessionCount = computed(
    () => (this.campaign()?.data.sessions ?? []).filter((s) => s.status === 'played').length,
  );

  readonly documentCount = computed(() => {
    const c = this.campaign();
    if (!c) return 0;
    if (c.isOwner) return (c.data.handouts ?? []).length;
    return (c.data.handouts ?? []).filter((h) => h.published).length;
  });

  readonly pinnedHandout = computed(() => {
    const c = this.campaign();
    const pinId = c?.data.pinnedHandoutId;
    if (!pinId) return null;
    return (c?.data.handouts ?? []).find((h) => h.id === pinId && h.published) ?? null;
  });

  readonly showPinnedOverlay = computed(
    () => !this.campaign()?.isOwner && !!this.pinnedHandout() && !this.pinnedOverlayDismissed(),
  );

  readonly lastPublishedHandoutTitle = computed(() => {
    const list = (this.campaign()?.data.handouts ?? []).filter((h) => h.published);
    if (!list.length) return null;
    return [...list].sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime(),
    )[0].title;
  });

  readonly activePlaySession = computed(() => {
    const c = this.campaign();
    const id = c?.data.activeSessionId;
    if (!id) return null;
    return (c?.data.sessions ?? []).find((s) => s.id === id) ?? null;
  });

  readonly allyCreatures = computed(() =>
    (this.campaign()?.data.creatures ?? []).filter((cr) => cr.role === 'ally'),
  );

  readonly adversaryCreatures = computed(() =>
    (this.campaign()?.data.creatures ?? []).filter((cr) => cr.role === 'antagonist'),
  );

  readonly otherCreatures = computed(() =>
    (this.campaign()?.data.creatures ?? []).filter(
      (cr) => cr.role !== 'ally' && cr.role !== 'antagonist',
    ),
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

  readonly notebookPages = computed((): NotebookPage[] => {
    return this.campaign()?.data.notebookPages ?? [];
  });

  readonly activeNotebookPage = computed((): NotebookPage => {
    const pages = this.notebookPages();
    const id = this.activeNotebookPageId();
    return (
      pages.find((p) => p.id === id) ??
      pages[0] ??
      this.draftNotebookPage()
    );
  });

  private readonly draftNotebookPage = signal(createNotebookPage('Notes du MJ'));

  readonly showMobileSessionBar = computed(
    () =>
      !!this.activePlaySession() ||
      this.tab() === 'handouts' ||
      this.tab() === 'overview' ||
      this.tab() === 'sessions' ||
      this.tab() === 'calendar' ||
      this.tab() === 'prep' ||
      this.tab() === 'players',
  );

  /** Héros proposés pour le lien calendrier (membres + pré-tirés). */
  readonly calendarHeroOptions = computed((): CalendarHeroOption[] => {
    const c = this.campaign();
    if (!c) return [];
    const options: CalendarHeroOption[] = [];
    const seen = new Set<string>();
    for (const m of c.members ?? []) {
      const id = m.approvedCharacterId || m.proposedCharacterId;
      const name = m.approvedCharacterName || m.proposedCharacterName || m.displayName;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      options.push({
        id,
        label: `${name}${m.role === 'dm' ? ' (MJ)' : ''}`,
      });
    }
    for (const p of c.data.pregenCharacters ?? []) {
      if (seen.has(p.characterId)) continue;
      seen.add(p.characterId);
      options.push({
        id: p.characterId,
        label: `${p.characterName || p.label || 'Pré-tiré'} (pré-tiré)`,
      });
    }
    return options;
  });

  readonly publishedHandoutsCount = computed(
    () => (this.campaign()?.data.handouts ?? []).filter((h) => h.published).length,
  );

  readonly showInitiativeBanner = computed(() =>
    shouldShowPlayerInitiativePrompt(this.initiativeBoard(), this.auth.user()?.id),
  );

  readonly awardingXpId = signal<string | null>(null);

  readonly initiativeBannerCode = computed(() => this.initiativeBoard()?.code ?? null);

  readonly sortedHandouts = computed(() => {
    const list = this.campaign()?.data.handouts ?? [];
    const filter = this.handoutKindFilter();
    return [...list]
      .filter((h) => filter === 'all' || h.kind === filter)
      .sort((a, b) => {
        const ta = new Date(a.publishedAt ?? a.createdAt).getTime();
        const tb = new Date(b.publishedAt ?? b.createdAt).getTime();
        return tb - ta;
      });
  });

  readonly previewHandout = computed(() => {
    const id = this.previewHandoutId();
    if (!id) return null;
    return (this.campaign()?.data.handouts ?? []).find((h) => h.id === id) ?? null;
  });

  protected roleLabels = CREATURE_ROLE_LABELS;
  protected toneLabels = ADVENTURE_TONE_LABELS;
  protected pregenStatusLabels = PREGEN_STATUS_LABELS;
  protected formatSessionDate = formatSessionDate;
  protected sessionStatusLabel = sessionStatusLabel;
  protected sessionModeLabel = sessionModeLabel;
  protected formatCr = formatChallengeRating;
  protected categoryLabel = getCreatureCategoryLabel;
  protected encounterTotalXp = encounterTotalXp;
  protected encounterPendingXp = encounterPendingXp;

  startPlaySession(sessionId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.askConfirm(
      'Entrer en session ?',
      'La table s’ouvre pour tous les joueurs connectés. Combat, notes et carte deviennent actifs.',
      () => {
        this.flushSoftPersistTimer();
        this.flushSessionSave();
        this.dungeonMapsComp()?.flushPendingSave();
        const data = { ...this.campaign()!.data, activeSessionId: sessionId };
        this.campaign.update((prev) => (prev ? { ...prev, data } : prev));
        this.persist(c.title, data, () => {
          this.sessionDock.bindCampaign(this.campaign());
          this.sessionDock.open();
          void this.router.navigate(['/campaigns', c.id, 'play']);
        });
      },
      'Entrer en session',
      false,
    );
  }

  openSessionDock(): void {
    this.sessionDock.bindCampaign(this.campaign());
    this.sessionDock.open();
  }

  /** Table plein écran (session déjà active). */
  openPlayFullscreen(): void {
    const c = this.campaign();
    if (!c?.data.activeSessionId) return;
    this.sessionDock.close();
    void this.router.navigate(['/campaigns', c.id, 'play']);
  }

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/campaigns']);
      return;
    }

    this.data.getCreaturesSummary().pipe(catchError(() => of([]))).subscribe((list) => {
      const map: Record<string, number> = {};
      for (const c of list) map[c.id] = c.xp;
      this.creatureXpMap.set(map);
    });

    this.reload(id);
    this.friends.listFriends().subscribe((f) => this.friendsList.set(f));
    this.characters.list().subscribe((chars) => {
      this.myCharacters.set(chars.map((c) => ({ id: c.id, name: c.name })));
      if (this.campaign()?.isOwner) {
        this.dmCharacters.set(chars.map((c) => ({ id: c.id, name: c.name })));
      }
    });

    if (!this.live.connected()) {
      this.softPollTimer = setInterval(() => this.softReload(), 12_000);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onWindowFocus);
    }

    const tab = this.route.snapshot.queryParamMap.get('tab');
    const sub = this.route.snapshot.queryParamMap.get('sub');
    const handoutId =
      this.route.snapshot.queryParamMap.get('handout') ??
      this.route.snapshot.queryParamMap.get('handoutId');
    const mapId = this.route.snapshot.queryParamMap.get('map');
    const sessionId = this.route.snapshot.queryParamMap.get('session');
    const scheduleEventId = this.route.snapshot.queryParamMap.get('event');
    const mapsAction = this.route.snapshot.queryParamMap.get('mapsAction');
    if (tab || sub || mapId || sessionId || scheduleEventId || mapsAction) {
      this.applyTabFromRoute(
        tab ?? (sessionId ? 'sessions' : scheduleEventId ? 'calendar' : 'maps'),
        handoutId,
        mapId,
        sessionId,
        scheduleEventId,
        mapsAction,
        sub,
      );
    }
    this.route.queryParamMap.subscribe((params) => {
      const qTab = params.get('tab');
      const qSub = params.get('sub');
      const qMap = params.get('map');
      const qHandout = params.get('handout') ?? params.get('handoutId');
      const qSession = params.get('session');
      const qEvent = params.get('event');
      const qMapsAction = params.get('mapsAction');
      if (qMap || qSession || qEvent || qMapsAction || (qTab && isPrepSub(qTab))) {
        this.applyTabFromRoute(
          qTab ?? (qSession ? 'sessions' : qEvent ? 'calendar' : 'maps'),
          qHandout,
          qMap,
          qSession,
          qEvent,
          qMapsAction,
          qSub,
        );
      } else if (qTab === 'prep' && qSub && isPrepSub(qSub)) {
        this.applyTabFromRoute('prep', qHandout, null, null, null, null, qSub);
      }
    });
    if (this.route.snapshot.queryParamMap.get('joined') === '1') {
      this.welcomeBanner.set(
        'Bienvenue dans la campagne — proposez un héros dans l’onglet Joueurs, ou forgez-en un.',
      );
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { joined: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    if (this.route.snapshot.queryParamMap.get('levelUp') === '1') {
      this.openLevelUpFromXp();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { levelUp: null, characterId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    if (this.route.snapshot.queryParamMap.get('proposed') === '1') {
      this.welcomeBanner.set(
        'Héros proposé au MJ — il apparaîtra ici dès validation.',
      );
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { proposed: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    const addPregenId = this.route.snapshot.queryParamMap.get('addPregen')?.trim();
    if (addPregenId) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { addPregen: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      // Attendre le premier reload campagne avant d’attacher.
      const waitOwner = setInterval(() => {
        const c = this.campaign();
        if (!c) return;
        clearInterval(waitOwner);
        if (c.isOwner) {
          void this.attachCharacterAsPregen(addPregenId);
        }
      }, 50);
      setTimeout(() => clearInterval(waitOwner), 8_000);
    }
  }

  dismissWelcomeBanner(): void {
    this.welcomeBanner.set(null);
    this.banners.dismiss(UI_BANNER_IDS.welcomeCampaign);
  }

  runHubNextActionCta(): void {
    const action = this.hubNextAction();
    const c = this.campaign();
    if (!action?.cta || !c) return;
    switch (action.cta) {
      case 'players':
        this.setTab('players');
        break;
      case 'sessions':
        this.setTab('sessions');
        break;
      case 'play':
        this.openPlayFullscreen();
        break;
      case 'create_hero':
        void this.router.navigate(['/create'], {
          queryParams: { campaignId: c.id, returnUrl: `/campaigns/${c.id}` },
        });
        break;
    }
  }

  /** Deep-link `?tab=` / `?sub=` / `?map=` / `?session=` / `?event=` / `?mapsAction=` → nav haute + sous-onglet Préparation si besoin. */
  private applyTabFromRoute(
    tab: string,
    handoutId: string | null,
    mapId: string | null = null,
    sessionId: string | null = null,
    scheduleEventId: string | null = null,
    mapsAction: string | null = null,
    sub: string | null = null,
  ): void {
    if (mapId) {
      this.setTab('maps');
      this.focusDungeonMapId.set(mapId);
      return;
    }
    if (sessionId) {
      this.setTab('sessions');
      this.editingSessionId.set(sessionId);
      setTimeout(() => {
        document.getElementById('session-edit-panel')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 120);
      return;
    }
    if (scheduleEventId) {
      this.setTab('calendar');
      this.focusScheduleEventId.set(scheduleEventId);
      return;
    }
    if (mapsAction === 'generate' || mapsAction === 'import') {
      this.setTab('maps');
      this.mapsAutoAction.set(mapsAction);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { mapsAction: null, tab: 'prep', sub: 'maps' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      // One-shot : évite de rouvrir le générateur / picker au prochain passage.
      setTimeout(() => this.mapsAutoAction.set(null), 1500);
      return;
    }
    if (tab === 'handouts' || tab === 'players' || tab === 'overview' || tab === 'sessions' || tab === 'calendar') {
      this.setTab(tab as PrimaryTab);
      if (tab === 'handouts' && handoutId) this.focusHandoutId.set(handoutId);
      return;
    }
    if (tab === 'prep') {
      if (sub && isPrepSub(sub)) {
        this.setTab(sub);
      } else {
        this.setTab('prep');
      }
      return;
    }
    if (tab === 'activity') {
      this.setTab('overview');
      return;
    }
    // Legacy `?tab=maps|encounters|…` → rewrite `?tab=prep&sub=…`
    if (isPrepSub(tab)) {
      this.setTab(tab);
      return;
    }
  }

  ngOnDestroy(): void {
    this.flushSoftPersistTimer();
    this.flushSessionSave();
    this.flushHandoutSave();
    this.dungeonMapsComp()?.flushPendingSave();
    this.stopInitiativeBannerPoll();
    this.clearSoftPollTimer();
    this.liveSub?.unsubscribe();
    void this.live.unwatch();
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
    }
    this.revokePreviewUrl();
  }

  private readonly onWindowFocus = (): void => {
    if (this.auth.isLoggedIn()) this.softReload({ syncOwnerIfNewer: true });
  };

  /** Recharge sans spinner (invitations acceptées, propositions, combat live joueur…). */
  private softReload(opts?: { syncOwnerIfNewer?: boolean }): void {
    const campaignId = this.campaign()?.id;
    if (!campaignId || this.loading() || this.saving()) return;
    this.campaigns.get(campaignId).subscribe({
      next: (c) => {
        const current = this.campaign();
        if (!current || current.id !== c.id) {
          this.campaign.set(c);
        } else if (!current.isOwner) {
          // Joueurs : sync complète (combat / tours / PV / fog) + annonce XP.
          this.announcePlayerXpGain(current, c);
          this.campaign.set(c);
          if (this.tab() === 'overview') this.loadActivity();
        } else if (
          opts?.syncOwnerIfNewer &&
          this.isRemoteNewer(c.updatedAt, current.updatedAt)
        ) {
          this.staleRemote.set(c);
          this.syncNotice.set(
            'Un autre onglet a une version plus récente de cette campagne.',
          );
        } else {
          if (this.isRemoteNewer(c.updatedAt, current.updatedAt)) {
            this.staleRemote.set(c);
            this.syncNotice.set(
              'Un autre onglet a une version plus récente de cette campagne.',
            );
          }
          this.campaign.set({
            ...current,
            title: c.title,
            members: c.members,
            // Garder updatedAt local tant que data MJ n’est pas resync.
            isOwner: c.isOwner,
            role: c.role,
          });
        }
        const memberIds = new Set(c.members.filter((m) => m.role === 'player').map((m) => m.userId));
        this.pendingInviteUserIds.update((prev) => {
          const next = new Set([...prev].filter((id) => !memberIds.has(id)));
          return next.size === prev.size ? prev : next;
        });
        this.tuneSoftPollInterval(c);
        if (current?.isOwner) {
          this.loadPendingInvites();
          this.loadJoinLink();
        }
      },
      error: () => {
        /* ignore soft poll */
      },
    });
  }

  /** MJ : sync combat / fog / XP membres sans écraser notes locales. */
  private softReloadLiveTable(): void {
    const campaignId = this.campaign()?.id;
    if (!campaignId || this.loading() || this.saving()) return;
    this.campaigns.get(campaignId).subscribe({
      next: (remote) => {
        const current = this.campaign();
        if (!current || current.id !== remote.id) {
          this.campaign.set(remote);
          return;
        }
        if (!current.isOwner) {
          this.announcePlayerXpGain(current, remote);
          this.campaign.set(remote);
          return;
        }
        const merged = mergeRemoteLiveTable(current, remote);
        this.announcePlayerXpGain(current, remote);
        this.campaign.set(merged);
        this.sessionDock.patchLiveCampaign(merged);
      },
      error: () => {
        /* ignore */
      },
    });
  }

  private isRemoteNewer(remoteIso: string, localIso: string): boolean {
    return isRemoteNewer(remoteIso, localIso);
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
    this.staleRemote.set(null);
    this.syncNotice.set(`+${delta} XP reçue — total campagne ${after}`);
    this.xpLevelUpAvailable.set(
      !!next.members.find((m) => m.userId === userId && m.role === 'player')?.approvedCharacterId,
    );
    window.setTimeout(() => {
      if (this.syncNotice()?.startsWith('+') && this.syncNotice()?.includes('XP reçue')) {
        this.syncNotice.set(null);
        this.xpLevelUpAvailable.set(false);
      }
    }, 12_000);
  }

  applyStaleRemote(): void {
    const remote = this.staleRemote();
    if (!remote) return;
    this.campaign.set(remote);
    this.sessionCache.cache(remote.id, remote.title, remote.data);
    this.staleRemote.set(null);
    this.syncNotice.set('Campagne rechargée depuis l’autre onglet.');
    window.setTimeout(() => this.syncNotice.set(null), 4_000);
    if (this.tab() === 'overview') this.loadActivity();
  }

  dismissStaleRemote(): void {
    this.staleRemote.set(null);
    if (this.syncNotice()?.includes('version plus récente')) {
      this.syncNotice.set(null);
    }
  }

  private clearSoftPollTimer(): void {
    if (this.softPollTimer) {
      clearInterval(this.softPollTimer);
      this.softPollTimer = null;
    }
  }

  /** Poll de secours uniquement si hub déconnecté — sinon SignalR suffit. */
  private tuneSoftPollInterval(c: CampaignDetailModel): void {
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

  reload(id?: string): void {
    const campaignId = id ?? this.campaign()?.id;
    if (!campaignId) return;
    this.loading.set(true);
    this.campaigns.get(campaignId).subscribe({
      next: (c) => {
        this.campaign.set(c);
        this.loading.set(false);
        this.sessionCache.cache(c.id, c.title, c.data);
        this.notifications.refresh();
        void this.live.watch(c.id);
        this.liveSub?.unsubscribe();
        this.liveSub = this.live.updates(c.id).subscribe((evt) => {
          const owner = this.campaign()?.isOwner === true;
          if (owner && (evt.reason === 'combat' || evt.reason === 'initiative' || evt.reason === 'xp')) {
            this.softReloadLiveTable();
          } else {
            this.softReload();
          }
          if (evt.reason === 'initiative' || !owner) {
            this.campaigns.getInitiativeBoard(c.id).subscribe({
              next: (board) => this.initiativeBoard.set(board),
              error: () => this.initiativeBoard.set(null),
            });
          }
        });
        const t = this.tab();
        const sub = this.prepSub();
        if (!c.isOwner && (c.data.pregenCharacters?.length ?? 0) === 0 && t === 'prep') {
          this.tab.set('overview');
        } else if (!c.isOwner && t === 'prep' && sub !== 'pregens') {
          this.prepSub.set('pregens');
        }
        if (!c.isOwner && (sub === 'creatures' || sub === 'encounters' || sub === 'maps' || sub === 'notebook' || sub === 'scenario')) {
          this.prepSub.set('pregens');
        }
        if (!c.isOwner) {
          this.startInitiativeBannerPoll(c.id);
          this.pendingInvites.set([]);
        } else {
          this.stopInitiativeBannerPoll();
          this.initiativeBoard.set(null);
          this.loadPendingInvites();
          this.loadJoinLink();
        }
        if (this.tab() === 'overview') {
          this.loadActivity();
        }
      },
      error: () => {
        const id = this.route.snapshot.paramMap.get('id');
        const cached = id ? this.sessionCache.read(id) : null;
        if (cached) {
          this.offlineSnapshot.set(cached);
          this.error.set(null);
        } else {
          this.error.set('Campagne introuvable.');
        }
        this.loading.set(false);
      },
    });
  }

  loadPendingInvites(): void {
    const c = this.campaign();
    if (!c?.isOwner) {
      this.pendingInvites.set([]);
      return;
    }
    this.campaigns.listPendingInvites(c.id).subscribe({
      next: (list) => {
        this.pendingInvites.set(list);
        this.pendingInviteUserIds.set(new Set(list.map((i) => i.userId)));
      },
      error: () => {
        /* ignore */
      },
    });
  }

  loadJoinLink(): void {
    const c = this.campaign();
    if (!c?.isOwner) {
      this.joinLink.set(null);
      return;
    }
    this.campaigns.getJoinLink(c.id).subscribe({
      next: (link) => this.joinLink.set({ token: link.token, enabled: link.enabled }),
      error: () => this.joinLink.set(null),
    });
  }

  /** Web Share API dispo (souvent mobile). */
  canNativeShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  copyCampaignJoinLink(): void {
    this.withJoinLinkUrl((url) => {
      if (!navigator.clipboard?.writeText) {
        this.rosterFeedback.set('Presse-papiers indisponible.');
        return;
      }
      void navigator.clipboard.writeText(url).then(
        () =>
          this.rosterFeedback.set(
            'Lien d’invitation copié — vos invités rejoignent sans être amis.',
          ),
        () => this.rosterFeedback.set('Impossible de copier le lien.'),
      );
    });
  }

  /** Partage natif (OS) ; repli copie presse-papiers. */
  shareCampaignJoinLink(): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.withJoinLinkUrl((url) => {
      if (this.canNativeShare()) {
        void navigator
          .share({
            title: c.title,
            text: `Rejoins la table « ${c.title} » sur Dragons Generator`,
            url,
          })
          .then(() => this.rosterFeedback.set('Invitation partagée.'))
          .catch(() => undefined);
        return;
      }
      if (!navigator.clipboard?.writeText) {
        this.rosterFeedback.set('Partage indisponible sur cet appareil.');
        return;
      }
      void navigator.clipboard.writeText(url).then(
        () =>
          this.rosterFeedback.set(
            'Lien d’invitation copié — vos invités rejoignent sans être amis.',
          ),
        () => this.rosterFeedback.set('Impossible de copier le lien.'),
      );
    });
  }

  private withJoinLinkUrl(use: (url: string) => void): void {
    const c = this.campaign();
    if (!c?.isOwner || this.joinLinkBusy()) return;
    const existing = this.joinLink();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const deliver = (token: string) => use(`${origin}/join/${token}`);

    if (existing?.enabled && existing.token) {
      deliver(existing.token);
      return;
    }

    this.joinLinkBusy.set(true);
    this.campaigns.createOrRotateJoinLink(c.id).subscribe({
      next: (link) => {
        this.joinLink.set({ token: link.token, enabled: link.enabled });
        this.joinLinkBusy.set(false);
        if (link.token) deliver(link.token);
      },
      error: () => {
        this.joinLinkBusy.set(false);
        this.rosterFeedback.set('Impossible de créer le lien d’invitation.');
      },
    });
  }

  regenerateJoinLink(): void {
    const c = this.campaign();
    if (!c?.isOwner || this.joinLinkBusy()) return;
    this.askConfirm(
      'Régénérer le lien ?',
      'L’ancien lien d’invitation ne fonctionnera plus. Les joueurs devront utiliser le nouveau.',
      () => {
        this.joinLinkBusy.set(true);
        this.campaigns.createOrRotateJoinLink(c.id).subscribe({
          next: (link) => {
            this.joinLink.set({ token: link.token, enabled: link.enabled });
            this.joinLinkBusy.set(false);
            this.rosterFeedback.set('Nouveau lien généré — l’ancien ne fonctionne plus.');
          },
          error: () => {
            this.joinLinkBusy.set(false);
            this.rosterFeedback.set('Régénération impossible.');
          },
        });
      },
      'Régénérer',
      true,
    );
  }

  revokeJoinLink(): void {
    const c = this.campaign();
    if (!c?.isOwner || this.joinLinkBusy()) return;
    this.joinLinkBusy.set(true);
    this.campaigns.revokeJoinLink(c.id).subscribe({
      next: () => {
        this.joinLink.set({ token: null, enabled: false });
        this.joinLinkBusy.set(false);
        this.rosterFeedback.set('Lien d’invitation désactivé.');
      },
      error: () => {
        this.joinLinkBusy.set(false);
        this.rosterFeedback.set('Désactivation impossible.');
      },
    });
  }

  copyFriendsInviteLink(): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/friends`;
    if (!navigator.clipboard?.writeText) {
      this.rosterFeedback.set('Presse-papiers indisponible.');
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () =>
        this.rosterFeedback.set(
          'Lien Amis copié — pour inviter un ami déjà dans votre liste.',
        ),
      () => this.rosterFeedback.set('Impossible de copier le lien.'),
    );
  }

  private isOnMapsView(): boolean {
    return this.tab() === 'prep' && this.prepSub() === 'maps';
  }

  setPrepSub(sub: PrepSub): void {
    if (!this.campaign()?.isOwner && sub !== 'pregens') {
      this.prepSub.set('pregens');
      this.syncTabQueryParams();
      return;
    }
    if (this.isOnMapsView() && sub !== 'maps') {
      this.dungeonMapsComp()?.flushPendingSave();
    }
    this.prepSub.set(sub);
    if (sub === 'notebook') {
      this.ensureNotebookPages();
    }
    this.syncTabQueryParams();
  }

  /** Normalise l’URL : prep → `?tab=prep&sub=…` ; legacy `?tab=maps` réécrit. */
  private syncTabQueryParams(): void {
    const tab = this.tab();
    const queryParams: Record<string, string | null> =
      tab === 'prep'
        ? { tab: 'prep', sub: this.prepSub() }
        : { tab, sub: null };
    const cur = this.route.snapshot.queryParamMap;
    if (
      cur.get('tab') === queryParams['tab'] &&
      (queryParams['sub'] == null
        ? !cur.get('sub')
        : cur.get('sub') === queryParams['sub'])
    ) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  setTab(t: Tab): void {
    const owner = this.campaign()?.isOwner === true;

    if (t === 'activity') {
      if (this.isOnMapsView()) this.dungeonMapsComp()?.flushPendingSave();
      this.tab.set('overview');
      this.loadActivity();
      this.syncTabQueryParams();
      return;
    }

    if (isPrepSub(t) || t === 'prep') {
      if (!owner && (this.campaign()?.data.pregenCharacters?.length ?? 0) === 0) {
        this.tab.set('overview');
        this.syncTabQueryParams();
        return;
      }
      const finalSub: PrepSub = (() => {
        if (t === 'prep') {
          if (!owner) return 'pregens';
          return PREP_SUBS.includes(this.prepSub()) ? this.prepSub() : 'scenario';
        }
        if (!owner && t !== 'pregens') return 'pregens';
        return t as PrepSub;
      })();

      if (this.isOnMapsView() && finalSub !== 'maps') {
        this.dungeonMapsComp()?.flushPendingSave();
      }
      this.tab.set('prep');
      this.prepSub.set(finalSub);
      if (finalSub === 'notebook') this.ensureNotebookPages();
      this.syncTabQueryParams();
      return;
    }

    if (this.isOnMapsView()) {
      this.dungeonMapsComp()?.flushPendingSave();
    }
    this.tab.set(t as PrimaryTab);
    this.syncTabQueryParams();
    if (t === 'handouts' && owner) {
      if (this.pdfPreviewKind() === 'bestiary' && this.campaign()!.data.creatures.length) {
        this.loadBestiaryPreview();
      } else {
        this.loadPackPreview();
      }
    }
    if (t === 'overview') {
      this.loadActivity();
    }
  }

  onSetupGuideAction(action: CampaignSetupAction): void {
    const c = this.campaign();
    switch (action) {
      case 'editScenario':
        this.editScenario();
        break;
      case 'openCreatures':
        this.setTab('creatures');
        break;
      case 'openMaps':
        this.setTab('maps');
        break;
      case 'openEncounters':
        this.setTab('encounters');
        break;
      case 'generateEncounters':
        this.generateEncountersFromStory();
        this.setTab('encounters');
        break;
      case 'openPlayers':
        this.setTab('players');
        break;
      case 'openPregens':
        this.setTab('pregens');
        break;
      case 'addSession':
        this.addSession();
        break;
      case 'openSessions':
        this.setTab('sessions');
        break;
      case 'startNextSession': {
        const next = this.nextPlannedSession();
        if (next) this.startPlaySession(next.id);
        else this.addSession();
        break;
      }
      case 'openPlay':
        this.openSessionDock();
        break;
      case 'openPlayFullscreen':
        this.openPlayFullscreen();
        break;
      case 'skipMaps':
        this.mapsStepSkipped.set(true);
        if (c) {
          try {
            sessionStorage.setItem(`dg-campaign-skip-maps:${c.id}`, '1');
          } catch {
            /* ignore */
          }
        }
        break;
    }
  }

  onFirstSessionAction(action: FirstSessionAction): void {
    switch (action) {
      case 'invite':
        this.copyCampaignJoinLink();
        break;
      case 'openPlayers':
        this.setTab('players');
        break;
      case 'openPregens':
        this.setTab('pregens');
        break;
      case 'openSessions':
        this.setTab('sessions');
        break;
      case 'addSession':
        this.addSession();
        break;
      case 'openPrep':
        this.setTab('prep');
        break;
      case 'openPlay': {
        const live = this.activePlaySession();
        const next = this.nextPlannedSession();
        if (live) this.openPlayFullscreen();
        else if (next) this.startPlaySession(next.id);
        else {
          this.addSession();
        }
        break;
      }
    }
  }

  onStatsNavigate(target: 'creatures' | 'encounters' | 'players' | 'handouts' | 'sessions' | 'prep'): void {
    if (target === 'prep') this.setTab('prep');
    else this.setTab(target);
  }

  loadActivity(): void {
    const c = this.campaign();
    if (!c) return;
    this.activityLoading.set(true);
    this.campaigns.listActivity(c.id).subscribe({
      next: (items) => {
        this.activity.set(items);
        this.activityLoading.set(false);
      },
      error: () => {
        this.activity.set([]);
        this.activityLoading.set(false);
      },
    });
  }

  openHandoutFromActivity(item: CampaignActivityItem): void {
    const handoutId = handoutIdFromActivity(item);
    if (item.kind !== 'handout_published') return;
    this.focusHandoutId.set(handoutId);
    this.setTab('handouts');
    const c = this.campaign();
    if (handoutId && c && !c.isOwner) {
      const published = (c.data.handouts ?? []).some((h) => h.id === handoutId && h.published);
      if (published) this.previewHandoutAsPlayer(handoutId);
    }
  }

  onHandoutPatch(event: HandoutPatchEvent): void {
    this.updateHandout(event.handoutId, event.patch);
  }

  onHandoutPatchImmediate(event: HandoutPatchEvent): void {
    this.updateHandout(event.handoutId, event.patch, { immediate: true });
  }

  onHandoutTogglePublished(event: HandoutPublishEvent): void {
    this.toggleHandoutPublished(event.handoutId, event.published);
  }

  private startInitiativeBannerPoll(campaignId: string): void {
    this.stopInitiativeBannerPoll();
    const refresh = () => {
      this.campaigns.getInitiativeBoard(campaignId).subscribe({
        next: (board) => this.initiativeBoard.set(board),
        error: () => this.initiativeBoard.set(null),
      });
    };
    refresh();
    const ms = this.live.fallbackPollMs(8_000);
    this.initiativePollTimer = setInterval(refresh, ms);
  }

  private stopInitiativeBannerPoll(): void {
    if (!this.initiativePollTimer) return;
    clearInterval(this.initiativePollTimer);
    this.initiativePollTimer = null;
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
    this.updateSession(event.sessionId, event.patch);
  }

  onSessionPatchImmediate(event: SessionPatchEvent): void {
    this.updateSession(event.sessionId, event.patch, { immediate: true });
  }

  onSessionDateChangeEvent(event: SessionDateChangeEvent): void {
    this.onSessionDateChange(event.sessionId, event.value);
  }

  onRosterMemberCharacterAction(action: MemberCharacterAction, mode: 'view' | 'print'): void {
    if (mode === 'view') this.viewMemberCharacter(action.member, action.scope);
    else this.printMemberFullSheet(action.member, action.scope);
  }

  addHandout(): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.flushHandoutSave();
    const handout = createCampaignHandout();
    this.editingHandoutId.set(handout.id);
    this.saveData({ handouts: [...(c.data.handouts ?? []), handout] });
  }

  insertHandoutPack(packId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const added = buildHandoutsFromPack(packId);
    if (!added.length) return;
    this.flushHandoutSave();
    this.saveData({ handouts: [...(c.data.handouts ?? []), ...added] });
  }

  insertEncounterPack(packId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const added = buildEncountersFromPack(packId);
    if (!added.length) return;
    this.saveData({ encounters: [...(c.data.encounters ?? []), ...added] });
    this.rosterFeedback.set(`${added.length} rencontre(s) ajoutée(s).`);
  }

  @HostListener('document:click')
  onDocumentClickCloseAtlasPicker(): void {
    if (this.atlasPinPickerOpen()) this.closeAtlasPinPicker();
  }

  @HostListener('document:keydown.escape')
  onEscapeCloseAtlasPicker(): void {
    if (this.atlasPinPickerOpen()) this.closeAtlasPinPicker();
  }

  toggleAtlasPinPicker(ev: Event): void {
    ev.stopPropagation();
    if (this.atlasPinPickerOpen()) {
      this.closeAtlasPinPicker();
      return;
    }
    this.atlasPinPickerOpen.set(true);
    this.atlasPinFilter.set('');
    this.atlasCustomName.set('');
    this.atlasShowCustom.set(false);
    this.ensureAtlasCivsLoaded();
  }

  closeAtlasPinPicker(): void {
    this.atlasPinPickerOpen.set(false);
    this.atlasShowCustom.set(false);
    this.atlasCustomName.set('');
    this.atlasPinFilter.set('');
  }

  private ensureAtlasCivsLoaded(): void {
    if (this.atlasCivOptions().length || this.atlasCivsLoading()) return;
    this.atlasCivsLoading.set(true);
    this.data.getCivilisationsSummary().subscribe({
      next: (list) => {
        this.atlasCivOptions.set(
          (list ?? [])
            .filter((civ) => !!civ?.id && !!civ?.name)
            .map((civ) => ({ id: civ.id, name: civ.name })),
        );
        this.atlasCivsLoading.set(false);
      },
      error: () => {
        this.atlasCivOptions.set([]);
        this.atlasCivsLoading.set(false);
      },
    });
  }

  addAtlasPinFromCiv(civId: string, name: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const id = civId.trim();
    const label = name.trim();
    if (!id || !label) return;
    if ((c.data.atlasPins ?? []).some((p) => p.civId === id)) {
      this.closeAtlasPinPicker();
      return;
    }
    this.pushAtlasPin({
      id: crypto.randomUUID?.() ?? `pin-${Date.now()}`,
      name: label,
      civId: id,
      note: '',
    });
    this.closeAtlasPinPicker();
  }

  addAtlasPinCustom(): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const name = this.atlasCustomName().trim();
    if (!name) return;
    const existing = (c.data.atlasPins ?? []).some(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      this.closeAtlasPinPicker();
      return;
    }
    this.pushAtlasPin({
      id: crypto.randomUUID?.() ?? `pin-${Date.now()}`,
      name,
      civId: c.data.regionId ?? null,
      note: '',
    });
    this.closeAtlasPinPicker();
  }

  private pushAtlasPin(pin: CampaignAtlasPin): void {
    const c = this.campaign();
    if (!c) return;
    this.saveData({ atlasPins: [...(c.data.atlasPins ?? []), pin] });
  }

  removeAtlasPin(pinId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.saveData({ atlasPins: (c.data.atlasPins ?? []).filter((p) => p.id !== pinId) });
  }

  async exportSessionEveningPdf(sessionId: string): Promise<void> {
    const c = this.campaign();
    if (!c) return;
    const session = (c.data.sessions ?? []).find((s) => s.id === sessionId);
    if (!session) return;
    try {
      await exportEveningPdf(
        c.title,
        session,
        (c.data.handouts ?? []).filter((h) => h.published),
      );
    } catch {
      this.error.set('Impossible d’exporter le PDF soirée.');
    }
  }

  async exportSessionUnifiedPack(sessionId: string): Promise<void> {
    const c = this.campaign();
    if (!c) return;
    const session = (c.data.sessions ?? []).find((s) => s.id === sessionId);
    if (!session) return;
    try {
      await exportUnifiedEveningPack(
        c.title,
        session,
        (c.data.handouts ?? []).filter((h) => h.published),
        {
          adventureSynopsis: c.data.adventure,
          encounterNames: (c.data.encounters ?? []).map((e) => e.name || 'Rencontre'),
          creatureNames: (c.data.creatures ?? [])
            .map((cr) => cr.customName?.trim() || cr.creatureName || '')
            .filter(Boolean)
            .slice(0, 40),
          playerNames: this.players()
            .map((p) => p.displayName || p.approvedCharacterName || '')
            .filter(Boolean),
        },
      );
    } catch {
      this.error.set('Impossible d’exporter le pack soirée.');
    }
  }

  prefillSessionRunSheet(sessionId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const session = (c.data.sessions ?? []).find((s) => s.id === sessionId);
    if (!session) return;
    const patch = prefillRunSheetFromCampaign(c.data, session);
    if (!Object.keys(patch).length) {
      this.rosterFeedback.set('Run sheet déjà rempli — rien à préremplir.');
      return;
    }
    this.updateSession(sessionId, patch, { immediate: true });
    this.rosterFeedback.set('Run sheet prérempli depuis la prépa.');
  }

  openLevelUpFromXp(): void {
    const me = this.myPlayerMember();
    const charId = me?.approvedCharacterId;
    if (!charId) {
      this.setTab('players');
      return;
    }
    this.characters.get(charId).subscribe({
      next: (row) => {
        const character = {
          id: row.id,
          name: row.name,
          ...(typeof row.data === 'object' && row.data ? row.data : {}),
        } as import('@core/models/Character/character').Character;
        this.handoff.stashEdit(character);
        void this.router.navigate(['/create'], { queryParams: { levelUp: '1' } });
      },
      error: () => this.error.set('Impossible d’ouvrir la fiche pour monter de niveau.'),
    });
  }

  startEditHandout(handoutId: string): void {
    const c = this.campaign();
    const handout = c?.data.handouts?.find((h) => h.id === handoutId);
    if (handout?.kind === 'map') {
      const map = c?.data.dungeonMaps?.find((m) => m.handoutId === handoutId);
      if (map) {
        this.setTab('maps');
        this.focusDungeonMapId.set(map.id);
        return;
      }
    }
    this.flushHandoutSave();
    this.editingHandoutId.set(handoutId);
  }

  stopEditHandout(): void {
    this.flushHandoutSave();
    this.editingHandoutId.set(null);
  }

  updateHandout(
    handoutId: string,
    patch: Partial<CampaignHandout>,
    options?: { immediate?: boolean },
  ): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const now = new Date().toISOString();
    const handouts = (c.data.handouts ?? []).map((h) =>
      h.id === handoutId ? { ...h, ...patch, updatedAt: now } : h,
    );
    this.campaign.update((prev) => (prev ? { ...prev, data: { ...prev.data, handouts } } : prev));

    if (options?.immediate) {
      if (this.handoutSaveTimer) {
        clearTimeout(this.handoutSaveTimer);
        this.handoutSaveTimer = null;
      }
      this.saveData({ handouts });
      return;
    }

    if (this.handoutSaveTimer) clearTimeout(this.handoutSaveTimer);
    this.handoutSaveTimer = setTimeout(() => {
      this.handoutSaveTimer = null;
      const latest = this.campaign();
      this.saveData({ handouts: latest?.data.handouts ?? [] });
    }, 700);
  }

  toggleHandoutPublished(handoutId: string, published: boolean): void {
    const patch: Partial<CampaignHandout> = published
      ? { published: true, publishedAt: new Date().toISOString() }
      : { published: false };
    this.updateHandout(handoutId, patch, { immediate: true });
  }

  pinHandout(handoutId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const next = c.data.pinnedHandoutId === handoutId ? null : handoutId;
    this.pinnedOverlayDismissed.set(false);
    this.saveData({ pinnedHandoutId: next });
  }

  patchEncounter(encId: string, patch: Partial<EncounterGroup>): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const encounters = (c.data.encounters ?? []).map((e) =>
      e.id === encId ? { ...e, ...patch } : e,
    );
    this.saveData({ encounters });
  }

  openDungeonForEncounter(enc: EncounterGroup): void {
    this.setTab('maps');
    this.focusDungeonMapId.set(enc.dungeonMapId ?? null);
  }

  onInitiativeSubmitted(): void {
    const id = this.campaign()?.id;
    if (!id) return;
    this.campaigns.getInitiativeBoard(id).subscribe((board) => this.initiativeBoard.set(board));
  }

  dismissPinnedOverlay(): void {
    this.pinnedOverlayDismissed.set(true);
  }

  openHandoutTab(): void {
    this.setTab('handouts');
  }

  openActivityTab(): void {
    this.setTab('overview');
    this.loadActivity();
  }

  openOverviewTab(): void {
    this.setTab('overview');
  }

  openPrepScenario(): void {
    this.setTab('scenario');
  }

  toggleRosterSheet(): void {
    this.rosterSheetOpen.update((v) => !v);
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

  private askConfirm(
    title: string,
    body: string,
    onConfirm: () => void,
    confirmLabel = 'Supprimer',
    danger = true,
  ): void {
    this.confirmDialog.set({ title, body, confirmLabel, danger, onConfirm });
  }

  deleteHandout(handoutId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.askConfirm('Supprimer le document', 'Supprimer ce document ?', () => {
      this.flushHandoutSave();
      if (this.editingHandoutId() === handoutId) this.editingHandoutId.set(null);
      const dungeonMaps = (c.data.dungeonMaps ?? []).map((m) =>
        m.handoutId === handoutId ? { ...m, handoutId: null } : m,
      );
      this.saveData({
        handouts: (c.data.handouts ?? []).filter((h) => h.id !== handoutId),
        pinnedHandoutId: c.data.pinnedHandoutId === handoutId ? null : c.data.pinnedHandoutId,
        dungeonMaps,
      });
    });
  }

  private flushHandoutSave(): void {
    if (!this.handoutSaveTimer) return;
    clearTimeout(this.handoutSaveTimer);
    this.handoutSaveTimer = null;
    const latest = this.campaign();
    if (!latest?.isOwner) return;
    this.saveData({ handouts: latest.data.handouts ?? [] });
  }

  addSession(): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.flushSessionSave();
    const session: CampaignSession = {
      id: crypto.randomUUID?.() ?? `session-${Date.now()}`,
      title: 'Session 1',
      scheduledAt: new Date().toISOString(),
      status: 'planned',
      mode: 'online',
    };
    this.editingSessionId.set(session.id);
    this.setTab('sessions');
    this.saveData({ sessions: [session, ...(c.data.sessions ?? [])] });
    setTimeout(() => {
      document.getElementById('session-edit-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }

  onScheduleEventsChange(events: CampaignScheduleEvent[]): void {
    if (!this.campaign()?.isOwner) return;
    this.saveData({ scheduleEvents: events });
  }

  onScheduleRsvp(ev: { eventId: string; status: 'yes' | 'no' | 'maybe' }): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.setScheduleRsvp(c.id, ev.eventId, ev.status).subscribe({
      next: (rsvps) => {
        const mapped = rsvps.map((r) => ({
          userId: r.userId,
          displayName: r.displayName,
          status: r.status as 'yes' | 'no' | 'maybe',
          at: r.at,
        }));
        const next = (c.data.scheduleEvents ?? []).map((e) =>
          e.id === ev.eventId ? { ...e, rsvps: mapped } : e,
        );
        this.campaign.update((cur) =>
          cur ? { ...cur, data: { ...cur.data, scheduleEvents: next } } : cur,
        );
      },
    });
  }

  /** Hub : convertir la prochaine date calendrier en session. */
  convertNextHubSchedule(): void {
    const next = this.nextScheduleGame();
    if (!next) return;
    const ev = (this.campaign()?.data.scheduleEvents ?? []).find((e) => e.id === next.id);
    if (!ev) return;
    this.convertScheduleEventToSession(ev, next.startsAt);
  }

  convertScheduleEventToSession(ev: CampaignScheduleEvent, occurrenceStartsAt?: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;

    const scheduledAt = occurrenceStartsAt || ev.startsAt || new Date().toISOString();
    const run = () => this.doConvertScheduleEventToSession(ev, scheduledAt);

    if (ev.rrule?.trim()) {
      const when = new Date(scheduledAt).toLocaleString('fr-FR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
      this.askConfirm(
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

  private doConvertScheduleEventToSession(ev: CampaignScheduleEvent, scheduledAt: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.flushSessionSave();
    const session: CampaignSession = {
      id: crypto.randomUUID?.() ?? `session-${Date.now()}`,
      title: ev.title?.trim() || 'Session',
      scheduledAt,
      status: 'planned',
      mode: 'online',
      location: ev.location || undefined,
      notes: ev.notes || undefined,
    };
    // Garder la date calendrier liée (RSVP visibles) plutôt que la supprimer.
    const scheduleEvents = (c.data.scheduleEvents ?? []).map((e) =>
      e.id === ev.id ? { ...e, linkedSessionId: session.id } : e,
    );
    this.editingSessionId.set(session.id);
    this.setTab('sessions');
    this.saveData({
      sessions: [session, ...(c.data.sessions ?? [])],
      scheduleEvents,
    });

    // Inviter auto les RSVP « oui » pas encore membres de la campagne.
    const memberIds = new Set(this.players().map((m) => m.userId));
    const toInvite = (ev.rsvps ?? [])
      .filter((r) => r.status === 'yes' && r.userId && !memberIds.has(r.userId))
      .map((r) => r.userId);
    let invited = 0;
    let inviteFails = 0;
    const finishInviteFeedback = () => {
      const yesAlready = (ev.rsvps ?? []).filter(
        (r) => r.status === 'yes' && memberIds.has(r.userId),
      ).length;
      const parts = [
        `Session « ${session.title} » créée`,
        yesAlready ? `${yesAlready} déjà à la table` : null,
        invited ? `${invited} invitation(s) envoyée(s)` : null,
        inviteFails ? `${inviteFails} invitation(s) en échec` : null,
      ].filter(Boolean);
      this.rosterFeedback.set(parts.join(' · '));
    };
    if (!toInvite.length) {
      finishInviteFeedback();
    } else {
      for (const userId of toInvite) {
        this.campaigns.invitePlayer(c.id, userId).subscribe({
          next: () => {
            invited++;
            this.pendingInviteUserIds.update((prev) => new Set([...prev, userId]));
            if (invited + inviteFails === toInvite.length) finishInviteFeedback();
          },
          error: () => {
            inviteFails++;
            if (invited + inviteFails === toInvite.length) finishInviteFeedback();
          },
        });
      }
    }

    setTimeout(() => {
      document.getElementById('session-edit-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }

  openSessionFromCalendar(sessionId: string): void {
    this.startEditSession(sessionId);
  }

  startEditSession(sessionId: string): void {
    this.flushSessionSave();
    this.editingSessionId.set(sessionId);
    if (this.tab() !== 'sessions') this.setTab('sessions');
    setTimeout(() => {
      document.getElementById('session-edit-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
  }

  stopEditSession(): void {
    this.flushSessionSave();
    this.editingSessionId.set(null);
  }

  /** Mise à jour locale immédiate + sauvegarde (debounce pour texte). */
  updateSession(sessionId: string, patch: Partial<CampaignSession>, options?: { immediate?: boolean }): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const sessions = (c.data.sessions ?? []).map((s) =>
      s.id === sessionId ? { ...s, ...patch } : s,
    );
    this.campaign.update((prev) =>
      prev ? { ...prev, data: { ...prev.data, sessions } } : prev,
    );

    const immediate = options?.immediate === true;
    if (immediate) {
      if (this.sessionSaveTimer) {
        clearTimeout(this.sessionSaveTimer);
        this.sessionSaveTimer = null;
      }
      this.saveData({ sessions });
      return;
    }

    if (this.sessionSaveTimer) clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = setTimeout(() => {
      this.sessionSaveTimer = null;
      const latest = this.campaign();
      if (!latest) return;
      this.saveData({ sessions: latest.data.sessions ?? [] });
    }, 700);
  }

  private flushSessionSave(): void {
    if (!this.sessionSaveTimer) return;
    clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = null;
    const latest = this.campaign();
    if (!latest?.isOwner) return;
    this.saveData({ sessions: latest.data.sessions ?? [] });
  }

  removeSession(sessionId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.askConfirm('Supprimer la session', 'Supprimer cette session ?', () => {
      this.flushSessionSave();
      if (this.editingSessionId() === sessionId) this.editingSessionId.set(null);
      const sessions = (c.data.sessions ?? []).filter((s) => s.id !== sessionId);
      const clearingActive = c.data.activeSessionId === sessionId;
      this.saveData({
        sessions,
        ...(clearingActive ? { activeSessionId: null } : {}),
      });
      if (clearingActive) {
        this.sessionDock.forgetAfterSessionEnd(c.id);
      }
    });
  }

  onSessionDateChange(sessionId: string, value: string): void {
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return;
    this.updateSession(sessionId, { scheduledAt: parsed.toISOString() }, { immediate: true });
  }

  upcomingSessions(): CampaignSession[] {
    const sessions = this.campaign()?.data.sessions ?? [];
    return [...sessions]
      .filter((s) => s.status === 'planned')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  sortedSessions(): CampaignSession[] {
    const sessions = this.campaign()?.data.sessions ?? [];
    return [...sessions].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  }

  openBestiaryFullscreen(): void {
    const url = this.rawBlobUrl;
    if (!url) return;
    // Sur tablette, window.open(blob) affiche souvent juste le nom — forcer un téléchargement nommé.
    if (prefersNativePdfFallback()) {
      const name =
        this.pdfPreviewKind() === 'bestiary'
          ? `bestiaire-${this.campaign()?.title ?? 'campagne'}.pdf`
          : `pack-mj-${this.campaign()?.title ?? 'campagne'}.pdf`;
      downloadBlobUrl(url, name.replace(/\s+/g, '-'));
      return;
    }
    window.open(url, '_blank');
  }

  downloadPdfPreview(): void {
    const url = this.rawBlobUrl;
    if (!url) return;
    const name =
      this.pdfPreviewKind() === 'bestiary'
        ? `bestiaire-${this.campaign()?.title ?? 'campagne'}.pdf`
        : `pack-mj-${this.campaign()?.title ?? 'campagne'}.pdf`;
    downloadBlobUrl(url, name.replace(/\s+/g, '-'));
  }

  private revokePreviewUrl(): void {
    if (this.rawBlobUrl) {
      URL.revokeObjectURL(this.rawBlobUrl);
      this.rawBlobUrl = null;
    }
    this.pdfPreviewUrl.set(null);
    this.pdfPreviewRawUrl.set(null);
    this.previewCacheKey = null;
  }

  private async setPreviewBlobUrl(url: string, filename: string): Promise<void> {
    let named: string;
    try {
      named = await namedPdfObjectUrl(url, filename);
      if (named !== url) URL.revokeObjectURL(url);
    } catch {
      named = url;
    }
    this.rawBlobUrl = named;
    this.pdfPreviewRawUrl.set(named);
    this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(named));
  }

  loadPackPreview(): void {
    const c = this.campaign();
    if (!c?.isOwner) {
      this.revokePreviewUrl();
      return;
    }
    const cacheKey = `${c.id}:pack`;
    if (this.previewCacheKey === cacheKey && this.pdfPreviewUrl()) {
      this.pdfPreviewKind.set('pack');
      return;
    }

    this.pdfPreviewKind.set('pack');
    this.isLoadingPreview.set(true);
    this.loadCreatureEntries(c.data).subscribe({
      next: async (entries) => {
        try {
          this.revokePreviewUrl();
          const summaries = await this.loadPlayerSummaries();
          const pdf = await getCampaignPdfService(this.injector);
          const url = await pdf.generateCampaignPackBlob(c.title, c.data, entries, summaries);
          await this.setPreviewBlobUrl(url, `pack-mj-${c.title.replace(/\s+/g, '-')}.pdf`);
          this.previewCacheKey = cacheKey;
        } catch {
          this.revokePreviewUrl();
        } finally {
          this.isLoadingPreview.set(false);
        }
      },
      error: () => {
        this.revokePreviewUrl();
        this.isLoadingPreview.set(false);
      },
    });
  }

  loadBestiaryPreview(): void {
    const c = this.campaign();
    if (!c?.isOwner || !c.data.creatures.length) {
      this.revokePreviewUrl();
      return;
    }
    const cacheKey = `${c.id}:bestiary`;
    if (this.previewCacheKey === cacheKey && this.pdfPreviewUrl()) {
      this.pdfPreviewKind.set('bestiary');
      return;
    }

    this.pdfPreviewKind.set('bestiary');
    this.isLoadingPreview.set(true);
    this.loadCreatureEntries(c.data).subscribe({
      next: async (entries) => {
        try {
          if (!entries.length) {
            this.revokePreviewUrl();
            return;
          }
          this.revokePreviewUrl();
          const pdf = await getCampaignPdfService(this.injector);
          const url = await pdf.generateCreaturesPdfBlob(entries, c.title, c.data);
          await this.setPreviewBlobUrl(url, `bestiaire-${c.title.replace(/\s+/g, '-')}.pdf`);
          this.previewCacheKey = cacheKey;
        } catch {
          this.revokePreviewUrl();
        } finally {
          this.isLoadingPreview.set(false);
        }
      },
      error: () => {
        this.revokePreviewUrl();
        this.isLoadingPreview.set(false);
      },
    });
  }

  saveData(patch: Partial<CampaignData>): void {
    const c = this.campaign();
    if (!c || c.isHistory) return;
    const data = { ...c.data, ...patch };
    this.campaign.update((prev) => (prev ? { ...prev, data } : prev));

    const keys = Object.keys(patch);
    if (keys.length === 1 && keys[0] === 'notes') {
      this.scheduleSoftPersist();
      return;
    }

    this.clearSoftPersistTimer();
    const latest = this.campaign();
    if (!latest) return;
    this.persist(latest.title, latest.data);
  }

  saveTitle(title: string): void {
    const c = this.campaign();
    if (!c) return;
    this.campaign.update((prev) => (prev ? { ...prev, title } : prev));
    this.scheduleSoftPersist();
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

  private flushSoftPersistTimer(): void {
    if (!this.softPersistTimer) return;
    this.clearSoftPersistTimer();
    const latest = this.campaign();
    if (!latest?.isOwner) return;
    this.persist(latest.title, latest.data);
  }

  private persist(title: string, data: CampaignData, onSuccess?: () => void): void {
    const c = this.campaign();
    if (!c) return;
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
            // Ne jamais réappliquer le blob envoyé : l'état local est la source de vérité.
            return { ...prev, updatedAt: summary.updatedAt };
          });
          this.sessionCache.cache(campaignId, this.campaign()?.title ?? title, this.campaign()?.data ?? data);
          if (seq === this.persistSeq) this.saving.set(false);
          if (this.tab() === 'overview') this.loadActivity();
          onSuccess?.();
        } catch {
          if (seq === this.persistSeq) {
            this.error.set('Échec de la sauvegarde.');
            this.saving.set(false);
          }
        }
      });
  }

  generateEncountersFromStory(): void {
    const c = this.campaign();
    if (!c || c.data.creatures.length === 0) return;
    const xpMap = this.creatureXpMap();
    const antagonists = c.data.creatures.filter((x) => x.role === 'antagonist');
    const others = c.data.creatures.filter((x) => x.role !== 'antagonist');
    const groups: EncounterGroup[] = [];
    if (antagonists.length) {
      groups.push(createEncounterFromCreatures('Confrontation principale', antagonists, xpMap));
    }
    if (others.length) {
      groups.push(createEncounterFromCreatures('Rencontres secondaires', others, xpMap));
    }
    this.saveData({ encounters: [...c.data.encounters, ...groups] });
  }

  markDefeated(encounterId: string, creatureIndex: number): void {
    const c = this.campaign();
    if (!c || !c.isOwner) return;
    const encounters = c.data.encounters.map((enc) => {
      if (enc.id !== encounterId) return enc;
      const creatures = enc.creatures.map((cr, i) => {
        if (i !== creatureIndex || cr.defeated >= cr.quantity) return cr;
        return { ...cr, defeated: cr.defeated + 1 };
      });
      return { ...enc, creatures };
    });
    this.saveData({ encounters });
  }

  undoDefeated(encounterId: string, creatureIndex: number): void {
    const c = this.campaign();
    if (!c || !c.isOwner) return;
    const encounters = c.data.encounters.map((enc) => {
      if (enc.id !== encounterId) return enc;
      const creatures = enc.creatures.map((cr, i) => {
        if (i !== creatureIndex || cr.defeated <= 0) return cr;
        return { ...cr, defeated: cr.defeated - 1 };
      });
      return { ...enc, creatures };
    });
    this.saveData({ encounters });
  }

  distributeEncounterXp(encounter: EncounterGroup): void {
    const c = this.campaign();
    if (!c || !c.isOwner || encounter.xpAwarded) return;
    if (this.awardingXpId()) return;
    const xpGained = encounterTotalXp(encounter);
    if (xpGained <= 0) return;

    const approved = this.players().filter((p) => p.proposalStatus === 'approved');
    if (approved.length === 0) {
      this.error.set('Aucun joueur avec un personnage approuvé.');
      return;
    }

    const share = Math.floor(xpGained / approved.length);
    if (share <= 0) return;

    this.awardingXpId.set(encounter.id);
    this.error.set(null);
    let completed = 0;
    let failed = 0;
    for (const player of approved) {
      this.campaigns.awardXp(c.id, player.id, share).subscribe({
        next: () => {
          completed++;
          if (completed + failed === approved.length) {
            this.awardingXpId.set(null);
            if (failed === 0) {
              const encounters = c.data.encounters.map((e) =>
                e.id === encounter.id ? { ...e, xpAwarded: true } : e,
              );
              this.saveData({ encounters });
            } else {
              this.error.set(
                `XP partiellement envoyée (${completed}/${approved.length}). Réessayez.`,
              );
            }
          }
        },
        error: () => {
          failed++;
          if (completed + failed === approved.length) {
            this.awardingXpId.set(null);
            this.error.set(
              `Échec XP (${completed}/${approved.length} OK). Vérifiez la connexion.`,
            );
          }
        },
      });
    }
  }

  inviteFriend(userId: string): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.invitePlayer(c.id, userId).subscribe({
      next: () => {
        this.error.set(null);
        this.pendingInviteUserIds.update((prev) => new Set([...prev, userId]));
        const name = this.friendsList().find((f) => f.id === userId)?.displayName ?? 'ami';
        this.rosterFeedback.set(`Invitation envoyée à ${name}.`);
        this.loadPendingInvites();
        if (this.tab() === 'overview') this.loadActivity();
      },
      error: (err) => {
        const msg = err?.error?.errors?.[0]?.reason ?? 'Invitation impossible.';
        this.error.set(msg);
        this.loadPendingInvites();
      },
    });
  }

  proposeCharacter(characterId: string): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.proposeCharacter(c.id, characterId).subscribe({
      next: () => {
        this.reload();
        this.notifications.refresh();
        if (this.tab() === 'overview') this.loadActivity();
      },
      error: () => this.error.set('Impossible de proposer ce personnage.'),
    });
  }

  approveMember(member: CampaignMember): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.approveProposal(c.id, member.id).subscribe({
      next: () => {
        this.rosterFeedback.set(
          `${member.proposedCharacterName ?? 'Personnage'} approuvé — le joueur peut lire « Comment jouer » dans le guide.`,
        );
        this.reload();
        this.notifications.refresh();
        if (this.tab() === 'overview') this.loadActivity();
      },
      error: () => this.error.set('Impossible d’approuver ce personnage.'),
    });
  }

  rejectMember(member: CampaignMember): void {
    const c = this.campaign();
    if (!c) return;
    const name = member.proposedCharacterName ?? 'cette proposition';
    this.askConfirm(
      'Refuser la proposition',
      `Refuser « ${name} » de ${member.displayName} ? Le joueur devra en proposer une autre.`,
      () => {
        this.campaigns.rejectProposal(c.id, member.id).subscribe({
          next: () => {
            this.reload();
            this.notifications.refresh();
            if (this.tab() === 'overview') this.loadActivity();
          },
          error: () => this.error.set('Impossible de refuser ce personnage.'),
        });
      },
      'Refuser',
      true,
    );
  }

  canRequestCharacterPick(member: CampaignMember): boolean {
    return !member.approvedCharacterId && member.proposalStatus !== 'pending';
  }

  requestCharacterPick(member: CampaignMember): void {
    const c = this.campaign();
    if (!c || !this.canRequestCharacterPick(member) || this.characterRequestLoadingId()) return;
    this.characterRequestLoadingId.set(member.id);
    this.rosterFeedback.set(null);
    this.campaigns.requestCharacterPick(c.id, member.id).subscribe({
      next: () => {
        this.characterRequestLoadingId.set(null);
        this.rosterFeedback.set(`Rappel envoyé à ${member.displayName}.`);
        this.notifications.refresh();
        if (this.tab() === 'overview') this.loadActivity();
      },
      error: () => {
        this.characterRequestLoadingId.set(null);
        this.error.set('Impossible d’envoyer la demande.');
      },
    });
  }

  isCharacterRequestLoading(memberId: string): boolean {
    return this.characterRequestLoadingId() === memberId;
  }

  removeMember(member: CampaignMember): void {
    const c = this.campaign();
    if (!c) return;
    this.askConfirm(
      'Retirer le joueur',
      `Retirer ${member.displayName} de la campagne ?`,
      () => {
        this.campaigns.removeMember(c.id, member.id).subscribe({
          next: () => {
            this.error.set(null);
            this.reload();
            if (this.tab() === 'overview') this.loadActivity();
          },
          error: () => this.error.set('Impossible de retirer ce joueur.'),
        });
      },
      'Retirer',
    );
  }

  setMemberAsSpectator(member: CampaignMember): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.askConfirm(
      'Passer en spectateur',
      `${member.displayName} ne pourra plus jouer (lecture seule sur /play). Continuer ?`,
      () => {
        this.campaigns.setMemberSpectator(c.id, member.id).subscribe({
          next: () => {
            this.rosterFeedback.set(`${member.displayName} est maintenant spectateur.`);
            this.reload();
          },
          error: () => this.error.set('Impossible de passer ce membre en spectateur.'),
        });
      },
      'Spectateur',
    );
  }

  readonly leaving = signal(false);
  readonly showLeaveConfirm = signal(false);
  readonly leaveConfirmInput = signal('');
  readonly archiving = signal(false);
  readonly deletingCampaign = signal(false);
  readonly showDeleteConfirm = signal(false);
  readonly deleteConfirmInput = signal('');
  readonly deleteCampaignError = signal<string | null>(null);

  /** Ouvre la boîte de confirmation (retaper le nom de la campagne pour la quitter). */
  requestLeaveCampaign(): void {
    const c = this.campaign();
    if (!c || c.isOwner || this.leaving()) return;
    this.leaveConfirmInput.set('');
    this.showLeaveConfirm.set(true);
  }

  cancelLeaveCampaign(): void {
    this.showLeaveConfirm.set(false);
    this.leaveConfirmInput.set('');
  }

  /** Le nom retapé doit correspondre exactement au titre de la campagne pour débloquer le départ. */
  readonly canConfirmLeave = computed(() => {
    const c = this.campaign();
    return !!c && this.leaveConfirmInput().trim() === c.title.trim();
  });

  /** Le joueur connecté quitte volontairement la campagne, après avoir retapé son nom. */
  leaveCampaign(): void {
    const c = this.campaign();
    if (!c || c.isOwner || this.leaving() || !this.canConfirmLeave()) return;
    this.leaving.set(true);
    this.campaigns.leaveCampaign(c.id).subscribe({
      next: () => {
        this.leaving.set(false);
        this.showLeaveConfirm.set(false);
        this.router.navigate(['/campaigns']);
      },
      error: () => {
        this.leaving.set(false);
        this.error.set('Impossible de quitter la campagne.');
      },
    });
  }

  setCampaignArchived(archived: boolean): void {
    const c = this.campaign();
    if (!c || c.isHistory || this.archiving()) return;
    this.archiving.set(true);
    this.campaigns.setArchived(c.id, archived).subscribe({
      next: () => {
        this.campaign.update((cur) => (cur ? { ...cur, isArchived: archived } : cur));
        this.archiving.set(false);
        this.syncNotice.set(
          archived
            ? 'Campagne archivée — toujours accessible depuis Archives.'
            : 'Campagne désarchivée — de retour dans Actives.',
        );
        window.setTimeout(() => {
          const n = this.syncNotice();
          if (n?.includes('archiv')) this.syncNotice.set(null);
        }, 4_000);
      },
      error: () => {
        this.archiving.set(false);
        this.error.set(archived ? 'Impossible d’archiver.' : 'Impossible de désarchiver.');
      },
    });
  }

  requestDeleteCampaign(): void {
    const c = this.campaign();
    if (!c?.isOwner || this.deletingCampaign()) return;
    this.deleteConfirmInput.set('');
    this.deleteCampaignError.set(null);
    this.showDeleteConfirm.set(true);
  }

  cancelDeleteCampaign(): void {
    this.showDeleteConfirm.set(false);
    this.deleteConfirmInput.set('');
    this.deleteCampaignError.set(null);
  }

  readonly canConfirmDeleteCampaign = computed(() => {
    const c = this.campaign();
    return !!c && this.deleteConfirmInput().trim() === c.title.trim();
  });

  deleteCampaignFromDetail(): void {
    const c = this.campaign();
    if (!c?.isOwner || !this.canConfirmDeleteCampaign() || this.deletingCampaign()) return;
    this.deletingCampaign.set(true);
    this.deleteCampaignError.set(null);
    this.campaigns.delete(c.id).subscribe({
      next: () => {
        this.deletingCampaign.set(false);
        this.showDeleteConfirm.set(false);
        this.router.navigate(['/campaigns']);
      },
      error: () => {
        this.deletingCampaign.set(false);
        this.deleteCampaignError.set('Échec de la suppression. Réessayez.');
      },
    });
  }

  memberLoadingKey(memberId: string, scope: 'proposed' | 'approved'): string {
    return `${memberId}-${scope}`;
  }

  isMemberCharacterLoading(memberId: string, scope: 'proposed' | 'approved'): boolean {
    return this.memberCharacterLoadingId() === this.memberLoadingKey(memberId, scope);
  }

  viewMemberCharacter(member: CampaignMember, scope: 'proposed' | 'approved'): void {
    const key = this.memberLoadingKey(member.id, scope);
    if (this.memberCharacterLoadingId() === key) return;
    const campaignId = this.campaign()?.id;
    if (!campaignId) return;
    this.memberCharacterLoadingId.set(key);
    this.error.set(null);
    this.loadMemberCharacter(member, scope).subscribe({
      next: (character) => {
        this.handoff.setCurrent(character, {
          mode: 'consult',
          sourceLabel:
            scope === 'proposed'
              ? `Proposition de ${member.displayName}`
              : 'Personnage de campagne',
          returnUrl: `/campaigns/${campaignId}?tab=players`,
          proposalReview:
            scope === 'proposed'
              ? {
                  campaignId,
                  memberId: member.id,
                  memberDisplayName: member.displayName,
                }
              : undefined,
        });
        this.memberCharacterLoadingId.set(null);
        this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.memberCharacterLoadingId.set(null);
        this.error.set('Impossible d\'ouvrir la fiche.');
      },
    });
  }

  printMemberFullSheet(member: CampaignMember, scope: 'proposed' | 'approved' = 'approved'): void {
    const key = this.memberLoadingKey(member.id, scope);
    if (this.memberCharacterLoadingId() === key) return;
    this.memberCharacterLoadingId.set(key);
    this.error.set(null);
    this.loadMemberCharacter(member, scope).subscribe({
      next: (character) => {
        void getCampaignPdfService(this.injector).then((pdf) =>
          pdf.downloadPlayerFullSheet(character).finally(() => {
            this.memberCharacterLoadingId.set(null);
          }),
        );
      },
      error: () => {
        this.memberCharacterLoadingId.set(null);
        this.error.set('Impossible de générer la fiche PDF.');
      },
    });
  }

  private loadMemberCharacter(
    member: CampaignMember,
    scope: 'proposed' | 'approved',
  ): Observable<Character> {
    const c = this.campaign();
    if (!c) return throwError(() => new Error('Campagne introuvable'));

    return this.campaigns.getMemberCharacter(c.id, member.id, scope).pipe(
      map((res) => {
        const character = { ...(res.data as object) } as Character;
        if (res.name) character.name = res.name;
        return character;
      }),
    );
  }

  isMyPlayerMember(): CampaignMember | undefined {
    return this.myPlayerMember();
  }

  editScenario(): void {
    if (!this.campaign()?.isOwner) return;
    this.flushSoftPersistTimer();
    this.dungeonMapsComp()?.flushPendingSave();
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.storyBuilder.loadCampaignIntoBuilder(c, 'full');
    this.router.navigate(['/story/create']);
  }

  addCreaturesOnly(): void {
    if (!this.campaign()?.isOwner) return;
    this.flushSoftPersistTimer();
    this.dungeonMapsComp()?.flushPendingSave();
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.storyBuilder.loadCampaignIntoBuilder(c, 'creatures-only');
    this.router.navigate(['/story/create']);
  }

  creatureTrackKey(cr: StoryCreatureSelection): string {
    return `${cr.creatureId}::${cr.customName || cr.creatureName}`;
  }

  openCampaignBestiaryBook(index = 0): void {
    const c = this.campaign();
    if (!c) return;
    void this.router.navigate(['/campaigns', c.id, 'bestiary'], {
      queryParams: { i: index },
    });
  }

  openCreatureInBook(cr: StoryCreatureSelection): void {
    const c = this.campaign();
    if (!c) return;
    const index = (c.data.creatures ?? []).findIndex(
      (entry) =>
        entry.creatureId === cr.creatureId && entry.customName === cr.customName,
    );
    this.openCampaignBestiaryBook(index >= 0 ? index : 0);
  }

  updateCreatureRole(cr: StoryCreatureSelection, role: CreatureRole): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const creatures = (c.data.creatures ?? []).map((entry) =>
      entry.creatureId === cr.creatureId && entry.customName === cr.customName
        ? { ...entry, role }
        : entry,
    );
    this.saveData({ creatures });
  }

  updateCreatureCardField(
    cr: StoryCreatureSelection,
    field: 'voice' | 'desire' | 'fear' | 'secret' | 'noteStats',
    value: string,
  ): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const trimmed = value.trim();
    const creatures = (c.data.creatures ?? []).map((entry) =>
      entry.creatureId === cr.creatureId && entry.customName === cr.customName
        ? { ...entry, [field]: trimmed || undefined }
        : entry,
    );
    this.saveData({ creatures });
  }

  onCreatureCardField(event: CreatureCardFieldEvent): void {
    this.updateCreatureCardField(event.creature, event.field, event.value);
  }

  onPregenPatch(event: PregenPatchEvent): void {
    this.updatePregen(event.pregenId, event.patch);
  }

  dungeonMapOptions(): { id: string; name: string }[] {
    return (this.campaign()?.data.dungeonMaps ?? []).map((m) => ({ id: m.id, name: m.name }));
  }

  bulkClassifyUnsorted(role: 'ally' | 'antagonist'): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const unsorted = this.otherCreatures();
    if (!unsorted.length) return;
    const label = role === 'ally' ? 'alliés' : 'adversaires';
    this.askConfirm(
      'Classer les créatures',
      `Classer ${unsorted.length} créature(s) non classée(s) en ${label} ?`,
      () => {
        const keys = new Set(unsorted.map((cr) => this.creatureTrackKey(cr)));
        const creatures = (c.data.creatures ?? []).map((entry) =>
          keys.has(this.creatureTrackKey(entry)) ? { ...entry, role } : entry,
        );
        this.saveData({ creatures });
      },
      'Classer',
      false,
    );
  }

  onNotebookPageChange(page: NotebookPage): void {
    this.activeNotebookPageId.set(page.id);
  }

  onNotebookPagesChange(pages: NotebookPage[]): void {
    const capped = pages.slice(0, NOTEBOOK_MAX_PAGES);
    const firstText = capped.find((p) => p.text?.trim())?.text?.trim() ?? '';
    this.saveData({
      notebookPages: capped,
      notes: firstText || this.campaign()?.data.notes || '',
    });
  }

  private ensureNotebookPages(): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    if (c.data.notebookPages?.length) {
      if (!this.activeNotebookPageId()) {
        this.activeNotebookPageId.set(c.data.notebookPages[0]!.id);
      }
      return;
    }
    const seeded = seedNotebookFromLegacyNotes(c.data.notes);
    const pages = seeded.length ? seeded : [this.draftNotebookPage()];
    this.activeNotebookPageId.set(pages[0]!.id);
    this.saveData({ notebookPages: pages });
  }

  async generateAutoPregen(): Promise<void> {
    const c = this.campaign();
    if (!c?.isOwner || this.generatingAutoPregen()) return;
    if (!this.canAddPregen()) {
      this.pregenFeedback.set(this.pregenCapMessage());
      return;
    }
    if (this.aiProgress.active()) {
      this.pregenFeedback.set(this.aiProgress.busyMessage());
      return;
    }

    this.generatingAutoPregen.set(true);
    this.pregenFeedback.set(null);
    const campaignId = c.id;
    try {
      const generated = await this.pregenGenerator.generateOriginalPlayable(c, true);
      const latest = this.campaign();
      if (!latest || latest.id !== campaignId) return;
      const entry = createCampaignPregenEntry(
        generated.characterId,
        generated.characterName,
        generated.speciesLabel,
        generated.classLabel,
      );
      entry.publicHook = generated.publicHook;
      entry.dmBackstory = generated.dmBackstory;
      entry.status = 'ready';
      this.saveData({
        pregenCharacters: [...(latest.data.pregenCharacters ?? []), entry],
      });
    } catch (err) {
      if (isAiGenerationAborted(err)) return;
      this.pregenFeedback.set('Génération impossible. Réessayez dans quelques instants.');
    } finally {
      this.generatingAutoPregen.set(false);
    }
  }

  async importPregenFromCharacter(characterId: string): Promise<void> {
    const c = this.campaign();
    if (!c?.isOwner || this.importingPregen()) return;
    if (!this.canAddPregen()) {
      this.pregenFeedback.set(this.pregenCapMessage());
      return;
    }
    this.importingPregen.set(true);
    this.pregenFeedback.set(null);
    try {
      const generated = await this.pregenGenerator.generatePlayableDuplicate(c, characterId, false);
      const entry = createCampaignPregenEntry(
        generated.characterId,
        generated.characterName,
        generated.speciesLabel,
        generated.classLabel,
      );
      entry.publicHook = generated.publicHook;
      entry.dmBackstory = generated.dmBackstory;
      entry.status = 'ready';
      this.saveData({
        pregenCharacters: [...(c.data.pregenCharacters ?? []), entry],
      });
    } catch {
      this.pregenFeedback.set('Impossible d’importer ce personnage.');
    } finally {
      this.importingPregen.set(false);
    }
  }

  /**
   * Attache un héros déjà créé (forge « intent=pregen ») au pool sans le re-cloner.
   * Utile pour préparer la table avant l’arrivée des joueurs.
   */
  async attachCharacterAsPregen(characterId: string): Promise<void> {
    const c = this.campaign();
    if (!c?.isOwner || !characterId || this.importingPregen()) return;

    const existing = (c.data.pregenCharacters ?? []).some((p) => p.characterId === characterId);
    if (existing) {
      this.setTab('pregens');
      this.pregenFeedback.set('Ce héros est déjà dans le pool de pré-tirés.');
      return;
    }
    if (!this.canAddPregen()) {
      this.setTab('pregens');
      this.pregenFeedback.set(this.pregenCapMessage());
      return;
    }

    this.importingPregen.set(true);
    this.pregenFeedback.set(null);
    try {
      const res = await firstValueFrom(this.characters.get(characterId));
      const ch = { ...(res.data as Character), id: characterId, isPregenPool: true };
      await firstValueFrom(this.characters.save(ch, { updateExisting: true }));
      const speciesLabel = ch.species?.subspeciesLabel
        ? `${ch.species.label} (${ch.species.subspeciesLabel})`
        : (ch.species?.label ?? '—');
      const classLabel = (ch.classes ?? []).map((cl) => cl.classLabel).join(' / ') || '—';
      const entry = createCampaignPregenEntry(ch.id, ch.name || 'Héros', speciesLabel, classLabel);
      const story = ch.personality?.story?.trim() ?? '';
      entry.publicHook = story.split(/[.!?]/)[0]?.trim() || story.slice(0, 140);
      entry.dmBackstory = story;
      entry.status = 'ready';
      this.saveData({
        pregenCharacters: [...(c.data.pregenCharacters ?? []), entry],
      });
      this.setTab('pregens');
      this.pregenFeedback.set(`${ch.name} ajouté aux pré-tirés — prêt pour la table.`);
    } catch {
      this.pregenFeedback.set('Impossible d’ajouter ce personnage aux pré-tirés.');
      this.setTab('pregens');
    } finally {
      this.importingPregen.set(false);
    }
  }

  /** Plafond pool = 10 + nombre de joueurs. */
  canAddPregen(): boolean {
    const c = this.campaign();
    if (!c) return false;
    const count = c.data.pregenCharacters?.length ?? 0;
    return count < maxCampaignPregens(this.players().length);
  }

  pregenCapMessage(): string {
    const cap = maxCampaignPregens(this.players().length);
    return `Plafond atteint : ${cap} pré-tirés max (10 + ${this.players().length} joueur(s)).`;
  }

  pregenCapLabel(): string {
    const c = this.campaign();
    const count = c?.data.pregenCharacters?.length ?? 0;
    const cap = maxCampaignPregens(this.players().length);
    return `${count} / ${cap}`;
  }

  updatePregen(pregenId: string, patch: Partial<CampaignPregen>): void {
    const c = this.campaign();
    if (!c) return;
    const pregens = (c.data.pregenCharacters ?? []).map((p) =>
      p.id === pregenId ? { ...p, ...patch } : p,
    );
    this.saveData({ pregenCharacters: pregens });
  }

  markPregenReady(pregenId: string): void {
    this.updatePregen(pregenId, { status: 'ready' });
  }

  removePregen(pregenId: string): void {
    const c = this.campaign();
    if (!c) return;
    const removed = (c.data.pregenCharacters ?? []).find((p) => p.id === pregenId);
    const name = removed?.characterName ?? 'ce pré-tiré';
    this.askConfirm(
      'Supprimer le pré-tiré',
      `Supprimer « ${name} » de la campagne ?`,
      () => {
        const previous = [...(c.data.pregenCharacters ?? [])];
        this.saveData({
          pregenCharacters: previous.filter((p) => p.id !== pregenId),
        });
        this.pregenFeedback.set(`« ${name} » retiré — Annuler dans les 10 s.`);
        if (this.pregenUndoTimer) clearTimeout(this.pregenUndoTimer);
        this.pregenUndo = () => {
          this.saveData({ pregenCharacters: previous });
          this.pregenFeedback.set('Pré-tiré restauré.');
          this.pregenUndo = null;
          this.pregenUndoAvailable.set(false);
        };
        this.pregenUndoAvailable.set(true);
        this.pregenUndoTimer = setTimeout(() => {
          this.pregenUndo = null;
          this.pregenUndoAvailable.set(false);
          this.pregenFeedback.set(null);
          this.pregenUndoTimer = null;
        }, 10_000);
      },
    );
  }

  runPregenUndo(): void {
    this.pregenUndo?.();
    this.pregenUndoAvailable.set(false);
    if (this.pregenUndoTimer) {
      clearTimeout(this.pregenUndoTimer);
      this.pregenUndoTimer = null;
    }
  }

  assignPregen(pregen: CampaignPregen, member: CampaignMember): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.campaigns.assignPregen(c.id, pregen.id, member.userId, member.displayName).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Assignation impossible.'),
    });
  }

  claimPregen(pregenId: string): void {
    const c = this.campaign();
    if (!c) return;
    this.pregenFeedback.set(null);
    this.campaigns.claimPregen(c.id, pregenId).subscribe({
      next: () => {
        this.pregenFeedback.set('Copie ajoutée dans Mes héros (la table n’a pas changé).');
        this.reload();
      },
      error: () => this.pregenFeedback.set('Impossible de copier ce personnage dans Mes héros.'),
    });
  }

  usePregenAtTable(pregenId: string): void {
    const c = this.campaign();
    if (!c) return;
    this.pregenFeedback.set(null);
    this.campaigns.usePregenAtTable(c.id, pregenId).subscribe({
      next: () => {
        this.pregenFeedback.set('Pré-tiré lié à la table — sans copie dans Mes héros.');
        this.reload();
      },
      error: () => this.pregenFeedback.set('Impossible d’utiliser ce pré-tiré à la table.'),
    });
  }

  printPregenHandout(pregen: CampaignPregen): void {
    const c = this.campaign();
    if (!c) return;
    const meta = [pregen.speciesLabel, pregen.classLabel].filter(Boolean).join(' · ');
    void getCampaignPdfService(this.injector).then((pdf) =>
      pdf.downloadPregenHandout(c.title, pregen.characterName, pregen.publicHook, meta),
    );
  }

  printPregenFullSheet(pregen: CampaignPregen): void {
    if (this.pregenPdfLoadingId()) return;
    this.pregenPdfLoadingId.set(pregen.id);
    this.pregenFeedback.set(null);
    this.loadPregenCharacter(pregen).subscribe({
      next: (character) => {
        void getCampaignPdfService(this.injector).then((pdf) =>
          pdf.downloadPlayerFullSheet(character).finally(() => {
            this.pregenPdfLoadingId.set(null);
          }),
        );
      },
      error: () => {
        this.pregenPdfLoadingId.set(null);
        this.pregenFeedback.set('Impossible de générer la fiche PDF.');
      },
    });
  }

  viewPregenCharacter(pregen: CampaignPregen): void {
    const campaignId = this.campaign()?.id;
    if (!campaignId) return;
    this.pregenPdfLoadingId.set(pregen.id);
    this.pregenFeedback.set(null);
    this.loadPregenCharacter(pregen).subscribe({
      next: (character) => {
        this.handoff.setCurrent(character, {
          mode: 'consult',
          sourceLabel: 'Pré-tiré de campagne',
          returnUrl: `/campaigns/${campaignId}?tab=pregens`,
        });
        this.pregenPdfLoadingId.set(null);
        this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.pregenPdfLoadingId.set(null);
        this.pregenFeedback.set('Impossible d’ouvrir la fiche.');
      },
    });
  }

  private loadPregenCharacter(pregen: CampaignPregen): Observable<Character> {
    const c = this.campaign();
    if (!c) return throwError(() => new Error('Campagne introuvable'));

    const mapResponse = (res: { data: unknown; name?: string }) => {
      const character = { ...(res.data as object) } as Character;
      if (res.name) character.name = res.name;
      return character;
    };

    if (c.isOwner) {
      return this.characters.get(pregen.characterId).pipe(map((res) => mapResponse(res)));
    }

    return this.campaigns.getPregenCharacter(c.id, pregen.id).pipe(map((res) => mapResponse(res)));
  }

  myAssignedPregens(): CampaignPregen[] {
    const userId = this.auth.user()?.id;
    if (!userId) return [];
    return (this.campaign()?.data.pregenCharacters ?? []).filter(
      (p) => p.assignedUserId === userId && (p.status === 'assigned' || p.status === 'claimed'),
    );
  }

  /** Pré-tirés prêts à consulter / prendre à la table (vue joueur). */
  readyPregensForPlayers(): CampaignPregen[] {
    const c = this.campaign();
    if (!c || c.isOwner) return [];
    const me = c.members.find((m) => m.userId === this.auth.user()?.id);
    // Une seule voie : fiche proposée / approuvée XOR claim pré-tiré.
    if (
      me &&
      (me.proposalStatus === 'pending' ||
        me.proposalStatus === 'approved' ||
        me.approvedCharacterId ||
        me.proposedCharacterId)
    ) {
      return [];
    }
    return (c.data.pregenCharacters ?? []).filter((p) => p.status === 'ready');
  }

  printBestiary(): void {
    this.runPrint(async (entries) => {
      const c = this.campaign()!;
      const pdf = await getCampaignPdfService(this.injector);
      await pdf.downloadCreaturesCompilation(entries, c.title, c.data);
    });
  }

  printPackMj(): void {
    const c = this.campaign();
    if (!c) return;
    this.printing.set(true);
    this.error.set(null);
    this.loadCreatureEntries(c.data).subscribe({
      next: (entries) => {
        void (async () => {
          try {
            const summaries = await this.loadPlayerSummaries();
            const pdf = await getCampaignPdfService(this.injector);
            await pdf.downloadCampaignPack(c.title, c.data, entries, summaries);
          } catch {
            this.error.set('Échec de la génération PDF.');
          } finally {
            this.printing.set(false);
          }
        })();
      },
      error: () => {
        this.error.set('Impossible de charger les fiches créatures.');
        this.printing.set(false);
      },
    });
  }

  printPlayerSummariesPdf(): void {
    void this.runPrintPlayerSummariesOnly();
  }

  printAllPlayerSheets(): void {
    void this.runPrintPlayerFullSheets();
  }

  private runPrint(action: (entries: CreaturePrintEntry[]) => Promise<void>): void {
    const c = this.campaign();
    if (!c?.data.creatures.length) {
      this.error.set('Aucune créature à imprimer.');
      return;
    }
    this.printing.set(true);
    this.error.set(null);
    this.loadCreatureEntries(c.data).subscribe({
      next: (entries) => {
        action(entries)
          .catch(() => this.error.set('Échec de la génération PDF.'))
          .finally(() => this.printing.set(false));
      },
      error: () => {
        this.error.set('Impossible de charger les fiches créatures.');
        this.printing.set(false);
      },
    });
  }

  private loadCreatureEntries(data: CampaignData): Observable<CreaturePrintEntry[]> {
    const selections = data.creatures;
    if (!selections.length) return of([]);
    return forkJoin(
      selections.map((s) =>
        this.data.getCreatureById(s.creatureId).pipe(
          catchError(() => of(null)),
          map(
            (creature): CreaturePrintEntry | null =>
              creature
                ? {
                    creature,
                    customName: s.customName,
                    role: s.role,
                    backstory: s.backstory,
                  }
                : null,
          ),
        ),
      ),
    ).pipe(map((list) => list.filter((x): x is CreaturePrintEntry => x !== null)));
  }

  private async loadPlayerSummaries(): Promise<PlayerGmSummary[]> {
    const c = this.campaign();
    if (!c) return [];
    const approved = this.approvedPlayersWithCharacter();
    const pdf = await getCampaignPdfService(this.injector);
    const summaries = await Promise.all(
      approved.map(
        (p) =>
          new Promise<PlayerGmSummary | null>((resolve) => {
            this.campaigns.getMemberCharacter(c.id, p.id, 'approved').subscribe({
              next: (res) => resolve(pdf.buildPlayerGmSummary(res.data as Character)),
              error: () => resolve(null),
            });
          }),
      ),
    );
    return summaries.filter((s): s is PlayerGmSummary => s !== null);
  }

  private async runPrintPlayerSummariesOnly(): Promise<void> {
    this.printing.set(true);
    try {
      const summaries = await this.loadPlayerSummaries();
      if (!summaries.length) {
        this.error.set('Aucun joueur avec personnage approuvé.');
        return;
      }
      const pdf = await getCampaignPdfService(this.injector);
      await pdf.downloadPlayerSummaries(this.campaign()?.title ?? 'Campagne', summaries);
    } catch {
      this.error.set('Échec de la génération PDF.');
    } finally {
      this.printing.set(false);
    }
  }

  private async runPrintPlayerFullSheets(): Promise<void> {
    const c = this.campaign();
    if (!c) return;
    const approved = this.approvedPlayersWithCharacter();
    if (!approved.length) {
      this.error.set('Aucun joueur avec personnage approuvé.');
      return;
    }
    this.printing.set(true);
    try {
      const pdf = await getCampaignPdfService(this.injector);
      for (const p of approved) {
        await new Promise<void>((resolve, reject) => {
          this.campaigns.getMemberCharacter(c.id, p.id, 'approved').subscribe({
            next: async (res) => {
              try {
                const character = { ...(res.data as object), name: res.name } as Character;
                await pdf.downloadPlayerFullSheet(character);
                resolve();
              } catch {
                reject();
              }
            },
            error: () => reject(),
          });
        });
      }
    } catch {
      this.error.set('Échec lors de la génération des fiches joueurs.');
    } finally {
      this.printing.set(false);
    }
  }
}
