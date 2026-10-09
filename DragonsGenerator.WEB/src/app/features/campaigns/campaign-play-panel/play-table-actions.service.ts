import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import type { StoryCreatureSelection, CreatureRole } from '@core/models/Story/story';
import { rollDie } from '@core/utils/combat-roll.util';
import { softTablePulse } from '@core/utils/table-feedback.util';
import { applyTablePin, clearTablePinState } from '@core/utils/table-pin.util';
import { clampHpAdjustAmount } from '@core/utils/play-table.util';
import { type MjTableShortcut } from '@core/utils/play-keyboard.util';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';
import { PlayTableShellService } from './play-table-shell.service';
import { PlayImportService } from './play-import.service';
import { PlayCombatState } from './play-combat-state.service';
import type { PlayCombatController } from '../play-combat-flow/play-combat-controller';
import type { PlayTableChat } from '../play-table-chat/play-table-chat';

export type PlayTableActionHooks = {
  combatCtrl: PlayCombatController;
  tableChat: () => PlayTableChat | undefined;
};

/**
 * Chrome table : raccourcis, CTA, pins, macros, drag tour. Persist = store.
 */
@Injectable()
export class PlayTableActionsService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly playStore = inject(CampaignPlaySessionStore);
  private readonly shell = inject(PlayTableShellService);
  private readonly playImport = inject(PlayImportService);
  private readonly state = inject(PlayCombatState);

  private hooks: PlayTableActionHooks | null = null;
  private turnOrderDrag: { combatantId: string; fromIndex: number } | null = null;

  readonly commonConditions = [
    'à terre',
    'empoisonné',
    'inconscient',
    'entravé',
    'aveuglé',
    'charmé',
  ] as const;

  configure(hooks: PlayTableActionHooks): void {
    this.hooks = hooks;
  }

  private ctrl(): PlayCombatController {
    const c = this.hooks?.combatCtrl;
    if (!c) throw new Error('PlayTableActionsService: combatCtrl manquant');
    return c;
  }

  handleMjShortcut(key: MjTableShortcut): boolean {
    if (!this.state.isDm() || this.state.isSpectator()) return false;
    if (key === 'space') {
      if (!this.state.activeCombat() || this.state.combatFlowPhase() !== 'fight') return false;
      this.ctrl().nextTurn();
      return true;
    }
    if (key === 'n') {
      this.shell.openSessionNotes();
      softTablePulse('dice');
      return true;
    }
    if (key === 's') {
      this.shell.toggleSecretPanel();
      softTablePulse('dice');
      return true;
    }
    if (key === 'z') {
      this.shell.toggleZenMode();
      return true;
    }
    if (key === 'd') {
      const r = rollDie(20);
      const chat = this.hooks?.tableChat();
      if (chat) chat.shareTableD20(r);
      else this.shareDiceRoll(20, r, 'table');
      this.shell.setFeedback('ok', `d20 → ${r}`);
      softTablePulse('dice');
      return true;
    }
    if (key === 'f') {
      if (!this.playStore.toggleSessionFog()) {
        this.shell.setFeedback('err', 'Aucune carte de session pour le fog.');
      }
      return true;
    }
    return false;
  }

  togglePlayerTableReady(userId: string): void {
    if (!this.playStore.togglePlayerTableReady(userId)) return;
    softTablePulse('ready');
  }

  setHpAdjustAmount(raw: string | number): void {
    this.state.hpAdjustAmount.set(clampHpAdjustAmount(raw));
  }

  shareDiceRoll(faces: number, result: number, label?: string): void {
    this.playStore.shareDiceRoll(faces, result, label);
  }

  onSharedTableDie(result: number): void {
    this.shareDiceRoll(20, result, 'table');
  }

  togglePlayerRoster(): void {
    this.state.playerRosterExpanded.update((v) => !v);
  }

  toggleAdvancedTools(): void {
    this.shell.toggleAdvancedTools();
  }

  addBlankEnemyCombatant(): void {
    this.playImport.codexCreatureSearch.set('');
    this.ctrl().addBlankEnemyCombatant();
  }

  focusNextTurnControl(): void {
    if (typeof document === 'undefined') return;
    this.scrollToTurnBanner();
    const btn = document.querySelector('[data-testid="play-next-turn"]') as HTMLElement | null;
    btn?.focus({ preventScroll: true });
  }

  onTurnOrderDragStart(ev: PointerEvent, combatantId: string, fromIndex: number): void {
    if (!this.state.canEditTurnOrder() || ev.button !== 0) return;
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
    this.ctrl().dropCombatantAtTurnIndex(drag.combatantId, toIndex);
    this.turnOrderDrag = { combatantId: drag.combatantId, fromIndex: toIndex };
  }

  onTurnOrderDragEnd(): void {
    this.turnOrderDrag = null;
  }

  isTurnOrderDragging(combatantId: string): boolean {
    return this.turnOrderDrag?.combatantId === combatantId;
  }

  runNextActionCta(): void {
    const action = this.state.nextAction();
    if (!action?.cta) return;
    switch (action.cta) {
      case 'propose':
        this.shell.openProposeOverlay();
        break;
      case 'ready':
        this.markMyselfReady();
        break;
      case 'init':
        void this.router.navigate(['/campaigns', this.state.campaign().id, 'init'], {
          queryParams: this.state.activeCombat()?.initiativeCode
            ? { code: this.state.activeCombat()!.initiativeCode }
            : undefined,
        });
        break;
      case 'handouts':
        this.shell.openHandoutsOverlay();
        break;
      case 'combat':
        if (action.kind === 'open_combat' && this.state.canEnterFight()) {
          this.ctrl().openFightPhase();
        } else if (action.kind === 'continue_initiative' && this.state.canContinueToInitiative()) {
          this.ctrl().continueToInitiativePhase();
        } else {
          this.ctrl().enterCombatFlow();
        }
        break;
      case 'secrets':
        this.shell.openSecretPanel();
        break;
      case 'notes':
        this.shell.openSessionNotes();
        break;
    }
  }

  markMyselfReady(): void {
    const me = this.auth.user()?.id;
    if (!me || this.state.isPlayerTableReady(me)) return;
    this.togglePlayerTableReady(me);
    this.shell.setFeedback('ok', 'Vous êtes marqué prêt à la table.');
  }

  scrollToTurnBanner(): void {
    if (typeof document === 'undefined') return;
    document
      .querySelector('[data-testid="play-turn-banner"]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  scrollToEmbeddedInitiative(): void {
    if (typeof document === 'undefined') return;
    if (this.state.isDm()) this.state.sessionView.set('combat');
    const el = document.getElementById('play-embedded-initiative');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (el instanceof HTMLElement) {
      el.focus({ preventScroll: true });
    }
  }

  pinTableMessage(body: string): void {
    if (!this.state.isDm()) return;
    const session = this.state.activeSession();
    if (!session) return;
    const patch = applyTablePin(session, body);
    if (!patch.tablePin) return;
    this.playStore.patchSession(patch, { immediate: true });
    this.shell.setFeedback('ok', 'Message épinglé en haut du fil.');
  }

  clearTablePin(): void {
    if (!this.state.isDm()) return;
    const session = this.state.activeSession();
    if (!session) return;
    this.playStore.patchSession(clearTablePinState(session), { immediate: true });
  }

  restoreTablePin(body: string): void {
    this.pinTableMessage(body);
  }

  runTableMacro(kind: 'perception' | 'next_turn' | 'end_combat'): void {
    if (!this.state.isDm()) return;
    if (kind === 'perception') {
      const r = rollDie(20);
      this.shareDiceRoll(20, r, 'perception groupe');
      this.shell.setFeedback('ok', `Perception groupe — d20 → ${r}`);
      softTablePulse('dice');
      return;
    }
    if (kind === 'next_turn') {
      if (this.state.combatFlowPhase() !== 'fight') {
        this.shell.setFeedback('err', 'Ouvrez d’abord le combat pour avancer le tour.');
        return;
      }
      this.ctrl().nextTurn();
      return;
    }
    if (kind === 'end_combat') {
      if (!this.state.activeCombat()) {
        this.shell.setFeedback('err', 'Aucun combat actif.');
        return;
      }
      this.ctrl().endCombat();
    }
  }

  bulkClassifyUnsorted(role: 'ally' | 'antagonist'): void {
    if (!this.state.isDm()) return;
    const unsorted = this.state.campaignUnsortedCreatures();
    if (!unsorted.length) return;
    const label = role === 'ally' ? 'alliés' : 'adversaires';
    this.shell.askConfirm(
      'Classer les créatures',
      `Classer ${unsorted.length} créature(s) neutre(s) en ${label} ?`,
      () => {
        this.playStore.applyBulkCreatureRole(unsorted, role);
        this.shell.setFeedback('ok', `${unsorted.length} créature(s) → ${label}.`);
      },
      'Classer',
    );
  }

  updateCreatureRole(cr: StoryCreatureSelection, role: CreatureRole): void {
    this.playStore.updateCreatureRole(cr, role);
  }
}
