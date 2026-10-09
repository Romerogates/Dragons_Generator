import { computed, inject, Injectable, signal, type InputSignal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import type { InitiativeBoard } from '@core/services/campaign-cloud.service';
import { CREATURE_ROLE_LABELS } from '@core/models/Story/story';
import {
  CampaignMember,
  CampaignSessionMode,
  Combatant,
  CombatantAttack,
  encounterPendingXp,
  encounterTotalXp,
  HANDOUT_KIND_LABELS,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';
import {
  COMBATANT_KIND_LABELS,
  canAdvanceFromSetup,
  canOpenFightPhase,
  combatantInitiativeTotal,
  currentTurnCombatant,
  isCombatantDefeated,
  resolveCombatFlowPhase,
  sortedTurnOrder,
  type CombatFlowPhase,
} from '@core/utils/combat-tracker.util';
import { isAllyCombatant, isEnemyCombatant } from '@core/utils/combat-action.util';
import { resolveRollPolicy, type RollChoice } from '@core/utils/combat-roll.util';
import {
  resolvePlayNextAction,
  type PlayNextAction,
} from '@core/utils/play-next-action.util';
import {
  normalizeSessionMode,
  sessionModeHint,
  sessionModeLabel,
} from '../campaign-detail/campaign-session.util';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';
import { PlayTableShellService } from './play-table-shell.service';
import { PlayImportService } from './play-import.service';
import {
  PLAY_SESSION_TABS,
  canActOnCombatTurn,
  combatantNeedsHp as combatantMissingHp,
  combatantNeedsInit as combatantMissingInit,
  compactPlayerRoster,
  continueInitiativeHint as continueInitiativeHintText,
  creatureHasMjSecretNotes,
  formatPlaySessionDate,
  nextPlannedSession,
  openFightHint as openFightHintText,
  playerNeedsInitiative,
  resolveHeroProposalStatus,
} from '@core/utils/play-table.util';
import type { PlayFightStep } from '../play-combat-flow/play-combat-host';

/**
 * État dérivé de la table (computeds). Pas de persist HTTP ici.
 */
@Injectable()
export class PlayCombatState {
  private readonly auth = inject(AuthService);
  private readonly playStore = inject(CampaignPlaySessionStore);
  private readonly shell = inject(PlayTableShellService);
  private readonly playImport = inject(PlayImportService);

  campaign!: InputSignal<CampaignDetailModel>;
  fullscreen!: InputSignal<boolean>;

  readonly rollChoice = signal<RollChoice>('dice');
  readonly selectedTargetId = signal<string | null>(null);
  readonly selectedAttackIndex = signal(0);
  readonly hpAdjustAmount = signal(5);
  readonly pendingInitCombatantId = signal<string | null>(null);
  readonly fightStep = signal<PlayFightStep>('menu');
  readonly pendingHitTotal = signal<number | null>(null);
  readonly pendingDamageDice = signal<string | null>(null);
  readonly playerRosterExpanded = signal(false);

  readonly sessionView = this.shell.sessionView;
  readonly sessionTabs = PLAY_SESSION_TABS;
  readonly advancedToolsOpen = this.shell.advancedToolsOpen;
  readonly zenMode = this.shell.zenMode;
  readonly sceneTimerDisplay = this.shell.sceneTimerDisplay;

  bind(
    campaign: InputSignal<CampaignDetailModel>,
    fullscreen: InputSignal<boolean>,
  ): void {
    this.campaign = campaign;
    this.fullscreen = fullscreen;
  }

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

  readonly canEditTurnOrder = computed(() => {
    const combat = this.activeCombat();
    return (
      this.isDm() &&
      this.combatFlowPhase() === 'fight' &&
      !!combat?.turnOrderIds?.length &&
      this.combatTurnOrder().length > 1
    );
  });

  readonly secretCreatureCards = computed(() => {
    const creatures = this.campaign().data.creatures ?? [];
    return creatures.filter((cr) => creatureHasMjSecretNotes(cr));
  });

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
      playerNeedsInit: playerNeedsInitiative(this.myCombatant()),
      currentTurnName: this.currentTurn()?.name?.trim() || null,
      publishedHandoutCount: this.publishedHandouts().length,
    });
  });

  readonly continueInitiativeHint = computed(() =>
    continueInitiativeHintText(
      this.canContinueToInitiative(),
      this.allyCombatants().length,
      this.enemyCombatants().length,
    ),
  );

  readonly openFightHint = computed(() =>
    openFightHintText(this.canEnterFight(), this.combatMissingInitCount()),
  );

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

  readonly myCombatant = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return null;
    return this.combatTurnOrder().find((c) => c.memberUserId === userId) ?? null;
  });

  readonly isMyTurn = computed(() => {
    const turn = this.currentTurn();
    const mine = this.myCombatant();
    return !!turn && !!mine && turn.id === mine.id;
  });

  readonly canActOnTurn = computed(() =>
    canActOnCombatTurn(this.isSpectator(), this.isDm(), !!this.currentTurn(), this.isMyTurn()),
  );

  readonly selectedTarget = computed(() => {
    const id = this.selectedTargetId();
    if (!id) return null;
    return this.combatTurnOrder().find((c) => c.id === id) ?? null;
  });

  readonly currentTurnAttacks = computed((): CombatantAttack[] => {
    const turn = this.currentTurn();
    return turn?.attacks?.length ? turn.attacks : [];
  });

  readonly nextPlannedSession = computed(() =>
    nextPlannedSession(this.campaign().data.sessions ?? []),
  );

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

  readonly myPlayerMember = computed(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return null;
    return this.players().find((p) => p.userId === userId) ?? null;
  });

  readonly myApprovedMember = computed(() => {
    const mine = this.myPlayerMember();
    if (!mine || mine.proposalStatus !== 'approved' || !mine.approvedCharacterId) return null;
    return mine;
  });

  readonly myHeroProposalStatus = computed(() => resolveHeroProposalStatus(this.myPlayerMember()));

  readonly playerOverlay = this.playStore.playerOverlay;
  readonly selectedHandoutId = this.playStore.selectedHandoutId;
  readonly myCharacters = this.playStore.myCharacters;
  readonly myCharactersLoading = this.playStore.myCharactersLoading;
  readonly proposeBusyId = this.playStore.proposeBusyId;
  readonly handoutKindLabels = HANDOUT_KIND_LABELS;
  readonly publishedHandouts = this.playStore.publishedHandouts;
  readonly selectedHandout = this.playStore.selectedHandout;
  readonly sheetLoadingId = this.playImport.sheetLoadingId;
  readonly awardingXpId = this.playStore.awardingXpId;
  readonly saving = this.playStore.saving;
  readonly importingParty = this.playImport.importingParty;
  readonly allyPickerOpen = this.playImport.allyPickerOpen;
  readonly enemyPickerOpen = this.playImport.enemyPickerOpen;
  readonly campaignAllyPickerOpen = this.playImport.campaignAllyPickerOpen;
  readonly importingAllyId = this.playImport.importingAllyId;
  readonly importingCreatureId = this.playImport.importingCreatureId;
  readonly codexCreatureSearch = this.playImport.codexCreatureSearch;
  readonly codexCreaturesLoading = this.playImport.codexCreaturesLoading;
  readonly filteredCodexCreatures = this.playImport.filteredCodexCreatures;

  readonly availablePlayerAllies = computed(() => {
    const inCombat = new Set(
      (this.activeCombat()?.combatants ?? [])
        .map((c) => c.memberUserId)
        .filter((id): id is string => !!id),
    );
    return this.approvedPlayers().filter((p) => !inCombat.has(p.userId));
  });

  readonly playerRosterLines = computed(() =>
    compactPlayerRoster(this.combatTurnOrder(), {
      isDm: this.isDm(),
      expanded: this.playerRosterExpanded(),
      turnId: this.currentTurn()?.id,
      myId: this.myCombatant()?.id,
    }),
  );

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

  readonly encounterTotalXp = encounterTotalXp;
  readonly encounterPendingXp = encounterPendingXp;
  readonly combatantInitiativeTotal = combatantInitiativeTotal;
  readonly combatantKindLabels = COMBATANT_KIND_LABELS;
  readonly roleLabels = CREATURE_ROLE_LABELS;
  readonly isCombatantDefeated = isCombatantDefeated;
  readonly sessionModeLabel = sessionModeLabel;
  readonly sessionModeHint = sessionModeHint;

  isPlayerTableReady(userId: string): boolean {
    return (this.activeSession()?.tableReadyUserIds ?? []).includes(userId);
  }

  combatantNeedsInit(cb: Combatant): boolean {
    return combatantMissingInit(cb);
  }

  combatantNeedsHp(cb: Combatant): boolean {
    return combatantMissingHp(cb);
  }

  isCurrentTurn(combatantId: string): boolean {
    return this.currentTurn()?.id === combatantId;
  }

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
    return this.approvedPlayers().find((m) => m.userId === userId) ?? null;
  }

  formatSessionDate(iso: string): string {
    return formatPlaySessionDate(iso);
  }

  formatCombatHistoryDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
