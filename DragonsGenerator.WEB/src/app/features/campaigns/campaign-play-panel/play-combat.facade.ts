import { effect, inject, Injectable, untracked, type InputSignal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import type { CampaignDetail as CampaignDetailModel } from '@core/models/Campaign/campaign';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';
import { PlayTableShellService } from './play-table-shell.service';
import { PlayImportService } from './play-import.service';
import { PlayCombatState } from './play-combat-state.service';
import { PlayInitiativeService } from './play-initiative.service';
import { PlayTableActionsService } from './play-table-actions.service';
import type { PlayTableChat } from '../play-table-chat/play-table-chat';
import { PlayCombatController } from '../play-combat-flow/play-combat-controller';
import type { PlayCombatHost } from '../play-combat-flow/play-combat-host';

/**
 * Host combat : câble store / shell / import / état / initiative / actions.
 * Persist = CampaignPlaySessionStore uniquement.
 */
@Injectable()
export class PlayCombatFacade implements PlayCombatHost {
  private readonly live = inject(CampaignLiveService);
  private readonly playStore = inject(CampaignPlaySessionStore);
  readonly shell = inject(PlayTableShellService);
  readonly playImport = inject(PlayImportService);
  readonly state = inject(PlayCombatState);
  readonly initiative = inject(PlayInitiativeService);
  readonly actions = inject(PlayTableActionsService);

  private storeSub: Subscription | null = null;
  private tableChat: () => PlayTableChat | undefined = () => undefined;
  private emitCampaign: (c: CampaignDetailModel) => void = () => undefined;
  private combatCtrl!: PlayCombatController;
  private lastBoundSessionId: string | null | undefined = undefined;
  private readonly onPageHide = (): void => this.flushPendingSessionWork();

  private campaign!: InputSignal<CampaignDetailModel>;
  private fullscreen!: InputSignal<boolean>;

  readonly liveConnected = this.live.connected;

  get ctrl(): PlayCombatController {
    return this.combatCtrl;
  }

  bind(opts: {
    campaign: InputSignal<CampaignDetailModel>;
    fullscreen: InputSignal<boolean>;
    emitCampaign: (c: CampaignDetailModel) => void;
    tableChat: () => PlayTableChat | undefined;
  }): void {
    this.campaign = opts.campaign;
    this.fullscreen = opts.fullscreen;
    this.emitCampaign = opts.emitCampaign;
    this.tableChat = opts.tableChat;
    this.state.bind(opts.campaign, opts.fullscreen);
    this.boot();
  }

  private boot(): void {
    this.combatCtrl = new PlayCombatController(this.playStore, {
      fightStep: this.state.fightStep,
      selectedAttackIndex: this.state.selectedAttackIndex,
      selectedTargetId: this.state.selectedTargetId,
      pendingInitCombatantId: this.state.pendingInitCombatantId,
      pendingHitTotal: this.state.pendingHitTotal,
      pendingDamageDice: this.state.pendingDamageDice,
      sessionView: this.state.sessionView,
      rollChoice: this.state.rollChoice,
      allyPickerOpen: this.state.allyPickerOpen,
      enemyPickerOpen: this.state.enemyPickerOpen,
      selectedTarget: () => this.state.selectedTarget(),
      canActOnTurn: () => this.state.canActOnTurn(),
      canEditTurnOrder: () => this.state.canEditTurnOrder(),
      dungeonMaps: () => this.campaign().data.dungeonMaps ?? [],
      setFeedback: (kind, text, opts) => this.shell.setFeedback(kind, text, opts),
      askConfirm: (title, body, onConfirm, label) =>
        this.shell.askConfirm(title, body, onConfirm, label),
      shareDiceRoll: (faces, result, label) => this.actions.shareDiceRoll(faces, result, label),
      persistPlayerAttack: (body) => this.initiative.persistPlayerAttack(body),
      startInitiativePoll: () => this.initiative.startInitiativePoll(),
      stopInitiativePoll: () => this.initiative.stopInitiativePoll(),
      rememberInitSubmissions: (ids) => this.initiative.rememberInitSubmissions(ids),
      focusNextTurnControl: () => this.actions.focusNextTurnControl(),
    });
    this.shell.configure({
      campaign: () => this.campaign(),
      fullscreen: () => this.fullscreen(),
      isDm: () => this.state.isDm(),
      activeSession: () => this.state.activeSession(),
      resetFightStep: () => this.combatCtrl.resetFightStep(),
      flushSession: () => this.flushPendingSessionWork(),
    });
    this.initiative.configure({
      emitCampaign: (c) => this.emitCampaign(c),
      closeInitiativeCollection: () => this.combatCtrl.closeInitiativeCollection(),
    });
    this.actions.configure({
      combatCtrl: this.combatCtrl,
      tableChat: () => this.tableChat(),
    });
    this.playImport.configure({
      campaign: () => this.campaign(),
      isDm: () => this.state.isDm(),
      activeCombat: () => this.state.activeCombat(),
      activeSession: () => this.state.activeSession(),
      approvedPlayers: () => this.state.approvedPlayers(),
      setFeedback: (kind, text, opts) => this.shell.setFeedback(kind, text, opts),
      clearFeedback: () => this.shell.clearFeedback(),
      startCombatFromEncounter: (enc) => this.combatCtrl.startCombatFromEncounter(enc),
      setCombatantDefeated: (id, defeated) => this.combatCtrl.setCombatantDefeated(id, defeated),
      reload: () => this.initiative.reload(),
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.onPageHide);
    }
    this.storeSub = this.playStore.campaignChanged$.subscribe((next) => {
      this.emitCampaign(next);
    });
    effect(() => {
      const fb = this.playStore.feedback();
      untracked(() => this.shell.feedback.set(fb));
    });
    effect(() => {
      const c = this.campaign();
      untracked(() => this.playStore.bindCampaign(c));
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
        this.shell.resetOnSessionChange();
        this.combatCtrl.resetFightStep();
        this.playImport.resetPickers();
      });
    });
    effect(() => {
      const collecting = !!this.state.activeCombat()?.collectingInitiative && this.state.isDm();
      this.live.connected();
      untracked(() => {
        if (collecting) this.initiative.startInitiativePoll();
        else this.initiative.stopInitiativePoll();
      });
    });
    effect(() => {
      const timer = this.state.activeSession()?.sceneTimer ?? null;
      this.shell.sceneTimerTick();
      untracked(() => this.shell.hydrateSceneTimer(timer));
    });
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
    }
    this.storeSub?.unsubscribe();
    this.playStore.destroy();
    this.flushPendingSessionWork();
    this.initiative.stopInitiativePoll();
    this.shell.destroy();
  }

  private flushPendingSessionWork(): void {
    this.playStore.flushSessionSave();
  }
}
