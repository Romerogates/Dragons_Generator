import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of, firstValueFrom, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import type { InitiativeBoard } from '@core/services/campaign-cloud.service';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { AuthService } from '@core/services/auth.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { DataService } from '@core/services/data.service';
import type { Character } from '@core/models/Character/character';
import type { Creature } from '@core/models/Creatures/creature';
import type { CreatureSummary } from '@core/models/Creatures/creature-summary';
import { CREATURE_ROLE_LABELS, type CreatureRole, type StoryCreatureSelection } from '@core/models/Story/story';
import {
  ActiveCombat,
  CampaignData,
  CampaignHandout,
  CampaignMember,
  CampaignSession,
  CampaignSessionMode,
  CampaignSessionStatus,
  Combatant,
  CombatantAttack,
  encounterPendingXp,
  encounterTotalXp,
  EncounterGroup,
  HANDOUT_KIND_LABELS,
  SessionTimelineItem,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { NotificationService } from '@core/services/notification.service';
import {
  COMBATANT_KIND_LABELS,
  advanceTurn,
  canAdvanceFromSetup,
  canOpenFightPhase,
  canReorderCombatantInTurnOrder,
  combatantInitiativeTotal,
  createActiveCombat,
  createCombatant,
  createCombatHistoryEntry,
  createInitiativeCode,
  currentTurnCombatant,
  duplicateCombatant,
  expandEncounterToCombatants,
  formatCombatArchiveSummary,
  freezeTurnOrderIds,
  isCombatantDefeated,
  moveCombatantToTurnIndex,
  reorderCombatantInTurnOrder,
  resolveCombatFlowPhase,
  sortedTurnOrder,
  syncEncountersFromCombatants,
  type CombatFlowPhase,
} from '@core/utils/combat-tracker.util';
import { combatantFromCreature } from '@core/utils/combat-creature-import.util';
import {
  appendCombatLog,
  applyHpDelta,
  formatCombatLogLine,
  isAllyCombatant,
  isEnemyCombatant,
  snapshotAttacksFromCharacter,
} from '@core/utils/combat-action.util';
import {
  resolveAttackRoll,
  resolveRollPolicy,
  rollDamageTotal,
  rollDie,
  type RollChoice,
} from '@core/utils/combat-roll.util';
import { mergeRemoteLiveTable, stripTableChatForPersist } from '@core/utils/campaign-persist.util';
import { softTablePulse } from '@core/utils/table-feedback.util';
import { applyTablePin, clearTablePinState } from '@core/utils/table-pin.util';
import {
  resolvePlayNextAction,
  type PlayNextAction,
} from '@core/utils/play-next-action.util';
import {
  normalizeSessionMode,
  sessionModeHint,
  sessionModeLabel,
} from '../campaign-detail/campaign-session.util';
import { CampaignSessionTimeline } from '../campaign-session-timeline/campaign-session-timeline';
import { CampaignSessionNotes } from '../campaign-session-notes/campaign-session-notes';
import { CampaignDungeonMaps } from '../campaign-dungeon-maps/campaign-dungeon-maps';
import { FullscreenEnterLink } from '@shared/components/fullscreen-enter-btn/fullscreen-enter-link';
import type { NotebookPage, SessionPlayPad } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import {
  appendTextToFirstNotePad,
  archivePlayPadsText,
  ensureSessionPlayPads,
  sessionPlayPadsPreview,
} from '@core/utils/notebook.util';
import { drawDungeonToCanvas, fogRevealSet } from '@core/utils/dungeon-render.util';
import {
  clampTokenToFloor,
  combatantsToTokens,
  findCombatantAtTile,
  isTileOccupied,
  pixelToTile,
} from '@core/utils/dungeon-battle.util';
import {
  isRoomRevealedOnMap,
  withAllRoomsRevealed,
  withFogToggled,
  withNoRoomsRevealed,
  withRoomRevealed,
} from '@core/utils/dungeon-fog.util';
import { buildPlayerRecapTemplate } from '@core/utils/player-recap-template.util';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';
import { PlayTableChat } from '../play-table-chat/play-table-chat';
import { PlayBattleMap } from '../play-battle-map/play-battle-map';
import { PlayCombatFlow } from '../play-combat-flow/play-combat-flow';

export type PlaySessionView =
  | 'resume'
  | 'notes'
  | 'combat'
  | 'encounters'
  | 'dungeon'
  | 'history';

@Component({
  selector: 'app-campaign-play-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CampaignSessionTimeline,
    CampaignSessionNotes,
    CampaignDungeonMaps,
    FullscreenEnterLink,
    PlayTableChat,
    PlayBattleMap,
    PlayCombatFlow,
  ],
  providers: [CampaignPlaySessionStore],
  templateUrl: './campaign-play-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignPlayPanel implements OnDestroy {
  private readonly campaigns = inject(CampaignCloudService);
  private readonly characters = inject(CharacterCloudService);
  private readonly notifications = inject(NotificationService);
  private readonly live = inject(CampaignLiveService);
  private readonly data = inject(DataService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly handoff = inject(CharacterHandoffService);
  private readonly playStore = inject(CampaignPlaySessionStore);
  private readonly sessionDock = inject(CampaignSessionDockService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly playTableChat = viewChild(PlayTableChat);
  private readonly playBattleMap = viewChild(PlayBattleMap);
  private storeSub: Subscription | null = null;

  /** Self-ref for `app-play-combat-flow` host binding (template). */
  asCombatHost(): CampaignPlayPanel {
    return this;
  }

  readonly campaign = input.required<CampaignDetailModel>();
  readonly fullscreen = input(false);
  readonly campaignChange = output<CampaignDetailModel>();

  /** Sync live SignalR (sinon poll de secours). */
  readonly liveConnected = this.live.connected;

  readonly saving = signal(false);
  readonly importingParty = signal(false);
  readonly feedback = signal<{
    kind: 'ok' | 'err';
    text: string;
    undo?: () => void;
  } | null>(null);
  /** Mode « Autre » : choix ponctuel dés / encode. */
  readonly rollChoice = signal<RollChoice>('dice');
  readonly selectedTargetId = signal<string | null>(null);
  readonly selectedAttackIndex = signal(0);
  readonly hpAdjustAmount = signal(5);
  readonly pendingInitCombatantId = signal<string | null>(null);

  /** Vues exclusives de la table (plein écran = onglets ; dock = résumé compact). */
  readonly sessionView = signal<PlaySessionView>('resume');
  readonly sessionTabs: { id: PlaySessionView; label: string; shortLabel: string }[] = [
    { id: 'resume', label: 'Résumé', shortLabel: 'Résumé' },
    { id: 'notes', label: 'Notes', shortLabel: 'Notes' },
    { id: 'combat', label: 'Combat', shortLabel: 'Combat' },
    { id: 'encounters', label: 'Rencontres', shortLabel: 'Renc.' },
    { id: 'dungeon', label: 'Donjon', shortLabel: 'Donjon' },
    { id: 'history', label: 'Historique', shortLabel: 'Hist.' },
  ];
  /** Sous-étapes du tour Pokémon. */
  readonly fightStep = signal<'menu' | 'pickAttack' | 'pickTarget' | 'toHit' | 'damage'>('menu');
  readonly pendingHitTotal = signal<number | null>(null);
  readonly pendingDamageDice = signal<string | null>(null);
  readonly advancedToolsOpen = signal(false);
  readonly dungeonPickerOpen = signal(false);
  readonly confirmDialog = signal<{
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  /** Dialogue Terminer : récap joueurs optionnel. */
  readonly endSessionDialog = signal<{ recap: string } | null>(null);
  /** Panneau secret MJ (PNJ / calepins) — coulissant. */
  readonly secretPanelOpen = signal(false);
  /** Mode zen : chrome minimal (onglets / dock secondaires repliés). */
  readonly zenMode = signal(readZenMode());
  /** Timer de scène (local, MJ) — secondes restantes. */
  readonly sceneTimerSeconds = signal<number | null>(null);
  readonly sceneTimerPaused = signal(false);
  readonly sceneTimerLabel = signal('Scène');
  /** Tick murale pour recalculer le timer depuis endsAtIso. */
  private readonly sceneTimerTick = signal(0);
  private sceneTimerHandle: ReturnType<typeof setInterval> | null = null;
  /** Drag ordre des tours (pointeur). */
  private turnOrderDrag: { combatantId: string; fromIndex: number } | null = null;

  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private initiativePollTimer: ReturnType<typeof setInterval> | null = null;
  private initiativeLiveSub: Subscription | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private persistSeq = 0;
  private persistTail: Promise<void> = Promise.resolve();
  private readonly onPageHide = (): void => this.flushPendingSessionWork();
  /** Ids déjà notifiés pendant la collecte d’init (toasts par jet). */
  private seenInitiativeSubmissions = new Set<string>();

  readonly isDm = computed(() => this.campaign().isOwner === true);
  readonly isSpectator = computed(() => this.campaign().role === 'spectator');

  readonly activeSession = computed(() => {
    const c = this.campaign();
    const id = c.data.activeSessionId;
    if (!id) return null;
    return (c.data.sessions ?? []).find((s) => s.id === id) ?? null;
  });

  readonly sessionMode = computed((): CampaignSessionMode =>
    normalizeSessionMode(this.activeSession()?.mode),
  );

  readonly rollMethod = computed(() =>
    resolveRollPolicy(this.sessionMode(), this.rollChoice()),
  );

  readonly activeCombat = computed(() => this.activeSession()?.activeCombat ?? null);

  /** Collecte d’init MJ : qui a envoyé / jet + bonus = total. */
  readonly initiativeCollectionRows = computed(() => {
    const combat = this.activeCombat();
    if (!combat) return [];
    return combat.combatants
      .filter((c) => c.kind === 'player')
      .map((c) => {
        const playerName = this.playerDisplayName(c);
        return {
          id: c.id,
          name: playerName || c.name || 'Joueur',
          submitted: !!c.playerSubmitted,
          roll: c.initiativeRoll ?? null,
          bonus: c.initiativeBonus ?? 0,
          total: combatantInitiativeTotal(c),
        };
      });
  });

  readonly combatFlowPhase = computed((): CombatFlowPhase | null => {
    const combat = this.activeCombat();
    return combat ? resolveCombatFlowPhase(combat) : null;
  });

  readonly canContinueToInitiative = computed(() => {
    const combat = this.activeCombat();
    return combat ? canAdvanceFromSetup(combat) : false;
  });

  readonly canEnterFight = computed(() => {
    const combat = this.activeCombat();
    return combat ? canOpenFightPhase(combat) : false;
  });

  readonly combatTurnOrder = computed(() => {
    const combat = this.activeCombat();
    return combat ? sortedTurnOrder(combat) : [];
  });

  /** Réordonner librement seulement une fois l’ordre figé (combat ouvert). */
  readonly canEditTurnOrder = computed(() => {
    const combat = this.activeCombat();
    return (
      this.isDm() &&
      this.combatFlowPhase() === 'fight' &&
      !!combat?.turnOrderIds?.length &&
      this.combatTurnOrder().length > 1
    );
  });

  /** PNJ campagne avec champs secret / voix / désir / peur. */
  readonly secretCreatureCards = computed(() => {
    const creatures = this.campaign().data.creatures ?? [];
    return creatures.filter(
      (cr) =>
        !!(
          cr.voice?.trim() ||
          cr.desire?.trim() ||
          cr.fear?.trim() ||
          cr.secret?.trim() ||
          cr.noteStats?.trim() ||
          cr.backstory?.trim()
        ),
    );
  });

  /** Une seule consigne claire (MJ + joueur). */
  readonly nextAction = computed((): PlayNextAction | null => {
    const combat = this.activeCombat();
    const phase = this.combatFlowPhase();
    const me = this.auth.user()?.id;
    return resolvePlayNextAction({
      isDm: this.isDm(),
      isSpectator: this.isSpectator(),
      hasActiveSession: !!this.activeSession(),
      heroStatus: this.myHeroProposalStatus(),
      tableReady: me ? this.isPlayerTableReady(me) : false,
      approvedPlayerCount: this.approvedPlayers().length,
      tableReadyCount: this.tableReadyCount(),
      combatPhase: phase,
      collectingInitiative: !!combat?.collectingInitiative,
      missingInitCount: this.combatMissingInitCount(),
      hasAlly: this.allyCombatants().length > 0,
      hasEnemy: this.enemyCombatants().length > 0,
      canOpenFight: this.canEnterFight(),
      isMyTurn: this.isMyTurn(),
      myCombatantInFight: !!this.myCombatant(),
      playerNeedsInit: (() => {
        const mine = this.myCombatant();
        if (!mine) return false;
        return combatantInitiativeTotal(mine) == null && !mine.playerSubmitted;
      })(),
      currentTurnName: this.currentTurn()?.name?.trim() || null,
      publishedHandoutCount: this.publishedHandouts().length,
    });
  });

  readonly continueInitiativeHint = computed(() => {
    if (this.canContinueToInitiative()) return null;
    const allies = this.allyCombatants().length;
    const enemies = this.enemyCombatants().length;
    if (!allies && !enemies) return 'Ajoutez au moins un allié et un adversaire.';
    if (!allies) return 'Il manque encore un allié (PJ ou PNJ).';
    if (!enemies) return 'Il manque encore un adversaire.';
    return 'Ajoutez au moins un allié et un adversaire.';
  });

  readonly openFightHint = computed(() => {
    if (this.canEnterFight()) return null;
    const n = this.combatMissingInitCount();
    if (n > 0) return `Encore ${n} combattant(s) sans initiative.`;
    return 'Tous les combattants actifs doivent avoir une initiative.';
  });

  readonly allyCombatants = computed(() =>
    this.combatTurnOrder().filter((c) => isAllyCombatant(c)),
  );

  readonly enemyCombatants = computed(() =>
    this.combatTurnOrder().filter((c) => isEnemyCombatant(c)),
  );

  readonly sessionCombatHistory = computed(() => {
    const session = this.activeSession();
    return [...(session?.combatHistory ?? [])].reverse();
  });

  readonly activeSessionMap = computed(() => {
    const mapId = this.activeSession()?.activeMapId;
    if (!mapId) return null;
    return (this.campaign().data.dungeonMaps ?? []).find((m) => m.id === mapId) ?? null;
  });

  readonly campaignDungeonMaps = computed(() => this.campaign().data.dungeonMaps ?? []);

  /** Carte visible pendant combat (ou toujours pour joueur si map attribuée). */
  readonly showBattleMap = computed(() => {
    if (!this.activeSessionMap()) return false;
    if (!this.isDm()) return true;
    return this.sessionView() === 'combat' || !!this.activeCombat();
  });

  readonly tableChatMessages = computed(() =>
    (this.activeSession()?.tableChat ?? []).slice(-40),
  );

  /** Board d’init embarqué (saisie joueur sur /play, sans quitter la table). */
  readonly playerInitBoard = computed((): InitiativeBoard | null => {
    const combat = this.activeCombat();
    if (!combat?.collectingInitiative || !combat.initiativeCode) return null;
    return {
      open: true,
      code: combat.initiativeCode,
      label: combat.label ?? null,
      combatants: combat.combatants.map((c) => ({
        id: c.id,
        name: c.name || 'Sans nom',
        kind: c.kind,
        initiativeBonus: c.initiativeBonus ?? 0,
        hasRoll: !!c.playerSubmitted,
        memberUserId: c.memberUserId ?? null,
      })),
    };
  });

  readonly combatLogLines = computed(() =>
    [...(this.activeSession()?.combatLog ?? [])].slice().reverse().slice(0, 12),
  );

  readonly currentTurn = computed(() => {
    const combat = this.activeCombat();
    return combat ? currentTurnCombatant(combat) : null;
  });

  /** Joueur : combattant lié à mon compte. */
  readonly myCombatant = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return null;
    return this.combatTurnOrder().find((c) => c.memberUserId === userId) ?? null;
  });

  readonly battleMapTokens = computed(() =>
    combatantsToTokens(this.combatTurnOrder(), {
      currentId: this.currentTurn()?.id ?? null,
      myId: this.myCombatant()?.id ?? null,
      selectedId: this.selectedTokenCombatantId(),
    }),
  );

  readonly isMyTurn = computed(() => {
    const turn = this.currentTurn();
    const mine = this.myCombatant();
    return !!turn && !!mine && turn.id === mine.id;
  });

  readonly canActOnTurn = computed(() => {
    if (this.isSpectator()) return false;
    if (this.isDm()) return !!this.currentTurn();
    return this.isMyTurn();
  });

  readonly selectedTarget = computed(() => {
    const id = this.selectedTargetId();
    if (!id) return null;
    return this.combatTurnOrder().find((c) => c.id === id) ?? null;
  });

  readonly currentTurnAttacks = computed((): CombatantAttack[] => {
    const turn = this.currentTurn();
    return turn?.attacks?.length ? turn.attacks : [];
  });

  readonly nextPlannedSession = computed(() => {
    const now = Date.now();
    const sessions = this.campaign().data.sessions ?? [];
    return (
      sessions
        .filter((s) => s.status === 'planned')
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .find((s) => new Date(s.scheduledAt).getTime() >= now)
      ?? sessions.find((s) => s.status === 'planned')
      ?? null
    );
  });

  readonly players = computed(() =>
    this.campaign().members.filter((m) => m.role === 'player'),
  );

  readonly approvedPlayers = computed(() =>
    this.players().filter((p) => p.proposalStatus === 'approved' && p.approvedCharacterId),
  );

  readonly tableReadyCount = computed(() => {
    const ready = new Set(this.activeSession()?.tableReadyUserIds ?? []);
    return this.approvedPlayers().filter((p) => ready.has(p.userId)).length;
  });

  /** Membre joueur courant (toute proposition). */
  readonly myPlayerMember = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return null;
    return this.players().find((p) => p.userId === userId) ?? null;
  });

  /** Membre joueur courant (si héros approuvé). */
  readonly myApprovedMember = computed(() => {
    const mine = this.myPlayerMember();
    if (!mine || mine.proposalStatus !== 'approved' || !mine.approvedCharacterId) return null;
    return mine;
  });

  /** Statut proposition héros pour CTAs table. */
  readonly myHeroProposalStatus = computed((): 'none' | 'pending' | 'rejected' | 'approved' => {
    const mine = this.myPlayerMember();
    if (!mine) return 'none';
    if (mine.proposalStatus === 'approved' && mine.approvedCharacterId) return 'approved';
    if (mine.proposalStatus === 'pending') return 'pending';
    if (mine.proposalStatus === 'rejected') return 'rejected';
    return 'none';
  });

  /** Overlay joueur : documents publiés ou proposition de héros (reste sur /play). */
  readonly playerOverlay = signal<'handouts' | 'propose' | null>(null);
  readonly selectedHandoutId = signal<string | null>(null);
  readonly myCharacters = signal<{ id: string; name: string }[]>([]);
  readonly myCharactersLoading = signal(false);
  readonly proposeBusyId = signal<string | null>(null);
  readonly handoutKindLabels = HANDOUT_KIND_LABELS;

  readonly publishedHandouts = computed((): CampaignHandout[] =>
    (this.campaign().data.handouts ?? []).filter((h) => h.published),
  );

  readonly selectedHandout = computed((): CampaignHandout | null => {
    const id = this.selectedHandoutId();
    if (!id) return null;
    return this.publishedHandouts().find((h) => h.id === id) ?? null;
  });

  readonly sheetLoadingId = signal<string | null>(null);

  /** PJ approuvés pas encore dans le combat actif. */
  readonly availablePlayerAllies = computed(() => {
    const inCombat = new Set(
      (this.activeCombat()?.combatants ?? [])
        .map((c) => c.memberUserId)
        .filter((id): id is string => !!id),
    );
    return this.approvedPlayers().filter((p) => !inCombat.has(p.userId));
  });

  readonly allyPickerOpen = signal(false);
  readonly enemyPickerOpen = signal(false);
  readonly campaignAllyPickerOpen = signal(false);
  readonly importingAllyId = signal<string | null>(null);
  readonly importingCreatureId = signal<string | null>(null);
  readonly codexCreatureSummaries = signal<CreatureSummary[]>([]);
  readonly codexCreatureSearch = signal('');
  readonly codexCreaturesLoading = signal(false);

  /** Canvas carte live (MJ + joueurs). */
  private readonly liveDungeonCanvas = viewChild<ElementRef<HTMLCanvasElement>>('liveDungeonCanvas');
  private mapResizeObserver: ResizeObserver | null = null;
  private liveMapCellSize = 10;

  /** Jeton sélectionné pour placement (MJ). */
  readonly selectedTokenCombatantId = signal<string | null>(null);
  readonly tokenImageError = signal<string | null>(null);
  readonly selectedTokenCombatant = computed(() => {
    const id = this.selectedTokenCombatantId();
    if (!id) return null;
    return this.activeCombat()?.combatants.find((c) => c.id === id) ?? null;
  });
  private tokenDrag:
    | { combatantId: string; pointerId: number; moved: boolean }
    | null = null;

  /** Fil de table. */
  readonly tableChatDraft = signal('');
  readonly tableChatSending = signal(false);
  readonly tableChatOpen = signal(true);

  /** Réinitialise la vue table si on change / quitte la session (dock réutilisé). */
  private lastBoundSessionId: string | null | undefined = undefined;

  /** Joueur mobile : roster compact (tour + vous) sauf si déplié. */
  readonly playerRosterExpanded = signal(false);

  readonly playerRosterLines = computed(() => {
    const order = this.combatTurnOrder();
    if (this.isDm() || this.playerRosterExpanded()) return order;
    const turnId = this.currentTurn()?.id;
    const myId = this.myCombatant()?.id;
    const compact = order.filter((c) => c.id === turnId || c.id === myId);
    return compact.length ? compact : order.slice(0, 2);
  });

  readonly sceneTimerDisplay = computed(() => {
    this.sceneTimerTick();
    const s = this.sceneTimerSeconds();
    if (s == null) return null;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  });

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHide);
    }
    this.storeSub = this.playStore.campaignChanged$.subscribe((next) => {
      this.campaignChange.emit(next);
    });
    effect(() => {
      const fb = this.playStore.feedback();
      untracked(() => this.feedback.set(fb));
    });
    effect(() => {
      const c = this.campaign();
      untracked(() => this.playStore.bindCampaign(c));
    });
    effect(() => {
      const map = this.activeSessionMap();
      const canvasRef = this.liveDungeonCanvas();
      const isDm = this.isDm();
      const tokens = this.battleMapTokens();
      const show = this.showBattleMap();
      untracked(() =>
        this.bindLiveDungeonCanvas(map, canvasRef?.nativeElement ?? null, isDm, tokens, show),
      );
    });
    effect(() => {
      const sessionId = this.campaign().data.activeSessionId ?? null;
      untracked(() => {
        if (this.lastBoundSessionId === undefined) {
          this.lastBoundSessionId = sessionId;
          return;
        }
        if (this.lastBoundSessionId === sessionId) return;
        this.lastBoundSessionId = sessionId;
        this.sessionView.set('resume');
        this.resetFightStep();
        this.allyPickerOpen.set(false);
        this.enemyPickerOpen.set(false);
        this.campaignAllyPickerOpen.set(false);
        this.advancedToolsOpen.set(false);
        this.dungeonPickerOpen.set(false);
        this.codexCreatureSearch.set('');
      });
    });
    effect(() => {
      const collecting = !!this.activeCombat()?.collectingInitiative && this.isDm();
      this.live.connected();
      untracked(() => {
        if (collecting) this.startInitiativePoll();
        else this.stopInitiativePoll();
      });
    });
    effect(() => {
      const timer = this.activeSession()?.sceneTimer ?? null;
      this.sceneTimerTick();
      untracked(() => this.hydrateSceneTimer(timer));
    });
  }

  readonly campaignCreatures = computed(() => this.campaign().data.creatures ?? []);

  readonly campaignAllyCreatures = computed(() =>
    this.campaignCreatures().filter((cr) => cr.role === 'ally'),
  );

  readonly campaignEnemyCreatures = computed(() =>
    this.campaignCreatures().filter((cr) => cr.role === 'antagonist' || cr.role === 'wildcard'),
  );

  readonly campaignUnsortedCreatures = computed(() =>
    this.campaignCreatures().filter((cr) => cr.role === 'neutral'),
  );

  private creatureTrackKey(cr: StoryCreatureSelection): string {
    return `${cr.creatureId}::${cr.customName || cr.creatureName}`;
  }

  /** Classer tous les Neutres de la campagne en Alliés ou Adversaires (préparation + setup combat). */
  bulkClassifyUnsorted(role: 'ally' | 'antagonist'): void {
    if (!this.isDm()) return;
    const unsorted = this.campaignUnsortedCreatures();
    if (!unsorted.length) return;
    const label = role === 'ally' ? 'alliés' : 'adversaires';
    this.askConfirm(
      'Classer les créatures',
      `Classer ${unsorted.length} créature(s) neutre(s) en ${label} ?`,
      () => {
        const keys = new Set(unsorted.map((cr) => this.creatureTrackKey(cr)));
        const creatures = (this.campaign().data.creatures ?? []).map((entry) =>
          keys.has(this.creatureTrackKey(entry)) ? { ...entry, role } : entry,
        );
        this.saveData({ creatures });
        this.setFeedback('ok', `${unsorted.length} créature(s) → ${label}.`);
      },
      'Classer',
    );
  }

  updateCreatureRole(cr: StoryCreatureSelection, role: CreatureRole): void {
    if (!this.isDm()) return;
    const creatures = (this.campaign().data.creatures ?? []).map((entry) =>
      entry.creatureId === cr.creatureId && entry.customName === cr.customName
        ? { ...entry, role }
        : entry,
    );
    this.saveData({ creatures });
  }

  readonly filteredCodexCreatures = computed(() => {
    const q = this.codexCreatureSearch().trim().toLowerCase();
    const list = this.codexCreatureSummaries();
    if (!q) return list.slice(0, 24);
    return list
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          (c.section?.toLowerCase().includes(q) ?? false) ||
          (c.part?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 36);
  });

  readonly awardingXpId = signal<string | null>(null);

  readonly combatMissingInitCount = computed(() => {
    const combat = this.activeCombat();
    if (!combat) return 0;
    return combat.combatants.filter(
      (c) => !isCombatantDefeated(c) && combatantInitiativeTotal(c) == null,
    ).length;
  });

  readonly combatMissingHpCount = computed(() => {
    const combat = this.activeCombat();
    if (!combat) return 0;
    return combat.combatants.filter(
      (c) =>
        !isCombatantDefeated(c) &&
        (c.currentHp === undefined || c.currentHp === null || c.maxHp === undefined || c.maxHp === null),
    ).length;
  });

  protected encounterTotalXp = encounterTotalXp;
  protected encounterPendingXp = encounterPendingXp;
  /** Public: template play-combat-flow via host. */
  readonly combatantInitiativeTotal = combatantInitiativeTotal;
  readonly combatantKindLabels = COMBATANT_KIND_LABELS;
  readonly roleLabels = CREATURE_ROLE_LABELS;
  readonly isCombatantDefeated = isCombatantDefeated;
  readonly sessionModeLabel = sessionModeLabel;
  protected sessionModeHint = sessionModeHint;

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
    }
    this.storeSub?.unsubscribe();
    this.playStore.destroy();
    this.flushPendingSessionWork();
    this.stopInitiativePoll();
    this.teardownMapResize();
    this.clearSceneTimerTick();
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
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

  publishedHandoutsCount(): number {
    return this.publishedHandouts().length;
  }

  openHandoutsOverlay(): void {
    const pinned = this.campaign().data.pinnedHandoutId;
    this.selectedHandoutId.set(
      pinned && this.publishedHandouts().some((h) => h.id === pinned) ? pinned : null,
    );
    this.playerOverlay.set('handouts');
  }

  openProposeOverlay(): void {
    this.playerOverlay.set('propose');
    this.myCharactersLoading.set(true);
    this.characters.list().subscribe({
      next: (chars) => {
        this.myCharacters.set(chars.map((c) => ({ id: c.id, name: c.name })));
        this.myCharactersLoading.set(false);
      },
      error: () => {
        this.myCharacters.set([]);
        this.myCharactersLoading.set(false);
        this.setFeedback('err', 'Impossible de charger vos personnages.');
      },
    });
  }

  closePlayerOverlay(): void {
    this.playerOverlay.set(null);
    this.selectedHandoutId.set(null);
    this.proposeBusyId.set(null);
  }

  selectHandout(id: string): void {
    this.selectedHandoutId.set(id);
  }

  clearSelectedHandout(): void {
    this.selectedHandoutId.set(null);
  }

  proposeCharacterFromPlay(characterId: string): void {
    if (this.proposeBusyId()) return;
    const c = this.campaign();
    this.proposeBusyId.set(characterId);
    this.campaigns.proposeCharacter(c.id, characterId).subscribe({
      next: () => {
        this.proposeBusyId.set(null);
        this.closePlayerOverlay();
        this.setFeedback('ok', 'Héros proposé — en attente de l’approbation du MJ.');
        this.notifications.refresh();
        this.reload();
      },
      error: () => {
        this.proposeBusyId.set(null);
        this.setFeedback('err', 'Impossible de proposer ce personnage.');
      },
    });
  }

  private askConfirm(
    title: string,
    body: string,
    onConfirm: () => void,
    confirmLabel = 'Confirmer',
  ): void {
    this.confirmDialog.set({ title, body, confirmLabel, onConfirm });
  }

  /** Flush notes locales (debounce) + persist session. */
  private flushPendingSessionWork(): void {
    this.flushSessionSave();
  }

  clearFeedback(): void {
    this.feedback.set(null);
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
  }

  /** Toast après « Ajouter à la table » depuis une fiche Codex (?added=…). */
  announceCodexImport(creatureName: string): void {
    const name = creatureName.trim();
    if (!name) return;
    this.setFeedback(
      'ok',
      `${name} ajouté depuis le Codex — ouvrez Combattre pour le voir sur la table.`,
      7000,
    );
  }

  private setFeedback(
    kind: 'ok' | 'err',
    text: string,
    ttlMsOrOpts: number | { ttlMs?: number; undo?: () => void } = 4500,
  ): void {
    this.playStore.setFeedback(kind, text, ttlMsOrOpts);
    // Miroir local pour le toast du shell (data-testid / undo).
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

  /**
   * Raccourcis MJ table : Space = tour suivant, N = notes, S = secrets, D = d20 table, F = fog.
   * @returns true si le raccourci a été consommé.
   */
  handleMjShortcut(key: 'space' | 'n' | 'd' | 'f' | 's' | 'z'): boolean {
    if (!this.isDm() || this.isSpectator()) return false;
    if (key === 'space') {
      if (!this.activeCombat() || this.combatFlowPhase() !== 'fight') return false;
      this.nextTurn();
      return true;
    }
    if (key === 'n') {
      this.openSessionNotes();
      softTablePulse('dice');
      return true;
    }
    if (key === 's') {
      this.toggleSecretPanel();
      softTablePulse('dice');
      return true;
    }
    if (key === 'z') {
      this.toggleZenMode();
      return true;
    }
    if (key === 'd') {
      const r = rollDie(20);
      this.playTableChat()?.shareTableD20(r) ?? this.shareDiceRoll(20, r, 'table');
      this.setFeedback('ok', `d20 → ${r}`);
      softTablePulse('dice');
      return true;
    }
    if (key === 'f') {
      if (!this.activeSessionMap()) {
        this.setFeedback('err', 'Aucune carte de session pour le fog.');
        return true;
      }
      this.playBattleMap()?.toggleSessionFog() ?? this.toggleSessionFog();
      return true;
    }
    return false;
  }

  isPlayerTableReady(userId: string): boolean {
    return (this.activeSession()?.tableReadyUserIds ?? []).includes(userId);
  }

  togglePlayerTableReady(userId: string): void {
    if (this.isSpectator()) return;
    const session = this.activeSession();
    if (!session) return;
    const me = this.auth.user()?.id;
    if (!this.isDm() && me !== userId) return;
    const cur = new Set(session.tableReadyUserIds ?? []);
    if (cur.has(userId)) cur.delete(userId);
    else cur.add(userId);
    this.patchSession({ tableReadyUserIds: [...cur] }, { immediate: true });
    softTablePulse('ready');
  }

  setHpAdjustAmount(raw: string | number): void {
    this.hpAdjustAmount.set(Math.max(1, Number(raw) || 1));
  }

  combatantNeedsInit(cb: Combatant): boolean {
    return !isCombatantDefeated(cb) && combatantInitiativeTotal(cb) == null;
  }

  combatantNeedsHp(cb: Combatant): boolean {
    return (
      !isCombatantDefeated(cb) &&
      (cb.currentHp === undefined ||
        cb.currentHp === null ||
        cb.maxHp === undefined ||
        cb.maxHp === null)
    );
  }

  formatSessionDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  startPlaySession(sessionId: string): void {
    if (!this.isDm()) return;
    this.flushSessionSave();
    this.sessionView.set('resume');
    this.resetFightStep();
    this.saveData({ activeSessionId: sessionId });
  }

  onSessionTimelineChange(timeline: SessionTimelineItem[]): void {
    const session = this.activeSession();
    if (!session || !this.isDm()) return;
    const sessions = (this.campaign().data.sessions ?? []).map((s) =>
      s.id === session.id ? { ...s, timeline } : s,
    );
    this.saveData({ sessions });
  }

  endPlaySession(): void {
    const c = this.campaign();
    const session = this.activeSession();
    if (!c.isOwner || !session) return;
    const existing = session.playerRecap?.trim() ?? '';
    this.endSessionDialog.set({
      recap: existing || buildPlayerRecapTemplate(session),
    });
  }

  fillEndSessionRecapDraft(): void {
    const session = this.activeSession();
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

  private doEndPlaySession(playerRecap?: string): void {
    const c = this.campaign();
    const session = this.activeSession();
    if (!c.isOwner || !session) return;
    this.flushPendingSessionWork();
    this.sessionView.set('resume');
    this.resetFightStep();
    const sessions = (c.data.sessions ?? []).map((s) => {
      if (s.id !== session.id) return s;
      const pads = ensureSessionPlayPads(s);
      const playBlock = archivePlayPadsText(pads) || s.playNotes?.trim() || '';
      const mergedNotes = playBlock
        ? [s.notes?.trim(), playBlock].filter(Boolean).join('\n\n--- Notes de session ---\n\n')
        : s.notes;
      return {
        ...s,
        status: 'played' as CampaignSessionStatus,
        notes: mergedNotes || s.notes,
        playerRecap: playerRecap || s.playerRecap,
        playNotes: '',
        playNotebook: undefined,
        playPads: [],
        activeCombat: null,
      };
    });
    this.saveData({ sessions, activeSessionId: null }, () => {
      this.sessionDock.forgetAfterSessionEnd(c.id);
      if (this.fullscreen()) {
        this.router.navigate(['/campaigns', c.id]);
      }
    });
  }

  startStandaloneCombat(): void {
    if (!this.activeSession()) {
        this.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.withReplaceCombatConfirm(() => {
      this.setActiveCombat(createActiveCombat([], { label: 'Combat' }));
      this.sessionView.set('combat');
      this.resetFightStep();
    });
  }

  enterCombatFlow(): void {
    if (!this.activeSession()) {
        this.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.sessionView.set('combat');
    if (!this.activeCombat()) {
      this.setActiveCombat(createActiveCombat([], { label: 'Combat' }));
    }
    this.resetFightStep();
  }

  setSessionView(view: PlaySessionView): void {
    if (view === 'notes') {
      this.openSessionNotes();
      return;
    }
    if (this.sessionView() === 'notes') {
      this.flushPendingSessionWork();
    }
    this.sessionView.set(view);
    if (view !== 'combat') this.resetFightStep();
    if (view !== 'dungeon') this.dungeonPickerOpen.set(false);
  }

  backToSessionHub(): void {
    if (this.sessionView() === 'notes') {
      this.flushPendingSessionWork();
    }
    this.sessionView.set('resume');
    this.resetFightStep();
    this.dungeonPickerOpen.set(false);
  }

  openSessionNotes(): void {
    const session = this.activeSession();
    if (session && !session.playPads?.length) {
      const pads = ensureSessionPlayPads(session);
      this.updateSession(session.id, { playPads: pads }, { immediate: true });
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

  /** Aperçu lecture seule dérivé des calepins (pas d’édition via playNotes). */
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
    if (!this.isDm() || !this.activeSession()) return;
    this.patchSession({ activeMapId: mapId }, { immediate: true });
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
    this.saveData(patch);
  }

  private bindLiveDungeonCanvas(
    map: CampaignDungeonMap | null,
    canvas: HTMLCanvasElement | null,
    isDm: boolean,
    tokens: ReturnType<typeof combatantsToTokens>,
    show: boolean,
  ): void {
    this.teardownMapResize();
    if (!show || !map || !canvas) return;
    this.paintLiveDungeon(map, canvas, isDm, tokens);
    const host = canvas.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.mapResizeObserver = new ResizeObserver(() => {
      this.paintLiveDungeon(this.activeSessionMap(), canvas, this.isDm(), this.battleMapTokens());
    });
    this.mapResizeObserver.observe(host);
  }

  private teardownMapResize(): void {
    this.mapResizeObserver?.disconnect();
    this.mapResizeObserver = null;
  }

  private paintLiveDungeon(
    map: CampaignDungeonMap | null,
    canvas: HTMLCanvasElement | null,
    isDm: boolean,
    tokens: ReturnType<typeof combatantsToTokens>,
  ): void {
    if (!map || !canvas) return;
    const hostW = canvas.parentElement?.clientWidth ?? 0;
    const width = Math.max(280, hostW || 360);
    const cell = Math.max(6, Math.min(20, Math.floor(width / Math.max(1, map.gridWidth ?? 48))));
    this.liveMapCellSize = cell;
    drawDungeonToCanvas(map, canvas, cell, {
      showRoomNumbers: true,
      vignette: true,
      revealedRoomIds: isDm ? null : fogRevealSet(map),
      combatTokens: tokens,
    });
  }

  selectTokenForPlacement(combatantId: string): void {
    if (!this.isDm()) return;
    this.tokenImageError.set(null);
    this.selectedTokenCombatantId.update((id) => (id === combatantId ? null : combatantId));
  }

  async onTokenImageFile(event: Event, combatantId: string): Promise<void> {
    if (!this.isDm()) return;
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;
    this.tokenImageError.set(null);
    try {
      const { fileToSquareJpegDataUrl, sanitizeTokenImageUrl } = await import(
        '@core/utils/image-data-url.util'
      );
      const raw = await fileToSquareJpegDataUrl(file, 192);
      const dataUrl = await sanitizeTokenImageUrl(raw, 192);
      if (!dataUrl) {
        this.tokenImageError.set('Image trop lourde — essayez un PNG/JPEG plus léger.');
        return;
      }
      this.updateCombatant(combatantId, { tokenImageUrl: dataUrl }, { immediate: true });
    } catch {
      this.tokenImageError.set('Image illisible — essayez un PNG/JPEG plus léger.');
    }
  }

  onBattleMapPointerDown(event: PointerEvent): void {
    if (!this.isDm()) return;
    const map = this.activeSessionMap();
    const canvas = this.liveDungeonCanvas()?.nativeElement;
    const combat = this.activeCombat();
    if (!map || !canvas || !combat) return;

    const tile = this.tileFromCanvasEvent(event, canvas);
    if (!tile) return;
    const occupant = findCombatantAtTile(combat.combatants, tile.x, tile.y);
    if (occupant) {
      this.selectedTokenCombatantId.set(occupant.id);
      this.tokenDrag = { combatantId: occupant.id, pointerId: event.pointerId, moved: false };
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    const placeId = this.selectedTokenCombatantId() ?? this.currentTurn()?.id ?? null;
    if (!placeId) return;
    const clamped = clampTokenToFloor(map, tile.x, tile.y);
    if (!clamped) return;
    this.placeCombatantOnMap(placeId, clamped.x, clamped.y);
  }

  onBattleMapPointerMove(event: PointerEvent): void {
    if (!this.isDm() || !this.tokenDrag || this.tokenDrag.pointerId !== event.pointerId) return;
    const map = this.activeSessionMap();
    const canvas = this.liveDungeonCanvas()?.nativeElement;
    if (!map || !canvas) return;
    const tile = this.tileFromCanvasEvent(event, canvas);
    if (!tile) return;
    const clamped = clampTokenToFloor(map, tile.x, tile.y);
    if (!clamped) return;
    this.tokenDrag = { ...this.tokenDrag, moved: true };
    this.placeCombatantOnMap(this.tokenDrag.combatantId, clamped.x, clamped.y, {
      immediate: false,
      silentOccupancy: true,
    });
  }

  onBattleMapPointerUp(event: PointerEvent): void {
    if (!this.tokenDrag || this.tokenDrag.pointerId !== event.pointerId) return;
    const drag = this.tokenDrag;
    this.tokenDrag = null;
    if (drag.moved) {
      const combat = this.activeCombat();
      const c = combat?.combatants.find((x) => x.id === drag.combatantId);
      if (c && typeof c.mapX === 'number' && typeof c.mapY === 'number') {
        this.placeCombatantOnMap(drag.combatantId, c.mapX, c.mapY, { immediate: true });
      }
    }
  }

  private tileFromCanvasEvent(
    event: PointerEvent,
    canvas: HTMLCanvasElement,
  ): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const ox = (event.clientX - rect.left) * scaleX;
    const oy = (event.clientY - rect.top) * scaleY;
    return pixelToTile(ox, oy, this.liveMapCellSize, 0);
  }

  placeCombatantOnMap(
    combatantId: string,
    x: number,
    y: number,
    options?: { immediate?: boolean; silentOccupancy?: boolean },
  ): void {
    const combat = this.activeCombat();
    if (!combat || !this.isDm()) return;
    if (isTileOccupied(combat.combatants, x, y, combatantId)) {
      if (!options?.silentOccupancy) {
        this.setFeedback('err', 'Case déjà occupée.');
      }
      return;
    }
    const combatants = combat.combatants.map((c) =>
      c.id === combatantId ? { ...c, mapX: x, mapY: y } : c,
    );
    this.patchCombat({ ...combat, combatants }, { immediate: options?.immediate !== false });
  }

  patchSessionDungeonMap(partial: Partial<CampaignDungeonMap>): void {
    if (!this.isDm()) return;
    const map = this.activeSessionMap();
    if (!map) return;
    const dungeonMaps = (this.campaign().data.dungeonMaps ?? []).map((m) =>
      m.id === map.id ? { ...m, ...partial, updatedAt: new Date().toISOString() } : m,
    );
    this.saveData({ dungeonMaps });
  }

  toggleSessionFog(): void {
    const map = this.activeSessionMap();
    if (!map) return;
    const prev = {
      fogOfWarEnabled: map.fogOfWarEnabled,
      revealedRoomIds: [...(map.revealedRoomIds ?? [])],
      revealedCorridorCells: [...(map.revealedCorridorCells ?? [])],
    };
    this.patchSessionDungeonMap(withFogToggled(map));
    const on = !prev.fogOfWarEnabled;
    this.setFeedback('ok', on ? 'Fog activé.' : 'Fog désactivé.', {
      undo: () => this.patchSessionDungeonMap(prev),
    });
  }

  isSessionRoomRevealed(roomId: string): boolean {
    const map = this.activeSessionMap();
    return map ? isRoomRevealedOnMap(map, roomId) : true;
  }

  toggleSessionRoomReveal(roomId: string): void {
    if (!this.connectivity.isOnline()) {
      this.setFeedback('err', 'Échec fog — vérifiez la connexion.');
      return;
    }
    const map = this.activeSessionMap();
    if (!map?.fogOfWarEnabled) return;
    const prevIds = [...(map.revealedRoomIds ?? [])];
    const revealed = isRoomRevealedOnMap(map, roomId);
    this.patchSessionDungeonMap(withRoomRevealed(map, roomId, !revealed));
    this.setFeedback('ok', revealed ? 'Salle masquée.' : 'Salle révélée.', {
      undo: () => this.patchSessionDungeonMap({ revealedRoomIds: prevIds }),
    });
  }

  revealAllSessionRooms(): void {
    if (!this.connectivity.isOnline()) {
      this.setFeedback('err', 'Échec fog — vérifiez la connexion.');
      return;
    }
    const map = this.activeSessionMap();
    if (!map) return;
    const prevIds = [...(map.revealedRoomIds ?? [])];
    this.patchSessionDungeonMap(withAllRoomsRevealed(map));
    this.setFeedback('ok', 'Toutes les salles révélées.', {
      undo: () => this.patchSessionDungeonMap({ revealedRoomIds: prevIds }),
    });
  }

  hideAllSessionRooms(): void {
    if (!this.connectivity.isOnline()) {
      this.setFeedback('err', 'Échec fog — vérifiez la connexion.');
      return;
    }
    const map = this.activeSessionMap();
    const prev = {
      revealedRoomIds: [...(map?.revealedRoomIds ?? [])],
      revealedCorridorCells: [...(map?.revealedCorridorCells ?? [])],
    };
    this.patchSessionDungeonMap(withNoRoomsRevealed());
    this.setFeedback('ok', 'Fog tout masqué.', {
      undo: () => this.patchSessionDungeonMap(prev),
    });
  }

  sendTableChat(): void {
    if (this.isSpectator()) return;
    if (!this.connectivity.isOnline()) {
      this.setFeedback('err', 'Échec chat — vérifiez la connexion.');
      return;
    }
    const session = this.activeSession();
    const body = this.tableChatDraft().trim();
    if (!session || !body || this.tableChatSending()) return;
    this.tableChatSending.set(true);
    this.campaigns.postTableChat(this.campaign().id, { sessionId: session.id, body }).subscribe({
      next: () => {
        this.tableChatDraft.set('');
        this.tableChatSending.set(false);
      },
      error: () => {
        this.tableChatSending.set(false);
        this.setFeedback('err', 'Échec chat — vérifiez la connexion.');
      },
    });
  }

  /** Partage un jet dans le fil de table (visible party). */
  shareDiceRoll(faces: number, result: number, label?: string): void {
    if (this.isSpectator()) return;
    const session = this.activeSession();
    if (!session) return;
    const who = this.auth.user()?.displayName?.trim() || 'Joueur';
    const tag = label?.trim() ? ` (${label.trim()})` : '';
    const body = `🎲 ${who}${tag} : d${faces} → ${result}`;
    this.campaigns.postTableChat(this.campaign().id, { sessionId: session.id, body }).subscribe({
      error: () => this.setFeedback('err', 'Jet non partagé (fil de table).'),
    });
  }

  onSharedTableDie(result: number): void {
    this.shareDiceRoll(20, result, 'table');
  }

  formatTableChatTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  togglePlayerRoster(): void {
    this.playerRosterExpanded.update((v) => !v);
  }

  onSessionResumeChange(page: NotebookPage): void {
    if (!this.isDm()) return;
    this.saveData({ sessionResume: page });
  }

  onSessionPadsChange(payload: { playPads: SessionPlayPad[] }): void {
    const session = this.activeSession();
    if (!session) return;
    this.updateSession(session.id, { playPads: payload.playPads });
  }

  continueToInitiativePhase(): void {
    const combat = this.activeCombat();
    if (!combat || !canAdvanceFromSetup(combat)) {
      this.setFeedback('err', 'Ajoutez au moins un allié et un adversaire.');
      return;
    }
    this.patchCombat(
      {
        ...combat,
        flowPhase: 'initiative',
        collectingInitiative: true,
        initiativeCode: combat.initiativeCode || createInitiativeCode(),
      },
      { immediate: true },
    );
    this.seenInitiativeSubmissions = new Set(
      combat.combatants.filter((c) => c.kind === 'player' && c.playerSubmitted).map((c) => c.id),
    );
    this.startInitiativePoll();
    this.setFeedback('ok', 'Initiative ouverte — partagez le QR ou encodez les jets manquants.');
  }

  openFightPhase(): void {
    const combat = this.activeCombat();
    if (!combat || !canOpenFightPhase(combat)) {
      this.setFeedback('err', 'Tous les combattants actifs doivent avoir une initiative.');
      return;
    }
    this.patchCombat(
      {
        ...combat,
        flowPhase: 'fight',
        collectingInitiative: false,
        turnOrderIds: freezeTurnOrderIds(combat),
        turnIndex: 0,
      },
      { immediate: true },
    );
    this.stopInitiativePoll();
    this.resetFightStep();
    this.setFeedback('ok', 'Combat ouvert — suivez l’ordre des tours (Espace = suivant).');
  }

  toggleAdvancedTools(): void {
    this.advancedToolsOpen.update((v) => !v);
  }

  resetFightStep(): void {
    this.fightStep.set('menu');
    this.pendingHitTotal.set(null);
    this.pendingDamageDice.set(null);
    this.selectedTargetId.set(null);
    this.selectedAttackIndex.set(0);
  }

  beginAttackFlow(): void {
    if (!this.canActOnTurn()) return;
    this.fightStep.set('pickAttack');
  }

  confirmAttackChoice(): void {
    this.fightStep.set('pickTarget');
  }

  confirmTargetChoice(): void {
    if (!this.selectedTarget()) {
      this.setFeedback('err', 'Choisissez une cible.');
      return;
    }
    this.fightStep.set('toHit');
  }

  skipTurn(): void {
    this.resetFightStep();
    this.nextTurn();
  }

  startCombatFromEncounter(encounter: EncounterGroup): void {
    if (!this.activeSession()) {
        this.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.withReplaceCombatConfirm(() => {
      let combatants = expandEncounterToCombatants(encounter);
      const sessionPatch: Partial<CampaignSession> = {};
      if (encounter.dungeonMapId) {
        sessionPatch.activeMapId = encounter.dungeonMapId;
        const map = (this.campaign().data.dungeonMaps ?? []).find(
          (m) => m.id === encounter.dungeonMapId,
        );
        const room = map?.rooms?.find((r) => r.encounterId === encounter.id);
        if (map && room) {
          combatants = combatants.map((c, i) => {
            const clamped =
              clampTokenToFloor(map, room.x + i, room.y) ??
              clampTokenToFloor(map, room.x, room.y);
            return clamped ? { ...c, mapX: clamped.x, mapY: clamped.y } : c;
          });
        }
      }
      this.patchSession(
        {
          ...sessionPatch,
          activeCombat: createActiveCombat(combatants, {
            label: encounter.name,
            encounterId: encounter.id,
          }),
        },
        { immediate: true },
      );
      this.sessionView.set('combat');
      this.resetFightStep();
    });
  }

  importPartyIntoCombat(): void {
    const approved = this.approvedPlayers();
    if (!approved.length) {
      this.setFeedback(
        'err',
        'Aucun personnage joueur approuvé. Ajoutez un allié joueur ou un PNJ.',
      );
      return;
    }
    const existing = this.activeCombat();
    const existingMemberIds = new Set(
      (existing?.combatants ?? [])
        .map((c) => c.memberUserId)
        .filter((id): id is string => !!id),
    );
    const toImport = approved.filter((p) => !existingMemberIds.has(p.userId));
    if (!toImport.length) {
      this.setFeedback('ok', 'Tous les PJ approuvés sont déjà dans le combat.');
      return;
    }
    this.importMembersIntoCombat(toImport);
  }

  toggleAllyPicker(): void {
    this.allyPickerOpen.update((v) => !v);
    if (this.allyPickerOpen()) {
      this.enemyPickerOpen.set(false);
      this.campaignAllyPickerOpen.set(false);
    }
  }

  toggleCampaignAllyPicker(): void {
    this.campaignAllyPickerOpen.update((v) => !v);
    if (this.campaignAllyPickerOpen()) {
      this.allyPickerOpen.set(false);
      this.enemyPickerOpen.set(false);
    }
  }

  toggleEnemyPicker(): void {
    this.enemyPickerOpen.update((v) => !v);
    if (this.enemyPickerOpen()) {
      this.allyPickerOpen.set(false);
      this.campaignAllyPickerOpen.set(false);
      this.ensureCodexCreatureSummaries();
    } else {
      this.codexCreatureSearch.set('');
    }
  }

  setCodexCreatureSearch(value: string): void {
    this.codexCreatureSearch.set(value);
  }

  /** Pseudo du joueur lié au combattant (si PJ importé). */
  playerDisplayName(combatant: Combatant): string | null {
    const userId = combatant.memberUserId;
    if (!userId) return null;
    const member = this.campaign().members.find((m) => m.userId === userId);
    const name = member?.displayName?.trim();
    return name || null;
  }

  memberForCombatant(combatant: Combatant): CampaignMember | null {
    const userId = combatant.memberUserId;
    if (!userId) return null;
    return (
      this.approvedPlayers().find((m) => m.userId === userId) ?? null
    );
  }

  /** Ouvre la fiche du joueur courant (consultation, retour table). */
  openMySheet(): void {
    const mine = this.myApprovedMember();
    if (mine) this.openMemberSheet(mine, 'Votre héros à la table');
  }

  openCombatantSheet(combatant: Combatant): void {
    const member = this.memberForCombatant(combatant);
    if (!member) return;
    const label =
      member.userId === this.auth.user()?.id
        ? 'Votre héros à la table'
        : `${member.approvedCharacterName ?? member.displayName} (table)`;
    this.openMemberSheet(member, label);
  }

  openMemberSheet(member: CampaignMember, sourceLabel = 'Héros de la table'): void {
    if (!member.approvedCharacterId || this.sheetLoadingId()) return;
    this.sheetLoadingId.set(member.id);
    this.clearFeedback();
    const campaignId = this.campaign().id;
    const returnUrl = `/campaigns/${campaignId}/play`;
    this.campaigns.getMemberCharacter(campaignId, member.id, 'approved').subscribe({
      next: (res) => {
        const character = { ...(res.data as object) } as Character;
        if (res.name) character.name = res.name;
        this.handoff.setCurrent(character, {
          mode: 'consult',
          sourceLabel,
          returnUrl,
        });
        this.sheetLoadingId.set(null);
        void this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.sheetLoadingId.set(null);
        this.setFeedback('err', 'Impossible d’ouvrir la fiche.');
      },
    });
  }

  /** Ajoute un PJ approuvé comme allié (crée le combat s’il n’existe pas). */
  importPlayerAlly(member: CampaignMember): void {
    this.importMembersIntoCombat([member], { closePicker: true });
  }

  /** Ajoute une créature de campagne comme allié PNJ (stats bestiaire). */
  addCampaignCreatureAlly(selection: StoryCreatureSelection): void {
    this.addCampaignCreature(selection, 'ally');
  }

  /** Ajoute une créature de la campagne comme adversaire (stats bestiaire). */
  addCampaignCreatureEnemy(selection: StoryCreatureSelection): void {
    this.addCampaignCreature(selection, 'enemy');
  }

  /** Ajoute une créature du codex comme adversaire (stats bestiaire). */
  addCodexCreatureEnemy(summary: CreatureSummary): void {
    if (this.importingCreatureId() || this.importingParty()) return;
    this.importingCreatureId.set(summary.id);
    this.clearFeedback();

    this.data.getCreatureById(summary.id).subscribe({
      next: (creature) => {
        this.importingCreatureId.set(null);
        this.enemyPickerOpen.set(false);
        this.codexCreatureSearch.set('');
        const combatant = this.combatantFromCreature(creature, creature.name || summary.name, 'monster');
        this.appendCombatants([combatant], combatant.name);
      },
      error: () => {
        this.importingCreatureId.set(null);
        const combatant = createCombatant({
          name: summary.name,
          kind: 'monster',
          armorClass: summary.armorClass || 10,
          initiativeBonus: 0,
        });
        this.appendCombatants([combatant], combatant.name);
        this.setFeedback('err', 'Fiche créature incomplète — CA/PV à saisir manuellement.');
      },
    });
  }

  /** Adversaire vide (CA 10) — dernier recours hors bestiaire. */
  addBlankEnemyCombatant(): void {
    this.enemyPickerOpen.set(false);
    this.codexCreatureSearch.set('');
    this.addEnemyCombatant();
  }

  private ensureCodexCreatureSummaries(): void {
    if (this.codexCreatureSummaries().length || this.codexCreaturesLoading()) return;
    this.codexCreaturesLoading.set(true);
    this.data.getCreaturesSummary().subscribe({
      next: (list) => {
        this.codexCreatureSummaries.set(list ?? []);
        this.codexCreaturesLoading.set(false);
      },
      error: () => {
        this.codexCreaturesLoading.set(false);
        this.setFeedback('err', 'Impossible de charger le bestiaire codex.');
      },
    });
  }

  private addCampaignCreature(
    selection: StoryCreatureSelection,
    side: 'ally' | 'enemy',
  ): void {
    if (this.importingCreatureId() || this.importingParty()) return;
    this.importingCreatureId.set(selection.creatureId);
    this.clearFeedback();

    this.data.getCreatureById(selection.creatureId).subscribe({
      next: (creature) => {
        this.importingCreatureId.set(null);
        this.enemyPickerOpen.set(false);
        this.campaignAllyPickerOpen.set(false);
        const combatant = this.combatantFromCreature(
          creature,
          selection.customName?.trim() || selection.creatureName,
          side === 'ally' ? 'npc' : 'monster',
        );
        this.appendCombatants([combatant], selection.customName || selection.creatureName);
      },
      error: () => {
        this.importingCreatureId.set(null);
        const combatant = createCombatant({
          name: selection.customName?.trim() || selection.creatureName,
          kind: side === 'ally' ? 'npc' : 'monster',
          armorClass: 10,
          initiativeBonus: 0,
        });
        this.appendCombatants([combatant], combatant.name);
        this.setFeedback('err', 'Fiche créature incomplète — CA/PV à saisir manuellement.');
      },
    });
  }

  /** Lance / ajoute la rencontre avec stats bestiaire. */
  addEncounterToCombat(encounter: EncounterGroup): void {
    const base = expandEncounterToCombatants(encounter);
    if (!base.length) {
      this.setFeedback('err', 'Cette rencontre n’a aucune créature.');
      return;
    }

    const requests = encounter.creatures.flatMap((cr, creatureIndex) =>
      Array.from({ length: cr.quantity }, (_, unitIndex) =>
        this.data.getCreatureById(cr.creatureId).pipe(
          map((creature) => {
            const baseName = cr.customName || cr.creatureName || creature.name;
            const name = cr.quantity > 1 ? `${baseName} ${unitIndex + 1}` : baseName;
            const combatant = this.combatantFromCreature(creature, name);
            return {
              ...combatant,
              encounterLink: { encounterId: encounter.id, creatureIndex, unitIndex },
              defeated: unitIndex < cr.defeated,
              currentHp: unitIndex < cr.defeated ? 0 : combatant.currentHp,
            } satisfies Combatant;
          }),
          catchError(() => {
            const fallback = base.find(
              (c) =>
                c.encounterLink?.creatureIndex === creatureIndex &&
                c.encounterLink?.unitIndex === unitIndex,
            );
            return of(
              fallback ??
                createCombatant({
                  name: cr.customName || cr.creatureName,
                  kind: 'monster',
                  armorClass: 10,
                }),
            );
          }),
        ),
      ),
    );

    this.importingParty.set(true);
    forkJoin(requests).subscribe({
      next: (combatants) => {
        this.importingParty.set(false);
        const current = this.activeCombat();
        if (current) {
          this.patchCombat({
            ...current,
            combatants: [...current.combatants, ...combatants],
            label: current.label || encounter.name,
            encounterId: current.encounterId || encounter.id,
          });
        } else {
          this.setActiveCombat(
            createActiveCombat(combatants, { label: encounter.name, encounterId: encounter.id }),
          );
        }
        this.setFeedback(
          'ok',
          `Rencontre « ${encounter.name} » ajoutée (${combatants.length} adversaire(s)).`,
        );
      },
      error: () => {
        this.importingParty.set(false);
        this.startCombatFromEncounter(encounter);
      },
    });
  }

  private appendCombatants(combatants: Combatant[], feedbackName?: string): void {
    const current = this.activeCombat();
    if (current) {
      this.patchCombat(
        {
          ...current,
          combatants: [...current.combatants, ...combatants],
        },
        { immediate: true },
      );
    } else {
      this.setActiveCombat(createActiveCombat(combatants, { label: 'Combat' }));
    }
    if (feedbackName) {
      this.setFeedback('ok', `${feedbackName} ajouté au combat.`);
    }
  }

  private combatantFromCreature(
    creature: Creature,
    displayName: string,
    kind: Combatant['kind'] = 'monster',
  ): Combatant {
    return combatantFromCreature(creature, displayName, kind);
  }

  private importMembersIntoCombat(
    members: CampaignMember[],
    options?: { closePicker?: boolean },
  ): void {
    const session = this.activeSession();
    if (!session || !members.length) return;
    if (this.importingParty() || this.importingAllyId()) return;

    this.importingParty.set(true);
    if (members.length === 1) this.importingAllyId.set(members[0]!.id);
    this.clearFeedback();

    const campaignId = this.campaign().id;

    type ImportRow = { combatant: Combatant; incomplete: boolean };
    const requests = members.map((p) =>
      this.campaigns.getMemberCharacter(campaignId, p.id, 'approved').pipe(
        map((res): ImportRow => {
          const character = {
            ...(res.data as object),
            id: res.id,
            name: res.name ?? p.approvedCharacterName,
          } as Character;
          const combatant = this.combatantFromCharacter(character, p.userId);
          const incomplete =
            combatant.maxHp === undefined ||
            combatant.maxHp === null ||
            combatant.currentHp === undefined;
          return { combatant, incomplete };
        }),
        catchError(() =>
          of({
            combatant: createCombatant({
              name: p.approvedCharacterName ?? p.displayName,
              kind: 'player',
              initiativeBonus: 0,
              memberUserId: p.userId,
              armorClass: 10,
            }),
            incomplete: true,
          } satisfies ImportRow),
        ),
      ),
    );

    forkJoin(requests).subscribe({
      next: (rows) => {
        this.importingParty.set(false);
        this.importingAllyId.set(null);
        if (options?.closePicker) this.allyPickerOpen.set(false);

        const partyCombatants = rows.map((r) => r.combatant);
        const incomplete = rows.filter((r) => r.incomplete).length;
        const current = this.activeCombat();

        if (current) {
          this.patchCombat({
            ...current,
            combatants: [...current.combatants, ...partyCombatants],
          });
        } else {
          this.setActiveCombat(createActiveCombat(partyCombatants, { label: 'Combat' }));
        }

        const parts = [
          members.length === 1
            ? `${partyCombatants[0]?.name ?? 'Héros'} ajouté`
            : `+${partyCombatants.length} PJ importé(s)`,
        ];
        if (incomplete > 0) {
          parts.push(`${incomplete} fiche(s) incomplète(s) — vérifiez PV / init`);
        }
        this.setFeedback(incomplete > 0 ? 'err' : 'ok', parts.join(' · '));
      },
      error: () => {
        this.importingParty.set(false);
        this.importingAllyId.set(null);
        this.setFeedback('err', 'Impossible d’ajouter le personnage. Réessayez.');
      },
    });
  }

  endCombat(): void {
    const combat = this.activeCombat();
    const session = this.activeSession();
    if (!combat || !session) return;
    this.askConfirm(
      'Terminer le combat',
      'Un résumé sera ajouté aux notes de session et à l’historique.',
      () => this.doEndCombat(),
      'Terminer',
    );
  }

  private doEndCombat(): void {
    const combat = this.activeCombat();
    const session = this.activeSession();
    if (!combat || !session) return;

    this.stopInitiativePoll();
    const archive = formatCombatArchiveSummary(combat);
    const entry = createCombatHistoryEntry(combat);
    const nextPads = appendTextToFirstNotePad(ensureSessionPlayPads(session), archive);
    const combatHistory = [...(session.combatHistory ?? []), entry];
    this.patchSession(
      {
        activeCombat: null,
        playPads: nextPads,
        combatHistory,
      },
      { immediate: true },
    );
    this.resetFightStep();
    this.sessionView.set('resume');
    this.setFeedback('ok', 'Combat terminé — résumé ajouté aux notes et à l’historique.');
  }

  formatCombatHistoryDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  duplicateCombatantRow(combatantId: string): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const source = combat.combatants.find((c) => c.id === combatantId);
    if (!source) return;
    const copy = duplicateCombatant(source);
    this.patchCombat({
      ...combat,
      combatants: [...combat.combatants, copy],
    }, { immediate: true });
  }

  addCombatant(): void {
    this.addAllyCombatant();
  }

  /** Allié PNJ générique (CA 10) — pour un héros joueur, utiliser le sélecteur. */
  addAllyCombatant(): void {
    if (!this.activeSession()) {
        this.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.allyPickerOpen.set(false);
    const combat = this.activeCombat();
    if (!combat) {
      this.withReplaceCombatConfirm(() => {
        this.setActiveCombat(
          createActiveCombat(
            [createCombatant({ name: 'Allié', kind: 'npc', armorClass: 10, initiativeBonus: 0 })],
            { label: 'Combat' },
          ),
        );
      });
      return;
    }
    this.patchCombat({
      ...combat,
      combatants: [
        ...combat.combatants,
        createCombatant({ name: 'Allié', kind: 'npc', armorClass: 10, initiativeBonus: 0 }),
      ],
    }, { immediate: true });
  }

  /** Adversaire avec CA 10 (règles) — randomisable via le dé à côté du champ. */
  addEnemyCombatant(): void {
    if (!this.activeSession()) {
        this.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    const combat = this.activeCombat();
    if (!combat) {
      this.withReplaceCombatConfirm(() => {
        this.setActiveCombat(
          createActiveCombat(
            [
              createCombatant({
                name: 'Adversaire',
                kind: 'monster',
                armorClass: 10,
                initiativeBonus: 0,
              }),
            ],
            { label: 'Combat' },
          ),
        );
      });
      return;
    }
    this.patchCombat({
      ...combat,
      combatants: [
        ...combat.combatants,
        createCombatant({ name: 'Adversaire', kind: 'monster', armorClass: 10, initiativeBonus: 0 }),
      ],
    }, { immediate: true });
  }

  /** Randomise la CA autour de la base règles (10 + 0–8). */
  randomizeArmorClass(combatantId: string): void {
    const ac = 10 + rollDie(8) - 1; // 10..17
    this.updateCombatant(combatantId, { armorClass: ac }, { immediate: true });
  }

  removeCombatant(combatantId: string): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const target = combat.combatants.find((c) => c.id === combatantId);
    const label = target?.name?.trim() || 'ce combattant';
    const inSetup = resolveCombatFlowPhase(combat) === 'setup';
    if (inSetup) {
      this.doRemoveCombatant(combatantId);
      return;
    }
    this.askConfirm(
      'Retirer du combat',
      `Retirer ${label} du combat ?`,
      () => this.doRemoveCombatant(combatantId),
      'Retirer',
    );
  }

  private doRemoveCombatant(combatantId: string): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const combatants = combat.combatants.filter((c) => c.id !== combatantId);
    const turnOrderIds = combat.turnOrderIds?.filter((id) => id !== combatantId);
    const turnIndex = Math.min(combat.turnIndex, Math.max(0, combatants.length - 1));
    if (this.selectedTargetId() === combatantId) this.selectedTargetId.set(null);
    if (this.pendingInitCombatantId() === combatantId) this.pendingInitCombatantId.set(null);
    this.patchCombat({ ...combat, combatants, turnOrderIds, turnIndex }, { immediate: true });
  }

  updateCombatantConditions(combatantId: string, raw: string): void {
    const conditions = raw.trim()
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    this.updateCombatant(combatantId, { conditions });
  }

  /** Presets rapides pour le tracker (chips). */
  readonly commonConditions = [
    'à terre',
    'empoisonné',
    'inconscient',
    'entravé',
    'aveuglé',
    'charmé',
  ] as const;

  toggleCondition(combatantId: string, condition: string): void {
    const combat = this.activeCombat();
    if (!combat || !this.isDm()) return;
    const cb = combat.combatants.find((c) => c.id === combatantId);
    if (!cb) return;
    const next = new Set(cb.conditions ?? []);
    if (next.has(condition)) next.delete(condition);
    else next.add(condition);
    this.updateCombatant(combatantId, {
      conditions: next.size ? [...next] : undefined,
    });
  }

  removeCondition(combatantId: string, condition: string): void {
    const combat = this.activeCombat();
    if (!combat || !this.isDm()) return;
    const cb = combat.combatants.find((c) => c.id === combatantId);
    if (!cb?.conditions?.length) return;
    const conditions = cb.conditions.filter((c) => c !== condition);
    this.updateCombatant(combatantId, {
      conditions: conditions.length ? conditions : undefined,
    });
  }

  addCombatantAttack(combatantId: string): void {
    const combat = this.activeCombat();
    if (!combat || !this.isDm()) return;
    const combatants = combat.combatants.map((c) => {
      if (c.id !== combatantId) return c;
      const attacks = [
        ...(c.attacks ?? []),
        { name: 'Attaque', attackBonus: 0, damageDice: '1d6' },
      ];
      return { ...c, attacks };
    });
    this.patchCombat({ ...combat, combatants });
  }

  removeCombatantAttack(combatantId: string, index: number): void {
    const combat = this.activeCombat();
    if (!combat || !this.isDm()) return;
    const combatants = combat.combatants.map((c) => {
      if (c.id !== combatantId || !c.attacks?.length) return c;
      const attacks = c.attacks.filter((_, i) => i !== index);
      return { ...c, attacks: attacks.length ? attacks : undefined };
    });
    this.patchCombat({ ...combat, combatants });
  }

  patchCombatantAttack(
    combatantId: string,
    index: number,
    patch: Partial<CombatantAttack>,
  ): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const combatants = combat.combatants.map((c) => {
      if (c.id !== combatantId || !c.attacks?.length) return c;
      const attacks = c.attacks.map((a, i) => (i === index ? { ...a, ...patch } : a));
      return { ...c, attacks };
    });
    this.patchCombat({ ...combat, combatants });
  }

  updateCombatant(combatantId: string, patch: Partial<Combatant>, options?: { immediate?: boolean }): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const combatants = combat.combatants.map((c) =>
      c.id === combatantId ? { ...c, ...patch } : c,
    );
    this.patchCombat({ ...combat, combatants }, options);
  }

  updateCombatantHp(combatantId: string, raw: string | number): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const current = combat.combatants.find((c) => c.id === combatantId);
    if (!current) return;

    const currentHp = raw === '' || raw === undefined ? undefined : +raw;
    let defeated = current.defeated ?? false;
    if (currentHp !== undefined && currentHp <= 0) {
      defeated = true;
    } else if (currentHp !== undefined && currentHp > 0) {
      defeated = false;
    }

    const combatants = combat.combatants.map((c) => {
      if (c.id !== combatantId) return c;
      return {
        ...c,
        currentHp,
        defeated,
      };
    });

    this.applyCombatWithEncounterSync({ ...combat, combatants });
  }

  updateCombatantMaxHp(combatantId: string, raw: string | number): void {
    const maxHp = raw === '' || raw === undefined ? undefined : Math.max(0, +raw);
    const combat = this.activeCombat();
    if (!combat) return;
    const current = combat.combatants.find((c) => c.id === combatantId);
    if (!current) return;
    let currentHp = current.currentHp;
    if (maxHp != null && currentHp != null && currentHp > maxHp) currentHp = maxHp;
    this.updateCombatant(combatantId, { maxHp, currentHp }, { immediate: true });
  }

  markCombatantDead(combatantId: string): void {
    this.setCombatantDefeated(combatantId, true);
  }

  reviveCombatant(combatantId: string): void {
    this.setCombatantDefeated(combatantId, false);
  }

  private setCombatantDefeated(combatantId: string, defeated: boolean): void {
    const combat = this.activeCombat();
    if (!combat) return;

    const combatants = combat.combatants.map((c) => {
      if (c.id !== combatantId) return c;
      return {
        ...c,
        defeated,
        currentHp: defeated ? 0 : c.maxHp ?? c.currentHp,
      };
    });

    this.applyCombatWithEncounterSync({ ...combat, combatants });
  }

  rollInitiativeFor(combatantId: string): void {
    if (!this.isDm()) return;
    this.pendingInitCombatantId.set(combatantId);
  }

  onInitiativeDieRolled(combatantId: string, roll: number): void {
    this.updateCombatant(
      combatantId,
      { initiativeRoll: roll, playerSubmitted: false },
      { immediate: true },
    );
    this.pendingInitCombatantId.set(null);
    this.setFeedback('ok', `Initiative ${roll} pour ce combattant.`);
  }

  selectTarget(combatantId: string): void {
    const cb = this.combatTurnOrder().find((c) => c.id === combatantId);
    if (!cb || isCombatantDefeated(cb)) return;
    this.selectedTargetId.set(combatantId);
    if (this.fightStep() === 'pickTarget') {
      this.fightStep.set('toHit');
    }
  }

  setRollChoice(choice: RollChoice): void {
    this.rollChoice.set(choice);
  }

  adjustHp(combatantId: string, delta: number): void {
    if (!this.isDm()) return;
    const combat = this.activeCombat();
    if (!combat) return;
    const combatants = combat.combatants.map((c) =>
      c.id === combatantId ? applyHpDelta(c, delta) : c,
    );
    this.applyCombatWithEncounterSync({ ...combat, combatants });
  }

  resolveAttackWithDie(d20: number): void {
    const turn = this.currentTurn();
    const target = this.selectedTarget();
    if (!turn || !target || !this.canActOnTurn()) return;
    if (this.fightStep() !== 'toHit' && this.combatFlowPhase() === 'fight') return;
    this.shareDiceRoll(20, d20, turn.name || 'attaque');

    const attacks = turn.attacks ?? [];
    const atk = attacks[this.selectedAttackIndex()] ?? {
      name: 'Attaque',
      attackBonus: 0,
      damageDice: '1d6',
    };
    const resolution = resolveAttackRoll(d20, atk.attackBonus, target.armorClass);

    if (resolution.hit !== true) {
      const line = formatCombatLogLine({
        actor: turn.name || 'Sans nom',
        target: target.name || 'Cible',
        attackName: atk.name,
        d20: resolution.d20,
        total: resolution.total,
        ac: resolution.targetAc,
        hit: resolution.hit,
        damage: null,
      });
      if (this.isDm()) this.appendLog(line);
      else {
        this.persistPlayerAttack({
          actorId: turn.id,
          targetId: target.id,
          hit: false,
          damage: null,
          logLine: line,
        });
      }
      const hitMsg = resolution.fumble
        ? 'Échec critique'
        : resolution.hit === false
          ? 'Raté'
          : `Jet ${resolution.total} (pas de CA cible)`;
      this.setFeedback('ok', `${turn.name} → ${target.name} : ${hitMsg}`);
      if (resolution.fumble) softTablePulse('fumble');
      this.resetFightStep();
      return;
    }

    this.pendingHitTotal.set(resolution.total);
    const dice = atk.damageDice?.trim() || '1d6';
    this.pendingDamageDice.set(dice);
    this.fightStep.set('damage');
    const touchLabel = resolution.critical
      ? `Critique ! touche ${target.name}`
      : `touche ${target.name}`;
    this.setFeedback(
      'ok',
      `${turn.name} ${touchLabel} (${resolution.total} vs CA ${resolution.targetAc ?? '?'}) — lancez les dégâts.`,
    );
    if (resolution.critical) softTablePulse('crit');
  }

  resolveDamageWithDie(_ignored?: number): void {
    const turn = this.currentTurn();
    const target = this.selectedTarget();
    if (!turn || !target || !this.canActOnTurn()) return;
    if (this.fightStep() !== 'damage') return;

    const attacks = turn.attacks ?? [];
    const atk = attacks[this.selectedAttackIndex()] ?? {
      name: 'Attaque',
      attackBonus: 0,
      damageDice: '1d6',
    };
    const formula = this.pendingDamageDice() ?? atk.damageDice ?? '1d6';
    const damage =
      rollDamageTotal(formula, atk.damageBonus ?? 0) ??
      Math.max(1, (atk.damageBonus ?? 0) + rollDie(6));

    const hitTotal = this.pendingHitTotal() ?? 0;
    const line = formatCombatLogLine({
      actor: turn.name || 'Sans nom',
      target: target.name || 'Cible',
      attackName: atk.name,
      d20: hitTotal,
      total: hitTotal,
      ac: target.armorClass ?? null,
      hit: true,
      damage,
    });

    // Une seule écriture : éviter que appendLog (input encore stale) écrase les PV.
    if (this.isDm()) {
      const combat = this.activeCombat();
      const session = this.activeSession();
      const c = this.campaign();
      if (combat && session) {
        const combatants = combat.combatants.map((cb) =>
          cb.id === target.id ? applyHpDelta(cb, -damage) : cb,
        );
        const nextCombat = { ...combat, combatants };
        const encounters = syncEncountersFromCombatants(c.data.encounters, combatants);
        const sessions = (c.data.sessions ?? []).map((s) =>
          s.id === session.id
            ? {
                ...s,
                activeCombat: nextCombat,
                combatLog: appendCombatLog(s.combatLog, line),
              }
            : s,
        );
        this.saveData({ sessions, encounters });
      }
      this.setFeedback('ok', `${turn.name} → ${target.name} : ${damage} dégâts (${formula})`);
    } else {
      this.persistPlayerAttack({
        actorId: turn.id,
        targetId: target.id,
        hit: true,
        damage,
        logLine: line,
      });
      this.setFeedback('ok', `${turn.name} → ${target.name} : ${damage} dégâts (${formula})`);
    }
    this.resetFightStep();
  }

  private persistPlayerAttack(body: {
    actorId: string;
    targetId: string;
    hit: boolean;
    damage: number | null;
    logLine: string;
  }): void {
    const campaignId = this.campaign().id;
    this.campaigns
      .resolveCombatAttack(campaignId, {
        actorId: body.actorId,
        targetId: body.targetId,
        hit: body.hit,
        damage: body.damage,
        logLine: body.logLine,
      })
      .subscribe({
        next: () => {
          this.campaigns.get(campaignId).subscribe({
            next: (fresh) => this.campaignChange.emit(fresh),
            error: () => undefined,
          });
        },
        error: () =>
          this.setFeedback('err', 'Impossible d’enregistrer l’attaque — réessayez.', 6000),
      });
  }

  private appendLog(line: string): void {
    const session = this.activeSession();
    if (!session || !this.isDm()) return;
    this.patchSession(
      { combatLog: appendCombatLog(session.combatLog, line) },
      { immediate: true },
    );
  }

  nextTurn(): void {
    if (!this.isDm()) return;
    const combat = this.activeCombat();
    if (!combat) return;
    this.selectedTargetId.set(null);
    const patch = advanceTurn(combat, 1);
    this.patchCombat({ ...combat, ...patch }, { immediate: true });
    const next = currentTurnCombatant({ ...combat, ...patch });
    if (next?.name) {
      this.setFeedback('ok', `Tour de ${next.name}`, { ttlMs: 2200 });
      softTablePulse('turn');
    }
    queueMicrotask(() => this.focusNextTurnControl());
  }

  /** Focus tour suivant après avance (Space / bouton) — a11y. */
  focusNextTurnControl(): void {
    if (typeof document === 'undefined') return;
    this.scrollToTurnBanner();
    const btn = document.querySelector(
      '[data-testid="play-next-turn"]',
    ) as HTMLElement | null;
    btn?.focus({ preventScroll: true });
  }

  prevTurn(): void {
    if (!this.isDm()) return;
    const combat = this.activeCombat();
    if (!combat) return;
    this.selectedTargetId.set(null);
    const patch = advanceTurn(combat, -1);
    this.patchCombat({ ...combat, ...patch }, { immediate: true });
  }

  openInitiativeCollection(): void {
    const combat = this.activeCombat();
    if (!combat) return;
    this.seenInitiativeSubmissions = new Set(
      combat.combatants.filter((c) => c.kind === 'player' && c.playerSubmitted).map((c) => c.id),
    );
    this.patchCombat(
      {
        ...combat,
        collectingInitiative: true,
        initiativeCode: combat.initiativeCode || createInitiativeCode(),
      },
      { immediate: true },
    );
    this.startInitiativePoll();
  }

  closeInitiativeCollection(): void {
    const combat = this.activeCombat();
    if (!combat) return;
    this.stopInitiativePoll();
    this.patchCombat(
      {
        ...combat,
        collectingInitiative: false,
        turnOrderIds: freezeTurnOrderIds(combat),
        turnIndex: 0,
      },
      { immediate: true },
    );
  }

  private startInitiativePoll(): void {
    this.stopInitiativePoll();
    const campaignId = this.campaign().id;
    this.initiativeLiveSub = this.live.updates(campaignId).subscribe((evt) => {
      if (evt.reason === 'initiative' || evt.reason === 'combat' || evt.reason === 'campaign') {
        this.pollInitiativeRolls();
      }
    });
    const ms = this.live.fallbackPollMs(1_500, 8_000);
    this.initiativePollTimer = setInterval(() => {
      if (!this.activeCombat()?.collectingInitiative) {
        this.stopInitiativePoll();
        return;
      }
      this.pollInitiativeRolls();
    }, ms);
  }

  private stopInitiativePoll(): void {
    this.initiativeLiveSub?.unsubscribe();
    this.initiativeLiveSub = null;
    if (!this.initiativePollTimer) return;
    clearInterval(this.initiativePollTimer);
    this.initiativePollTimer = null;
  }

  initiativeShareUrl(): string {
    const c = this.campaign();
    const combat = this.activeCombat();
    if (!combat?.initiativeCode) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/campaigns/${c.id}/init?code=${combat.initiativeCode}`;
  }

  /** QR via service public (soirée IRL / téléphone joueurs). */
  initiativeQrUrl(): string {
    const url = this.initiativeShareUrl();
    if (!url) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`;
  }

  copyInitiativeLink(): void {
    const url = this.initiativeShareUrl();
    if (!url) {
      this.setFeedback('err', 'Aucun lien à copier — ouvrez d’abord la collecte.');
      return;
    }
    if (!navigator.clipboard?.writeText) {
      this.setFeedback('err', 'Presse-papiers indisponible dans ce navigateur.');
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => this.setFeedback('ok', 'Lien d’initiative copié.'),
      () => this.setFeedback('err', 'Impossible de copier le lien.'),
    );
  }

  submittedPlayerCount(): number {
    const combat = this.activeCombat();
    if (!combat) return 0;
    return combat.combatants.filter((c) => c.kind === 'player' && c.playerSubmitted).length;
  }

  playerCombatantCount(): number {
    const combat = this.activeCombat();
    if (!combat) return 0;
    return combat.combatants.filter((c) => c.kind === 'player').length;
  }

  isCurrentTurn(combatantId: string): boolean {
    return this.currentTurn()?.id === combatantId;
  }

  canMoveCombatantTurn(combatantId: string, direction: -1 | 1): boolean {
    if (!this.canEditTurnOrder()) return false;
    const combat = this.activeCombat();
    if (!combat) return false;
    return canReorderCombatantInTurnOrder(combat, combatantId, direction);
  }

  moveCombatantTurn(combatantId: string, direction: -1 | 1): void {
    if (!this.canEditTurnOrder()) return;
    const combat = this.activeCombat();
    if (!combat) return;
    const patch = reorderCombatantInTurnOrder(combat, combatantId, direction);
    if (!patch.turnOrderIds) return;
    this.patchCombat({ ...combat, ...patch }, { immediate: true });
  }

  dropCombatantAtTurnIndex(combatantId: string, toIndex: number): void {
    if (!this.canEditTurnOrder()) return;
    const combat = this.activeCombat();
    if (!combat) return;
    const patch = moveCombatantToTurnIndex(combat, combatantId, toIndex);
    if (!patch.turnOrderIds) return;
    this.patchCombat({ ...combat, ...patch }, { immediate: true });
  }

  onTurnOrderDragStart(ev: PointerEvent, combatantId: string, fromIndex: number): void {
    if (!this.canEditTurnOrder() || ev.button !== 0) return;
    ev.preventDefault();
    const target = ev.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(ev.pointerId);
    this.turnOrderDrag = { combatantId, fromIndex };
  }

  onTurnOrderDragMove(ev: PointerEvent): void {
    const drag = this.turnOrderDrag;
    if (!drag) return;
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const row = el?.closest?.('[data-turn-order-index]') as HTMLElement | null;
    if (!row) return;
    const toIndex = Number(row.dataset['turnOrderIndex']);
    if (!Number.isFinite(toIndex) || toIndex === drag.fromIndex) return;
    this.dropCombatantAtTurnIndex(drag.combatantId, toIndex);
    this.turnOrderDrag = { combatantId: drag.combatantId, fromIndex: toIndex };
  }

  onTurnOrderDragEnd(): void {
    this.turnOrderDrag = null;
  }

  isTurnOrderDragging(combatantId: string): boolean {
    return this.turnOrderDrag?.combatantId === combatantId;
  }

  markDefeated(encounterId: string, creatureIndex: number): void {
    const c = this.campaign();
    if (!c.isOwner) return;

    const combat = this.activeCombat();
    if (combat?.encounterId === encounterId) {
      const target = combat.combatants.find(
        (cb) =>
          cb.encounterLink?.encounterId === encounterId &&
          cb.encounterLink.creatureIndex === creatureIndex &&
          !isCombatantDefeated(cb),
      );
      if (target) {
        this.setCombatantDefeated(target.id, true);
        return;
      }
    }

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
    if (!c.isOwner) return;

    const combat = this.activeCombat();
    if (combat?.encounterId === encounterId) {
      const defeated = combat.combatants.filter(
        (cb) =>
          cb.encounterLink?.encounterId === encounterId &&
          cb.encounterLink.creatureIndex === creatureIndex &&
          isCombatantDefeated(cb),
      );
      const target = defeated[defeated.length - 1];
      if (target) {
        this.setCombatantDefeated(target.id, false);
        return;
      }
    }

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
    if (!c.isOwner || encounter.xpAwarded) {
      this.setFeedback('err', 'XP déjà distribuée ou action impossible.');
      return;
    }
    if (this.awardingXpId()) return;
    const xpGained = encounterTotalXp(encounter);
    if (xpGained <= 0) {
      this.setFeedback('err', 'Aucun XP à distribuer pour cette rencontre.');
      return;
    }

    const approved = this.players().filter((p) => p.proposalStatus === 'approved');
    if (approved.length === 0) {
      this.setFeedback('err', 'Aucun joueur avec personnage approuvé.');
      return;
    }

    const share = Math.floor(xpGained / approved.length);
    if (share <= 0) {
      this.setFeedback('err', 'Part d’XP trop faible à répartir.');
      return;
    }

    this.awardingXpId.set(encounter.id);
    let completed = 0;
    let failed = 0;
    for (const player of approved) {
      this.campaigns.awardXp(c.id, player.id, share).subscribe({
        next: () => {
          completed++;
          if (completed + failed === approved.length) {
            this.awardingXpId.set(null);
            if (failed === 0) {
              const latest = this.campaign();
              const encounters = (latest.data.encounters ?? []).map((e) =>
                e.id === encounter.id ? { ...e, xpAwarded: true } : e,
              );
              this.saveData({ encounters });
              this.setFeedback(
                'ok',
                `+${share} XP × ${approved.length} joueur(s) (${xpGained} XP total).`,
              );
            } else {
              this.setFeedback(
                'err',
                `XP partiellement envoyée (${completed}/${approved.length}). Réessayez.`,
              );
            }
          }
        },
        error: () => {
          failed++;
          if (completed + failed === approved.length) {
            this.awardingXpId.set(null);
            this.setFeedback(
              'err',
              `Échec XP (${completed}/${approved.length} OK). Vérifiez la connexion.`,
            );
          }
        },
      });
    }
  }

  private combatantFromCharacter(character: Character, memberUserId?: string): Combatant {
    const maxHp =
      typeof character.vitality?.hitPointsMax === 'number'
        ? character.vitality.hitPointsMax
        : undefined;
    const armorClass =
      typeof character.defense?.armorClass === 'number'
        ? character.defense.armorClass
        : undefined;
    return createCombatant({
      name: character.name || 'Sans nom',
      kind: 'player',
      initiativeBonus: character.initiative ?? 0,
      maxHp,
      currentHp: maxHp,
      armorClass,
      attacks: snapshotAttacksFromCharacter(character.attacks),
      characterId: (character as { id?: string }).id ?? null,
      memberUserId: memberUserId ?? null,
    });
  }

  private withReplaceCombatConfirm(then: () => void): void {
    if (!this.activeCombat()) {
      then();
      return;
    }
    this.askConfirm(
      'Remplacer le combat',
      'Un combat est déjà en cours. Le remplacer ?',
      then,
      'Remplacer',
    );
  }

  private setActiveCombat(combat: ActiveCombat): void {
    this.patchSession({ activeCombat: combat }, { immediate: true });
  }

  private patchCombat(combat: ActiveCombat, options?: { immediate?: boolean }): void {
    this.patchSession({ activeCombat: combat }, options);
  }

  /** Sauvegarde combat + sync kills rencontre en une requête. */
  private applyCombatWithEncounterSync(combat: ActiveCombat): void {
    const c = this.campaign();
    const session = this.activeSession();
    if (!session) return;

    const encounters = syncEncountersFromCombatants(c.data.encounters, combat.combatants);
    const sessions = (c.data.sessions ?? []).map((s) =>
      s.id === session.id ? { ...s, activeCombat: combat } : s,
    );
    const data = { ...c.data, sessions, encounters };
    this.patchCampaign(data);
    this.persist(c.title, data);
  }

  private patchSession(
    patch: Partial<CampaignSession>,
    options?: { immediate?: boolean },
  ): void {
    const session = this.activeSession();
    if (!session) return;
    this.updateSession(session.id, patch, options);
  }

  updateSession(sessionId: string, patch: Partial<CampaignSession>, options?: { immediate?: boolean }): void {
    const c = this.campaign();
    if (!c.isOwner) return;
    const sessions = (c.data.sessions ?? []).map((s) =>
      s.id === sessionId ? { ...s, ...patch } : s,
    );
    this.patchCampaign({ ...c.data, sessions });

    if (options?.immediate) {
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
      this.saveData({ sessions: latest.data.sessions ?? [] });
    }, 700);
  }

  private flushSessionSave(): void {
    if (!this.sessionSaveTimer) return;
    clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = null;
    const latest = this.campaign();
    if (!latest.isOwner) return;
    this.saveData({ sessions: latest.data.sessions ?? [] });
  }

  private patchCampaign(data: CampaignData): void {
    const c = this.campaign();
    const next = { ...c, data };
    this.playStore.bindCampaign(next);
    this.campaignChange.emit(next);
  }

  private saveData(patch: Partial<CampaignData>, onSuccess?: () => void): void {
    const c = this.campaign();
    const data = { ...c.data, ...patch };
    this.patchCampaign(data);
    this.persist(c.title, data, onSuccess);
  }

  private persist(title: string, data: CampaignData, onSuccess?: () => void): void {
    const c = this.campaign();
    const campaignId = c.id;
    const seq = ++this.persistSeq;
    this.saving.set(true);
    const payload = stripTableChatForPersist(data);

    this.persistTail = this.persistTail
      .catch(() => undefined)
      .then(async () => {
        try {
          const summary = await firstValueFrom(this.campaigns.update(campaignId, title, payload));
          // Ne pas réappliquer un persist périmé (une sauvegarde plus récente est déjà en cours / faite).
          if (seq !== this.persistSeq) return;
          // Ne jamais réécrire `data` depuis le payload en vol : le MJ local est source de vérité
          // (évite qu’un PUT « combat vide » écrase alliés/adversaires ajoutés entre-temps).
          const current = this.campaign();
          this.campaignChange.emit({
            ...current,
            updatedAt: summary.updatedAt,
          });
          this.saving.set(false);
          onSuccess?.();
        } catch {
          if (seq === this.persistSeq) {
            this.saving.set(false);
            this.setFeedback('err', 'Sauvegarde échouée — vérifiez la connexion.', 6000);
          }
        }
      });
  }

  /** Poll jets joueurs sans écraser notes / timeline locales. */
  private pollInitiativeRolls(): void {
    const c = this.campaign();
    this.campaigns.get(c.id).subscribe({
      next: (remote) => {
        const merged = mergeRemoteLiveTable(this.campaign(), remote);
        this.campaignChange.emit(merged);
        const session = merged.data.sessions?.find((s) => s.id === merged.data.activeSessionId);
        const combat = session?.activeCombat;
        if (!combat?.collectingInitiative) return;
        this.notifyNewInitiativeRolls(combat);
        const players = combat.combatants.filter((cb) => cb.kind === 'player');
        if (players.length > 0 && players.every((cb) => cb.playerSubmitted)) {
          this.setFeedback('ok', 'Tous les jets d’initiative reçus — vous pouvez ouvrir le combat.');
          this.closeInitiativeCollection();
        }
      },
    });
  }

  private notifyNewInitiativeRolls(combat: ActiveCombat): void {
    for (const cb of combat.combatants) {
      if (cb.kind !== 'player' || !cb.playerSubmitted || this.seenInitiativeSubmissions.has(cb.id)) {
        continue;
      }
      this.seenInitiativeSubmissions.add(cb.id);
      const bonus = cb.initiativeBonus ?? 0;
      const bonusLabel = bonus >= 0 ? `+${bonus}` : `${bonus}`;
      const total = combatantInitiativeTotal(cb);
      const who = this.playerDisplayName(cb) || cb.name || 'Joueur';
      this.setFeedback(
        'ok',
        total != null
          ? `${who} a envoyé son init : ${cb.initiativeRoll}${bonusLabel} = ${total}`
          : `${who} a envoyé son jet d’initiative.`,
      );
    }
  }

  private reload(): void {
    const c = this.campaign();
    this.campaigns.get(c.id).subscribe({
      next: (updated) => {
        this.campaignChange.emit(updated);
        const session = updated.data.sessions?.find(
          (s) => s.id === updated.data.activeSessionId,
        );
        const combat = session?.activeCombat;
        if (!combat?.collectingInitiative) return;
        this.notifyNewInitiativeRolls(combat);
        const players = combat.combatants.filter((cb) => cb.kind === 'player');
        if (players.length > 0 && players.every((cb) => cb.playerSubmitted)) {
          this.setFeedback('ok', 'Tous les jets d’initiative reçus — vous pouvez ouvrir le combat.');
          this.closeInitiativeCollection();
        }
      },
    });
  }

  toggleZenMode(): void {
    this.zenMode.update((z) => {
      const next = !z;
      writeZenMode(next);
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

  runNextActionCta(): void {
    const action = this.nextAction();
    if (!action?.cta) return;
    switch (action.cta) {
      case 'propose':
        this.openProposeOverlay();
        break;
      case 'ready':
        this.markMyselfReady();
        break;
      case 'init':
        void this.router.navigate(['/campaigns', this.campaign().id, 'init'], {
          queryParams: this.activeCombat()?.initiativeCode
            ? { code: this.activeCombat()!.initiativeCode }
            : undefined,
        });
        break;
      case 'handouts':
        this.openHandoutsOverlay();
        break;
      case 'combat':
        if (action.kind === 'open_combat' && this.canEnterFight()) {
          this.openFightPhase();
        } else if (action.kind === 'continue_initiative' && this.canContinueToInitiative()) {
          this.continueToInitiativePhase();
        } else {
          this.enterCombatFlow();
        }
        break;
      case 'secrets':
        this.openSecretPanel();
        break;
      case 'notes':
        this.openSessionNotes();
        break;
    }
  }

  markMyselfReady(): void {
    const me = this.auth.user()?.id;
    if (!me || this.isPlayerTableReady(me)) return;
    this.togglePlayerTableReady(me);
    this.setFeedback('ok', 'Vous êtes marqué prêt à la table.');
  }

  scrollToTurnBanner(): void {
    if (typeof document === 'undefined') return;
    const el = document.querySelector('[data-testid="play-turn-banner"]');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Mobile : une seule surface d’init — scroll vers le bloc embarqué (pas /init). */
  scrollToEmbeddedInitiative(): void {
    if (typeof document === 'undefined') return;
    if (this.isDm()) this.sessionView.set('combat');
    const el = document.getElementById('play-embedded-initiative');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (el instanceof HTMLElement) {
      el.focus({ preventScroll: true });
    }
  }

  pinTableMessage(body: string): void {
    if (!this.isDm()) return;
    const session = this.activeSession();
    if (!session) return;
    const patch = applyTablePin(session, body);
    if (!patch.tablePin) return;
    this.patchSession(patch, { immediate: true });
    this.setFeedback('ok', 'Message épinglé en haut du fil.');
  }

  clearTablePin(): void {
    if (!this.isDm()) return;
    const session = this.activeSession();
    if (!session) return;
    this.patchSession(clearTablePinState(session), { immediate: true });
  }

  restoreTablePin(body: string): void {
    this.pinTableMessage(body);
  }

  startSceneTimer(minutes: number, label = 'Scène'): void {
    if (!this.isDm()) return;
    const sec = Math.max(1, Math.round(minutes * 60));
    const endsAtIso = new Date(Date.now() + sec * 1000).toISOString();
    this.patchSession(
      { sceneTimer: { label, endsAtIso, pausedRemainingSec: null } },
      { immediate: true },
    );
    this.ensureSceneTimerTick();
  }

  toggleSceneTimerPause(): void {
    if (!this.isDm()) return;
    const t = this.activeSession()?.sceneTimer;
    if (!t) return;
    if (t.pausedRemainingSec != null && t.pausedRemainingSec >= 0) {
      const endsAtIso = new Date(Date.now() + t.pausedRemainingSec * 1000).toISOString();
      this.patchSession(
        { sceneTimer: { label: t.label, endsAtIso, pausedRemainingSec: null } },
        { immediate: true },
      );
    } else {
      const rem = Math.max(0, Math.ceil((Date.parse(t.endsAtIso) - Date.now()) / 1000));
      this.patchSession(
        {
          sceneTimer: {
            label: t.label,
            endsAtIso: t.endsAtIso,
            pausedRemainingSec: rem,
          },
        },
        { immediate: true },
      );
    }
  }

  stopSceneTimer(): void {
    if (!this.isDm()) return;
    this.clearSceneTimerTick();
    this.patchSession({ sceneTimer: null }, { immediate: true });
    this.sceneTimerSeconds.set(null);
    this.sceneTimerPaused.set(false);
  }

  private hydrateSceneTimer(
    timer: CampaignSession['sceneTimer'] | null | undefined,
  ): void {
    if (!timer?.endsAtIso && timer?.pausedRemainingSec == null) {
      this.clearSceneTimerTick();
      this.sceneTimerSeconds.set(null);
      this.sceneTimerPaused.set(false);
      return;
    }
    this.sceneTimerLabel.set(timer.label || 'Scène');
    if (timer.pausedRemainingSec != null) {
      this.sceneTimerPaused.set(true);
      this.sceneTimerSeconds.set(Math.max(0, timer.pausedRemainingSec));
      this.clearSceneTimerTick();
      return;
    }
    this.sceneTimerPaused.set(false);
    const rem = Math.max(0, Math.ceil((Date.parse(timer.endsAtIso) - Date.now()) / 1000));
    this.sceneTimerSeconds.set(rem);
    if (rem <= 0) {
      this.clearSceneTimerTick();
      return;
    }
    this.ensureSceneTimerTick();
  }

  private ensureSceneTimerTick(): void {
    if (this.sceneTimerHandle) return;
    this.sceneTimerHandle = setInterval(() => {
      this.sceneTimerTick.update((n) => n + 1);
      const t = this.activeSession()?.sceneTimer;
      if (!t || t.pausedRemainingSec != null) return;
      const rem = Math.max(0, Math.ceil((Date.parse(t.endsAtIso) - Date.now()) / 1000));
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

  /** Macros MJ 1 clic (#10). */
  runTableMacro(kind: 'perception' | 'next_turn' | 'end_combat'): void {
    if (!this.isDm()) return;
    if (kind === 'perception') {
      const r = rollDie(20);
      this.shareDiceRoll(20, r, 'perception groupe');
      this.setFeedback('ok', `Perception groupe — d20 → ${r}`);
      softTablePulse('dice');
      return;
    }
    if (kind === 'next_turn') {
      if (this.combatFlowPhase() !== 'fight') {
        this.setFeedback('err', 'Ouvrez d’abord le combat pour avancer le tour.');
        return;
      }
      this.nextTurn();
      return;
    }
    if (kind === 'end_combat') {
      if (!this.activeCombat()) {
        this.setFeedback('err', 'Aucun combat actif.');
        return;
      }
      this.endCombat();
    }
  }
}

const ZEN_STORAGE_KEY = 'dragons_play_zen_mode';

function readZenMode(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(ZEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeZenMode(on: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (on) localStorage.setItem(ZEN_STORAGE_KEY, '1');
    else localStorage.removeItem(ZEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
