import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { FriendsService } from '@core/services/friends.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { NotificationService } from '@core/services/notification.service';
import { DataService } from '@core/services/data.service';
import { forkJoin, catchError, map, of, Observable, throwError, firstValueFrom } from 'rxjs';
import { getCampaignPdfService } from '@core/services/campaign-pdf.loader';
import type { CreaturePrintEntry, PlayerGmSummary } from '@core/services/campaign-pdf.types';
import { ProfileAvatarComponent } from '@shared/components/profile-avatar/profile-avatar';
import { Character } from '@core/models/Character/character';
import {
  CampaignData,
  CampaignHandout,
  HandoutKind,
  CampaignMember,
  CampaignPregen,
  CampaignSession,
  CREATURE_ROLE_LABELS,
  PREGEN_STATUS_LABELS,
  createCampaignPregenEntry,
  createCampaignHandout,
  createEncounterFromCreatures,
  encounterPendingXp,
  encounterTotalXp,
  EncounterGroup,
  FriendUser,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';
import { ADVENTURE_TONE_LABELS } from '@core/models/Story/story';
import { formatChallengeRating, getCreatureCategoryLabel } from '@core/utils/creature-display.util';
import { shouldShowPlayerInitiativePrompt } from '@core/utils/campaign-initiative.util';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { CampaignPregenGeneratorService } from '@core/services/campaign-pregen-generator.service';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';
import { AiGenerationProgressBar } from '@shared/components/ai-generation-progress-bar/ai-generation-progress-bar';
import { CampaignDungeonMaps } from '../campaign-dungeon-maps/campaign-dungeon-maps';
import { CampaignDetailStats } from './campaign-detail-stats/campaign-detail-stats';
import { CampaignDetailRoster } from './campaign-detail-roster/campaign-detail-roster';
import { CampaignDetailSessions } from './campaign-detail-sessions/campaign-detail-sessions';
import { CampaignDetailActivity } from './campaign-detail-activity/campaign-detail-activity';
import { CampaignDetailHandouts } from './campaign-detail-handouts/campaign-detail-handouts';
import type { MemberCharacterAction } from './campaign-detail-roster/campaign-detail-roster';
import type { SessionDateChangeEvent, SessionPatchEvent } from './campaign-detail-sessions/campaign-detail-sessions';
import type { HandoutPatchEvent, HandoutPublishEvent } from './campaign-detail-handouts/campaign-detail-handouts';
import { handoutIdFromActivity } from './campaign-activity.util';
import { CampaignSessionCacheService } from '@core/services/campaign-session-cache.service';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { CampaignInitiativeInline } from '../campaign-initiative-inline/campaign-initiative-inline';
import { CampaignPlayerSheet } from '../campaign-player-sheet/campaign-player-sheet';
import { LightMarkdownPipe } from '@shared/pipes/light-markdown.pipe';

type Tab = 'overview' | 'creatures' | 'encounters' | 'players' | 'pregens' | 'activity' | 'handouts' | 'maps';
type TabDef = { id: Tab; label: string; icon: string };

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ProfileAvatarComponent,
    CampaignDungeonMaps,
    CampaignDetailStats,
    CampaignDetailRoster,
    CampaignDetailSessions,
    CampaignDetailActivity,
    CampaignDetailHandouts,
    AiGenerationProgressBar,
    CampaignInitiativeInline,
    CampaignPlayerSheet,
    LightMarkdownPipe,
  ],
  templateUrl: './campaign-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private campaigns = inject(CampaignCloudService);
  private friends = inject(FriendsService);
  private characters = inject(CharacterCloudService);
  private auth = inject(AuthService);
  private notifications = inject(NotificationService);
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
  readonly tab = signal<Tab>('overview');
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
  /** Amis déjà invités (en attente d’acceptation) — masqués de la liste invitable. */
  readonly pendingInviteUserIds = signal<Set<string>>(new Set());
  readonly activity = signal<CampaignActivityItem[]>([]);
  readonly activityLoading = signal(false);
  /** Session en mode édition (MJ) — sinon carte lecture. */
  readonly editingSessionId = signal<string | null>(null);

  /** Handout en mode édition (MJ). */
  readonly editingHandoutId = signal<string | null>(null);
  readonly previewHandoutId = signal<string | null>(null);
  readonly focusHandoutId = signal<string | null>(null);
  readonly focusDungeonMapId = signal<string | null>(null);
  readonly handoutKindFilter = signal<HandoutKind | 'all'>('all');
  readonly initiativeBoard = signal<InitiativeBoard | null>(null);
  readonly rosterSheetOpen = signal(false);
  readonly pinnedOverlayDismissed = signal(false);

  private initiativePollTimer: ReturnType<typeof setInterval> | null = null;
  private softPollTimer: ReturnType<typeof setInterval> | null = null;

  readonly creatureXpMap = signal<Record<string, number>>({});
  readonly isLoadingPreview = signal(false);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
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
      const live = this.sessionDock.liveCampaign();
      const cur = this.campaign();
      if (!live || !cur || live.id !== cur.id || live === cur) return;
      untracked(() => this.campaign.set(live));
    });
  }

  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly players = computed(() =>
    (this.campaign()?.members ?? []).filter((m) => m.role === 'player'),
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
      .filter((s) => s.status === 'played')
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

  readonly visibleTabs = computed((): TabDef[] => {
    const owner = this.campaign()?.isOwner === true;
    const tabs: TabDef[] = [
      { id: 'overview', label: 'Résumé', icon: 'fluent-emoji:clipboard' },
      { id: 'activity', label: 'Activité', icon: 'fluent-emoji:bell' },
      { id: 'handouts', label: 'Documents', icon: 'fluent-emoji:page-facing-up' },
    ];
    if (owner) {
      tabs.push({ id: 'creatures', label: 'Créatures', icon: 'fluent-emoji:dragon' });
      tabs.push({ id: 'maps', label: 'Donjons', icon: 'fluent-emoji:world-map' });
    }
    tabs.push({ id: 'pregens', label: 'Pré-tirés', icon: 'fluent-emoji:performing-arts' });
    if (owner) {
      tabs.push({ id: 'encounters', label: 'Rencontres', icon: 'fluent-emoji:crossed-swords' });
    }
    tabs.push({ id: 'players', label: 'Joueurs', icon: 'fluent-emoji:busts-in-silhouette' });
    return tabs;
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

  readonly showMobileSessionBar = computed(
    () => !!this.activePlaySession() || this.tab() === 'handouts' || this.tab() === 'activity',
  );

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
  protected formatCr = formatChallengeRating;
  protected categoryLabel = getCreatureCategoryLabel;
  protected encounterTotalXp = encounterTotalXp;
  protected encounterPendingXp = encounterPendingXp;

  startPlaySession(sessionId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.flushSoftPersistTimer();
    this.flushSessionSave();
    this.dungeonMapsComp()?.flushPendingSave();
    const data = { ...this.campaign()!.data, activeSessionId: sessionId };
    this.campaign.update((prev) => (prev ? { ...prev, data } : prev));
    this.persist(c.title, data, () => {
      this.sessionDock.bindCampaign(this.campaign());
      this.sessionDock.open();
    });
  }

  openSessionDock(): void {
    this.sessionDock.bindCampaign(this.campaign());
    this.sessionDock.open();
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

    this.softPollTimer = setInterval(() => this.softReload(), 12_000);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onWindowFocus);
    }

    const tab = this.route.snapshot.queryParamMap.get('tab');
    const handoutId = this.route.snapshot.queryParamMap.get('handout');
    if (tab === 'handouts' || tab === 'players' || tab === 'activity' || tab === 'overview' || tab === 'maps') {
      this.tab.set(tab);
      if (tab === 'handouts' && handoutId) this.focusHandoutId.set(handoutId);
    }
  }

  ngOnDestroy(): void {
    this.flushSoftPersistTimer();
    this.flushSessionSave();
    this.flushHandoutSave();
    this.dungeonMapsComp()?.flushPendingSave();
    this.stopInitiativeBannerPoll();
    if (this.softPollTimer) clearInterval(this.softPollTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
    }
    this.revokePreviewUrl();
  }

  private readonly onWindowFocus = (): void => {
    if (this.auth.isLoggedIn()) this.softReload();
  };

  /** Recharge sans spinner (invitations acceptées, propositions, etc.). */
  private softReload(): void {
    const campaignId = this.campaign()?.id;
    if (!campaignId || this.loading() || this.saving()) return;
    this.campaigns.get(campaignId).subscribe({
      next: (c) => {
        const current = this.campaign();
        if (!current || current.id !== c.id) {
          this.campaign.set(c);
        } else {
          // Ne pas écraser data locale (notes / combat) — maj roster + titre seulement.
          this.campaign.set({
            ...current,
            title: c.title,
            members: c.members,
            updatedAt: c.updatedAt,
            isOwner: c.isOwner,
            role: c.role,
          });
        }
        const memberIds = new Set(c.members.filter((m) => m.role === 'player').map((m) => m.userId));
        this.pendingInviteUserIds.update((prev) => {
          const next = new Set([...prev].filter((id) => !memberIds.has(id)));
          return next.size === prev.size ? prev : next;
        });
      },
      error: () => {
        /* ignore soft poll */
      },
    });
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
        const t = this.tab();
        if (!c.isOwner && (t === 'creatures' || t === 'encounters')) {
          this.tab.set('overview');
        }
        if (!c.isOwner) {
          this.startInitiativeBannerPoll(c.id);
        } else {
          this.stopInitiativeBannerPoll();
          this.initiativeBoard.set(null);
        }
      },
      error: () => {
        this.error.set('Campagne introuvable.');
        this.loading.set(false);
      },
    });
  }

  setTab(t: Tab): void {
    if (!this.campaign()?.isOwner && (t === 'creatures' || t === 'encounters' || t === 'maps')) {
      this.tab.set('overview');
      return;
    }
    if (this.tab() === 'maps' && t !== 'maps') {
      this.dungeonMapsComp()?.flushPendingSave();
    }
    this.tab.set(t);
    if (t === 'handouts' && this.campaign()?.isOwner) {
      if (this.pdfPreviewKind() === 'bestiary' && this.campaign()!.data.creatures.length) {
        this.loadBestiaryPreview();
      } else {
        this.loadPackPreview();
      }
    }
    if (t === 'activity') {
      this.loadActivity();
    }
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
    this.initiativePollTimer = setInterval(refresh, 8000);
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
    this.setTab('activity');
  }

  openOverviewTab(): void {
    this.setTab('overview');
  }

  toggleRosterSheet(): void {
    this.rosterSheetOpen.update((v) => !v);
  }

  deleteHandout(handoutId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    if (!confirm('Supprimer ce document ?')) return;
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
      title: 'Nouvelle session',
      scheduledAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'planned',
      mode: 'online',
    };
    this.editingSessionId.set(session.id);
    this.saveData({ sessions: [...(c.data.sessions ?? []), session] });
  }

  startEditSession(sessionId: string): void {
    this.flushSessionSave();
    this.editingSessionId.set(sessionId);
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
    if (!confirm('Supprimer cette session ?')) return;
    this.flushSessionSave();
    if (this.editingSessionId() === sessionId) this.editingSessionId.set(null);
    this.saveData({
      sessions: (c.data.sessions ?? []).filter((s) => s.id !== sessionId),
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
    if (this.rawBlobUrl) window.open(this.rawBlobUrl, '_blank');
  }

  private revokePreviewUrl(): void {
    if (this.rawBlobUrl) {
      URL.revokeObjectURL(this.rawBlobUrl);
      this.rawBlobUrl = null;
    }
    this.pdfPreviewUrl.set(null);
    this.previewCacheKey = null;
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
          this.rawBlobUrl = url;
          this.previewCacheKey = cacheKey;
          this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
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
          this.rawBlobUrl = url;
          this.previewCacheKey = cacheKey;
          this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
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
    if (!c) return;
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

    this.persistTail = this.persistTail
      .catch(() => undefined)
      .then(async () => {
        try {
          const summary = await firstValueFrom(this.campaigns.update(campaignId, title, data));
          this.campaign.update((prev) => {
            if (!prev || prev.id !== campaignId) return prev;
            // Ne jamais réappliquer le blob envoyé : l'état local est la source de vérité.
            return { ...prev, updatedAt: summary.updatedAt };
          });
          this.sessionCache.cache(campaignId, this.campaign()?.title ?? title, this.campaign()?.data ?? data);
          if (seq === this.persistSeq) this.saving.set(false);
          if (this.tab() === 'activity') this.loadActivity();
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
        if (this.tab() === 'activity') this.loadActivity();
      },
      error: (err) => {
        const msg = err?.error?.errors?.[0]?.reason ?? 'Invitation impossible.';
        this.error.set(msg);
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
        if (this.tab() === 'activity') this.loadActivity();
      },
      error: () => this.error.set('Impossible de proposer ce personnage.'),
    });
  }

  approveMember(member: CampaignMember): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.approveProposal(c.id, member.id).subscribe({
      next: () => {
        this.reload();
        this.notifications.refresh();
        if (this.tab() === 'activity') this.loadActivity();
      },
      error: () => this.error.set('Impossible d’approuver ce personnage.'),
    });
  }

  rejectMember(member: CampaignMember): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.rejectProposal(c.id, member.id).subscribe({
      next: () => {
        this.reload();
        this.notifications.refresh();
        if (this.tab() === 'activity') this.loadActivity();
      },
      error: () => this.error.set('Impossible de refuser ce personnage.'),
    });
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
        if (this.tab() === 'activity') this.loadActivity();
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
    if (!confirm(`Retirer ${member.displayName} de la campagne ?`)) return;
    this.campaigns.removeMember(c.id, member.id).subscribe({
      next: () => {
        this.error.set(null);
        this.reload();
        if (this.tab() === 'activity') this.loadActivity();
      },
      error: () => this.error.set('Impossible de retirer ce joueur.'),
    });
  }

  readonly leaving = signal(false);
  readonly showLeaveConfirm = signal(false);
  readonly leaveConfirmInput = signal('');

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

  memberLoadingKey(memberId: string, scope: 'proposed' | 'approved'): string {
    return `${memberId}-${scope}`;
  }

  isMemberCharacterLoading(memberId: string, scope: 'proposed' | 'approved'): boolean {
    return this.memberCharacterLoadingId() === this.memberLoadingKey(memberId, scope);
  }

  viewMemberCharacter(member: CampaignMember, scope: 'proposed' | 'approved'): void {
    const key = this.memberLoadingKey(member.id, scope);
    if (this.memberCharacterLoadingId() === key) return;
    this.memberCharacterLoadingId.set(key);
    this.error.set(null);
    this.loadMemberCharacter(member, scope).subscribe({
      next: (character) => {
        this.handoff.setCurrent(character);
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

  async generateAutoPregen(): Promise<void> {
    const c = this.campaign();
    if (!c?.isOwner || this.generatingAutoPregen()) return;

    this.generatingAutoPregen.set(true);
    this.error.set(null);
    try {
      const generated = await this.pregenGenerator.generateOriginalPlayable(c, true);
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
      this.error.set('Génération impossible. Réessayez dans quelques instants.');
    } finally {
      this.generatingAutoPregen.set(false);
    }
  }

  async importPregenFromCharacter(characterId: string): Promise<void> {
    const c = this.campaign();
    if (!c?.isOwner || this.importingPregen()) return;
    this.importingPregen.set(true);
    this.error.set(null);
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
      this.error.set('Impossible d\'importer ce personnage.');
    } finally {
      this.importingPregen.set(false);
    }
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
    this.saveData({
      pregenCharacters: (c.data.pregenCharacters ?? []).filter((p) => p.id !== pregenId),
    });
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
    this.campaigns.claimPregen(c.id, pregenId).subscribe({
      next: () => {
        this.error.set(null);
        this.reload();
        this.router.navigate(['/characters']);
      },
      error: () => this.error.set('Impossible de revendiquer ce personnage.'),
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
    this.error.set(null);
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
        this.error.set('Impossible de générer la fiche PDF.');
      },
    });
  }

  viewPregenCharacter(pregen: CampaignPregen): void {
    this.pregenPdfLoadingId.set(pregen.id);
    this.error.set(null);
    this.loadPregenCharacter(pregen).subscribe({
      next: (character) => {
        this.handoff.setCurrent(character);
        this.pregenPdfLoadingId.set(null);
        this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.pregenPdfLoadingId.set(null);
        this.error.set('Impossible d\'ouvrir la fiche.');
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
      (p) => p.assignedUserId === userId && p.status === 'assigned',
    );
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
