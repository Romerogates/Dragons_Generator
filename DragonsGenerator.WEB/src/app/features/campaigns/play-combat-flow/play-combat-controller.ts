import type { WritableSignal } from '@angular/core';
import type { Combatant, CombatantAttack, EncounterGroup } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import {
  appendCombatLog,
  applyHpDelta,
  formatCombatLogLine,
} from '@core/utils/combat-action.util';
import {
  resolveAttackRoll,
  rollDamageTotal,
  rollDie,
  type RollChoice,
} from '@core/utils/combat-roll.util';
import {
  canReorderCombatantInTurnOrder,
  createActiveCombat,
  duplicateCombatant,
  isCombatantDefeated,
} from '@core/utils/combat-tracker.util';
import {
  combatEnteringFight,
  combatEnteringInitiative,
  encounterCombatSessionPatch,
  playerSubmittedCombatantIds,
  sessionPatchAfterCombatEnd,
} from '@core/utils/play-combat-session.util';
import {
  attackAt,
  attackMissLabel,
  attackTouchLabel,
  combatAfterAdvanceTurn,
  combatAfterDropTurn,
  combatAfterRemoveCombatant,
  combatAfterReorderTurn,
  combatantAfterDefeatedToggle,
  combatantAfterHpRaw,
  combatantAfterMaxHpRaw,
  combatClosingInitiativeCollection,
  combatOpeningInitiativeCollection,
  combatWithAppended,
  conditionsFromRaw,
  conditionsWithout,
  defaultAllyCombatant,
  defaultEnemyCombatant,
  mapCombatant,
  nextConditionsToggle,
  withAddedAttack,
  withPatchedAttack,
  withRemovedAttack,
} from '@core/utils/play-combat-mutations.util';
import { softTablePulse } from '@core/utils/table-feedback.util';
import type { PlaySessionView } from '@core/utils/play-table.util';
import type { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';
import type { PlayFightStep } from './play-combat-host';

export type PlayCombatFeedbackFn = (
  kind: 'ok' | 'err',
  text: string,
  ttlMsOrOpts?: number | { ttlMs?: number; undo?: () => void },
) => void;

export type PlayCombatConfirmFn = (
  title: string,
  body: string,
  onConfirm: () => void,
  confirmLabel?: string,
) => void;

/** UI locale du shell (étapes Pokémon, toasts, collecte). Persist = store. */
export interface PlayCombatUi {
  fightStep: WritableSignal<PlayFightStep>;
  selectedAttackIndex: WritableSignal<number>;
  selectedTargetId: WritableSignal<string | null>;
  pendingInitCombatantId: WritableSignal<string | null>;
  pendingHitTotal: WritableSignal<number | null>;
  pendingDamageDice: WritableSignal<string | null>;
  sessionView: WritableSignal<PlaySessionView>;
  rollChoice: WritableSignal<RollChoice>;
  allyPickerOpen: WritableSignal<boolean>;
  enemyPickerOpen: WritableSignal<boolean>;
  selectedTarget: () => Combatant | null;
  canActOnTurn: () => boolean;
  canEditTurnOrder: () => boolean;
  dungeonMaps: () => CampaignDungeonMap[];
  setFeedback: PlayCombatFeedbackFn;
  askConfirm: PlayCombatConfirmFn;
  shareDiceRoll: (faces: number, result: number, label?: string) => void;
  persistPlayerAttack: (body: {
    actorId: string;
    targetId: string;
    hit: boolean;
    damage: number | null;
    logLine: string;
  }) => void;
  startInitiativePoll: () => void;
  stopInitiativePoll: () => void;
  rememberInitSubmissions: (ids: string[]) => void;
  focusNextTurnControl: () => void;
}

/**
 * Orchestration combat. Toute écriture passe par `CampaignPlaySessionStore`.
 */
export class PlayCombatController {
  constructor(
    private readonly store: CampaignPlaySessionStore,
    private readonly ui: PlayCombatUi,
  ) {}

  resetFightStep(): void {
    this.ui.fightStep.set('menu');
    this.ui.pendingHitTotal.set(null);
    this.ui.pendingDamageDice.set(null);
    this.ui.selectedTargetId.set(null);
    this.ui.selectedAttackIndex.set(0);
  }

  beginAttackFlow(): void {
    if (!this.ui.canActOnTurn()) return;
    this.ui.fightStep.set('pickAttack');
  }

  confirmAttackChoice(): void {
    this.ui.fightStep.set('pickTarget');
  }

  confirmTargetChoice(): void {
    if (!this.ui.selectedTarget()) {
      this.ui.setFeedback('err', 'Choisissez une cible.');
      return;
    }
    this.ui.fightStep.set('toHit');
  }

  skipTurn(): void {
    this.resetFightStep();
    this.nextTurn();
  }

  continueToInitiativePhase(): void {
    const combat = this.store.activeCombat();
    const next = combat ? combatEnteringInitiative(combat) : null;
    if (!next) {
      this.ui.setFeedback('err', 'Ajoutez au moins un allié et un adversaire.');
      return;
    }
    this.store.patchCombat(next, { immediate: true });
    this.ui.rememberInitSubmissions(playerSubmittedCombatantIds(combat!));
    this.ui.startInitiativePoll();
    this.ui.setFeedback('ok', 'Initiative ouverte — partagez le QR ou encodez les jets manquants.');
  }

  openFightPhase(): void {
    const combat = this.store.activeCombat();
    const next = combat ? combatEnteringFight(combat) : null;
    if (!next) {
      this.ui.setFeedback('err', 'Tous les combattants actifs doivent avoir une initiative.');
      return;
    }
    this.store.patchCombat(next, { immediate: true });
    this.ui.stopInitiativePoll();
    this.resetFightStep();
    this.ui.setFeedback('ok', 'Combat ouvert — suivez l’ordre des tours (Espace = suivant).');
  }

  startStandaloneCombat(): void {
    if (!this.store.activeSession()) {
      this.ui.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.withReplaceCombatConfirm(() => {
      this.store.setActiveCombat(createActiveCombat([], { label: 'Combat' }));
      this.ui.sessionView.set('combat');
      this.resetFightStep();
    });
  }

  enterCombatFlow(): void {
    if (!this.store.activeSession()) {
      this.ui.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.ui.sessionView.set('combat');
    if (!this.store.activeCombat()) {
      this.store.setActiveCombat(createActiveCombat([], { label: 'Combat' }));
    }
    this.resetFightStep();
  }

  startCombatFromEncounter(encounter: EncounterGroup): void {
    if (!this.store.activeSession()) {
      this.ui.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.withReplaceCombatConfirm(() => {
      this.store.patchSession(encounterCombatSessionPatch(encounter, this.ui.dungeonMaps()), {
        immediate: true,
      });
      this.ui.sessionView.set('combat');
      this.resetFightStep();
    });
  }

  endCombat(): void {
    const combat = this.store.activeCombat();
    const session = this.store.activeSession();
    if (!combat || !session) return;
    this.ui.askConfirm(
      'Terminer le combat',
      'Un résumé sera ajouté aux notes de session et à l’historique.',
      () => this.doEndCombat(),
      'Terminer',
    );
  }

  private doEndCombat(): void {
    const combat = this.store.activeCombat();
    const session = this.store.activeSession();
    if (!combat || !session) return;
    this.ui.stopInitiativePoll();
    this.store.patchSession(sessionPatchAfterCombatEnd(session, combat), { immediate: true });
    this.resetFightStep();
    this.ui.sessionView.set('resume');
    this.ui.setFeedback('ok', 'Combat terminé — résumé ajouté aux notes et à l’historique.');
  }

  duplicateCombatantRow(combatantId: string): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    const source = combat.combatants.find((c) => c.id === combatantId);
    if (!source) return;
    this.store.patchCombat(combatWithAppended(combat, [duplicateCombatant(source)]), {
      immediate: true,
    });
  }

  addAllyCombatant(): void {
    if (!this.store.activeSession()) {
      this.ui.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.ui.allyPickerOpen.set(false);
    this.appendOrStart([defaultAllyCombatant()]);
  }

  addEnemyCombatant(): void {
    if (!this.store.activeSession()) {
      this.ui.setFeedback('err', 'Entrez d’abord en session pour combattre.');
      return;
    }
    this.appendOrStart([defaultEnemyCombatant()]);
  }

  addBlankEnemyCombatant(): void {
    this.ui.enemyPickerOpen.set(false);
    this.addEnemyCombatant();
  }

  randomizeArmorClass(combatantId: string): void {
    const ac = 10 + rollDie(8) - 1;
    this.updateCombatant(combatantId, { armorClass: ac }, { immediate: true });
  }

  removeCombatant(combatantId: string): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    const target = combat.combatants.find((c) => c.id === combatantId);
    const label = target?.name?.trim() || 'ce combattant';
    const inSetup = this.store.combatFlowPhase() === 'setup';
    if (inSetup) {
      this.doRemoveCombatant(combatantId);
      return;
    }
    this.ui.askConfirm('Retirer du combat', `Retirer ${label} du combat ?`, () =>
      this.doRemoveCombatant(combatantId),
      'Retirer',
    );
  }

  private doRemoveCombatant(combatantId: string): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    if (this.ui.selectedTargetId() === combatantId) this.ui.selectedTargetId.set(null);
    if (this.ui.pendingInitCombatantId() === combatantId) this.ui.pendingInitCombatantId.set(null);
    this.store.patchCombat(combatAfterRemoveCombatant(combat, combatantId), { immediate: true });
  }

  updateCombatantConditions(combatantId: string, raw: string): void {
    this.updateCombatant(combatantId, { conditions: conditionsFromRaw(raw) });
  }

  toggleCondition(combatantId: string, condition: string): void {
    const combat = this.store.activeCombat();
    if (!combat || !this.store.isDm()) return;
    const cb = combat.combatants.find((c) => c.id === combatantId);
    if (!cb) return;
    this.updateCombatant(combatantId, { conditions: nextConditionsToggle(cb.conditions, condition) });
  }

  removeCondition(combatantId: string, condition: string): void {
    const combat = this.store.activeCombat();
    if (!combat || !this.store.isDm()) return;
    const cb = combat.combatants.find((c) => c.id === combatantId);
    if (!cb?.conditions?.length) return;
    this.updateCombatant(combatantId, { conditions: conditionsWithout(cb.conditions, condition) });
  }

  addCombatantAttack(combatantId: string): void {
    const combat = this.store.activeCombat();
    if (!combat || !this.store.isDm()) return;
    this.store.patchCombat(mapCombatant(combat, combatantId, withAddedAttack));
  }

  removeCombatantAttack(combatantId: string, index: number): void {
    const combat = this.store.activeCombat();
    if (!combat || !this.store.isDm()) return;
    this.store.patchCombat(mapCombatant(combat, combatantId, (c) => withRemovedAttack(c, index)));
  }

  patchCombatantAttack(
    combatantId: string,
    index: number,
    patch: Partial<CombatantAttack>,
  ): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    this.store.patchCombat(mapCombatant(combat, combatantId, (c) => withPatchedAttack(c, index, patch)));
  }

  updateCombatant(
    combatantId: string,
    patch: Partial<Combatant>,
    options?: { immediate?: boolean },
  ): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    this.store.patchCombat(
      mapCombatant(combat, combatantId, (c) => ({ ...c, ...patch })),
      options,
    );
  }

  updateCombatantHp(combatantId: string, raw: string | number): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    if (!combat.combatants.some((c) => c.id === combatantId)) return;
    this.store.applyCombatWithEncounterSync(
      mapCombatant(combat, combatantId, (c) => combatantAfterHpRaw(c, raw)),
    );
  }

  updateCombatantMaxHp(combatantId: string, raw: string | number): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    const current = combat.combatants.find((c) => c.id === combatantId);
    if (!current) return;
    this.updateCombatant(combatantId, combatantAfterMaxHpRaw(current, raw), { immediate: true });
  }

  markCombatantDead(combatantId: string): void {
    this.setCombatantDefeated(combatantId, true);
  }

  reviveCombatant(combatantId: string): void {
    this.setCombatantDefeated(combatantId, false);
  }

  setCombatantDefeated(combatantId: string, defeated: boolean): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    this.store.applyCombatWithEncounterSync(
      mapCombatant(combat, combatantId, (c) => combatantAfterDefeatedToggle(c, defeated)),
    );
  }

  rollInitiativeFor(combatantId: string): void {
    if (!this.store.isDm()) return;
    this.ui.pendingInitCombatantId.set(combatantId);
  }

  onInitiativeDieRolled(combatantId: string, roll: number): void {
    this.updateCombatant(
      combatantId,
      { initiativeRoll: roll, playerSubmitted: false },
      { immediate: true },
    );
    this.ui.pendingInitCombatantId.set(null);
    this.ui.setFeedback('ok', `Initiative ${roll} pour ce combattant.`);
  }

  selectTarget(combatantId: string): void {
    const cb = this.store.combatTurnOrder().find((c) => c.id === combatantId);
    if (!cb || isCombatantDefeated(cb)) return;
    this.ui.selectedTargetId.set(combatantId);
    if (this.ui.fightStep() === 'pickTarget') {
      this.ui.fightStep.set('toHit');
    }
  }

  setRollChoice(choice: RollChoice): void {
    this.ui.rollChoice.set(choice);
  }

  adjustHp(combatantId: string, delta: number): void {
    if (!this.store.isDm()) return;
    const combat = this.store.activeCombat();
    if (!combat) return;
    const combatants = combat.combatants.map((c) =>
      c.id === combatantId ? applyHpDelta(c, delta) : c,
    );
    this.store.applyCombatWithEncounterSync({ ...combat, combatants });
  }

  resolveAttackWithDie(d20: number): void {
    const turn = this.store.currentTurn();
    const target = this.ui.selectedTarget();
    if (!turn || !target || !this.ui.canActOnTurn()) return;
    if (this.ui.fightStep() !== 'toHit' && this.store.combatFlowPhase() === 'fight') return;
    this.ui.shareDiceRoll(20, d20, turn.name || 'attaque');

    const atk = attackAt(turn, this.ui.selectedAttackIndex());
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
      if (this.store.isDm()) this.appendLog(line);
      else {
        this.ui.persistPlayerAttack({
          actorId: turn.id,
          targetId: target.id,
          hit: false,
          damage: null,
          logLine: line,
        });
      }
      this.ui.setFeedback('ok', `${turn.name} → ${target.name} : ${attackMissLabel(resolution)}`);
      if (resolution.fumble) softTablePulse('fumble');
      this.resetFightStep();
      return;
    }

    this.ui.pendingHitTotal.set(resolution.total);
    this.ui.pendingDamageDice.set(atk.damageDice?.trim() || '1d6');
    this.ui.fightStep.set('damage');
    this.ui.setFeedback('ok', `${turn.name} ${attackTouchLabel(target.name || 'Cible', resolution)}`);
    if (resolution.critical) softTablePulse('crit');
  }

  resolveDamageWithDie(_ignored?: number): void {
    const turn = this.store.currentTurn();
    const target = this.ui.selectedTarget();
    if (!turn || !target || !this.ui.canActOnTurn()) return;
    if (this.ui.fightStep() !== 'damage') return;

    const atk = attackAt(turn, this.ui.selectedAttackIndex());
    const formula = this.ui.pendingDamageDice() ?? atk.damageDice ?? '1d6';
    const damage =
      rollDamageTotal(formula, atk.damageBonus ?? 0) ??
      Math.max(1, (atk.damageBonus ?? 0) + rollDie(6));

    const hitTotal = this.ui.pendingHitTotal() ?? 0;
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

    if (this.store.isDm()) {
      this.store.applyDmCombatHit(target.id, damage, line);
    } else {
      this.ui.persistPlayerAttack({
        actorId: turn.id,
        targetId: target.id,
        hit: true,
        damage,
        logLine: line,
      });
    }
    this.ui.setFeedback('ok', `${turn.name} → ${target.name} : ${damage} dégâts (${formula})`);
    this.resetFightStep();
  }

  nextTurn(): void {
    if (!this.store.isDm()) return;
    const combat = this.store.activeCombat();
    if (!combat) return;
    this.ui.selectedTargetId.set(null);
    const { combat: next, nextName } = combatAfterAdvanceTurn(combat, 1);
    this.store.patchCombat(next, { immediate: true });
    if (nextName) {
      this.ui.setFeedback('ok', `Tour de ${nextName}`, { ttlMs: 2200 });
      softTablePulse('turn');
    }
    queueMicrotask(() => this.ui.focusNextTurnControl());
  }

  prevTurn(): void {
    if (!this.store.isDm()) return;
    const combat = this.store.activeCombat();
    if (!combat) return;
    this.ui.selectedTargetId.set(null);
    const { combat: next } = combatAfterAdvanceTurn(combat, -1);
    this.store.patchCombat(next, { immediate: true });
  }

  openInitiativeCollection(): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    this.ui.rememberInitSubmissions(playerSubmittedCombatantIds(combat));
    this.store.patchCombat(combatOpeningInitiativeCollection(combat), { immediate: true });
    this.ui.startInitiativePoll();
  }

  closeInitiativeCollection(): void {
    const combat = this.store.activeCombat();
    if (!combat) return;
    this.ui.stopInitiativePoll();
    this.store.patchCombat(combatClosingInitiativeCollection(combat), { immediate: true });
  }

  canMoveCombatantTurn(combatantId: string, direction: -1 | 1): boolean {
    if (!this.ui.canEditTurnOrder()) return false;
    const combat = this.store.activeCombat();
    if (!combat) return false;
    return canReorderCombatantInTurnOrder(combat, combatantId, direction);
  }

  moveCombatantTurn(combatantId: string, direction: -1 | 1): void {
    if (!this.ui.canEditTurnOrder()) return;
    const combat = this.store.activeCombat();
    if (!combat) return;
    const next = combatAfterReorderTurn(combat, combatantId, direction);
    if (!next) return;
    this.store.patchCombat(next, { immediate: true });
  }

  dropCombatantAtTurnIndex(combatantId: string, toIndex: number): void {
    if (!this.ui.canEditTurnOrder()) return;
    const combat = this.store.activeCombat();
    if (!combat) return;
    const next = combatAfterDropTurn(combat, combatantId, toIndex);
    if (!next) return;
    this.store.patchCombat(next, { immediate: true });
  }

  private appendLog(line: string): void {
    const session = this.store.activeSession();
    if (!session || !this.store.isDm()) return;
    this.store.patchSession({ combatLog: appendCombatLog(session.combatLog, line) }, { immediate: true });
  }

  private appendOrStart(added: Combatant[]): void {
    const combat = this.store.activeCombat();
    if (!combat) {
      this.withReplaceCombatConfirm(() => {
        this.store.setActiveCombat(createActiveCombat(added, { label: 'Combat' }));
      });
      return;
    }
    this.store.patchCombat(combatWithAppended(combat, added), { immediate: true });
  }

  private withReplaceCombatConfirm(then: () => void): void {
    if (!this.store.activeCombat()) {
      then();
      return;
    }
    this.ui.askConfirm(
      'Remplacer le combat',
      'Un combat est déjà en cours. Le remplacer ?',
      then,
      'Remplacer',
    );
  }
}
