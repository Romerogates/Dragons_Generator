import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, Subject } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import {
  ActiveCombat,
  CampaignData,
  CampaignSession,
  Combatant,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';
import {
  combatantInitiativeTotal,
  currentTurnCombatant,
  resolveCombatFlowPhase,
  sortedTurnOrder,
  syncEncountersFromCombatants,
  type CombatFlowPhase,
} from '@core/utils/combat-tracker.util';
import { isAllyCombatant, isEnemyCombatant } from '@core/utils/combat-action.util';
import { stripTableChatForPersist } from '@core/utils/campaign-persist.util';

export type PlayFeedback = {
  kind: 'ok' | 'err';
  text: string;
  undo?: () => void;
};

export type PlayConfirmDialog = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
};

/**
 * Session live partagée entre le shell play-panel et ses enfants
 * (chat / battle-map / combat-flow). Fourni au niveau du panel
 * (`providers: [CampaignPlaySessionStore]`) pour isoler chaque dock.
 */
@Injectable()
export class CampaignPlaySessionStore {
  private readonly campaigns = inject(CampaignCloudService);
  private readonly auth = inject(AuthService);

  private readonly _campaign = signal<CampaignDetailModel | null>(null);
  readonly campaign = this._campaign.asReadonly();

  /** Le shell s’abonne et re-émet vers le parent page. */
  readonly campaignChanged$ = new Subject<CampaignDetailModel>();

  readonly saving = signal(false);
  readonly feedback = signal<PlayFeedback | null>(null);
  readonly confirmDialog = signal<PlayConfirmDialog | null>(null);

  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private persistSeq = 0;
  private persistTail: Promise<void> = Promise.resolve();

  readonly isDm = computed(() => this._campaign()?.isOwner === true);
  readonly isSpectator = computed(() => this._campaign()?.role === 'spectator');

  readonly activeSession = computed(() => {
    const c = this._campaign();
    if (!c) return null;
    const id = c.data.activeSessionId;
    if (!id) return null;
    return (c.data.sessions ?? []).find((s) => s.id === id) ?? null;
  });

  readonly activeCombat = computed(() => this.activeSession()?.activeCombat ?? null);

  readonly combatFlowPhase = computed((): CombatFlowPhase | null => {
    const combat = this.activeCombat();
    return combat ? resolveCombatFlowPhase(combat) : null;
  });

  readonly combatTurnOrder = computed(() => {
    const combat = this.activeCombat();
    return combat ? sortedTurnOrder(combat) : [];
  });

  readonly allyCombatants = computed(() =>
    this.combatTurnOrder().filter((c) => isAllyCombatant(c)),
  );

  readonly enemyCombatants = computed(() =>
    this.combatTurnOrder().filter((c) => isEnemyCombatant(c)),
  );

  readonly currentTurn = computed(() => {
    const combat = this.activeCombat();
    return combat ? currentTurnCombatant(combat) : null;
  });

  readonly players = computed(() =>
    (this._campaign()?.members ?? []).filter((m) => m.role === 'player'),
  );

  readonly approvedPlayers = computed(() =>
    this.players().filter((p) => p.proposalStatus === 'approved' && p.approvedCharacterId),
  );

  readonly tableChatMessages = computed(() =>
    (this.activeSession()?.tableChat ?? []).slice(-40),
  );

  readonly activeSessionMap = computed(() => {
    const mapId = this.activeSession()?.activeMapId;
    if (!mapId) return null;
    return (this._campaign()?.data.dungeonMaps ?? []).find((m) => m.id === mapId) ?? null;
  });

  bindCampaign(detail: CampaignDetailModel | null): void {
    this._campaign.set(detail);
  }

  requireCampaign(): CampaignDetailModel {
    const c = this._campaign();
    if (!c) throw new Error('CampaignPlaySessionStore: campaign not bound');
    return c;
  }

  clearFeedback(): void {
    this.feedback.set(null);
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
  }

  setFeedback(
    kind: 'ok' | 'err',
    text: string,
    ttlMsOrOpts: number | { ttlMs?: number; undo?: () => void } = 4500,
  ): void {
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
    const fb = this.feedback();
    const undo = fb?.undo;
    this.clearFeedback();
    undo?.();
  }

  askConfirm(
    title: string,
    body: string,
    onConfirm: () => void,
    confirmLabel = 'Confirmer',
  ): void {
    this.confirmDialog.set({ title, body, confirmLabel, onConfirm });
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

  flushPendingSessionWork(): void {
    this.flushSessionSave();
  }

  flushSessionSave(): void {
    if (!this.sessionSaveTimer) return;
    clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = null;
    const latest = this._campaign();
    if (!latest?.isOwner) return;
    this.saveData({ sessions: latest.data.sessions ?? [] });
  }

  patchCombat(combat: ActiveCombat, options?: { immediate?: boolean }): void {
    this.patchSession({ activeCombat: combat }, options);
  }

  setActiveCombat(combat: ActiveCombat): void {
    this.patchSession({ activeCombat: combat }, { immediate: true });
  }

  /** Sauvegarde combat + sync kills rencontre en une requête. */
  applyCombatWithEncounterSync(combat: ActiveCombat): void {
    const c = this.requireCampaign();
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

  patchSession(patch: Partial<CampaignSession>, options?: { immediate?: boolean }): void {
    const session = this.activeSession();
    if (!session) return;
    this.updateSession(session.id, patch, options);
  }

  updateSession(
    sessionId: string,
    patch: Partial<CampaignSession>,
    options?: { immediate?: boolean },
  ): void {
    const c = this.requireCampaign();
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
      const latest = this._campaign();
      if (!latest) return;
      this.saveData({ sessions: latest.data.sessions ?? [] });
    }, 700);
  }

  saveData(patch: Partial<CampaignData>, onSuccess?: () => void): void {
    const c = this.requireCampaign();
    const data = { ...c.data, ...patch };
    this.patchCampaign(data);
    this.persist(c.title, data, onSuccess);
  }

  patchCampaign(data: CampaignData): void {
    const c = this.requireCampaign();
    const next = { ...c, data };
    this._campaign.set(next);
    this.campaignChanged$.next(next);
  }

  private persist(title: string, data: CampaignData, onSuccess?: () => void): void {
    const c = this.requireCampaign();
    const campaignId = c.id;
    const seq = ++this.persistSeq;
    this.saving.set(true);
    const payload = stripTableChatForPersist(data);

    this.persistTail = this.persistTail
      .catch(() => undefined)
      .then(async () => {
        try {
          const summary = await firstValueFrom(this.campaigns.update(campaignId, title, payload));
          if (seq !== this.persistSeq) return;
          const current = this.requireCampaign();
          const next = { ...current, updatedAt: summary.updatedAt };
          this._campaign.set(next);
          this.campaignChanged$.next(next);
          this.saving.set(false);
          onSuccess?.();
        } catch {
          if (seq === this.persistSeq) {
            this.saving.set(false);
            this.setFeedback('err', 'Sauvegarde échouée — vérifiez la connexion.', { ttlMs: 6000 });
          }
        }
      });
  }

  updateCombatant(
    combatantId: string,
    patch: Partial<Combatant>,
    options?: { immediate?: boolean },
  ): void {
    const combat = this.activeCombat();
    if (!combat || !this.isDm()) return;
    const combatants = combat.combatants.map((c) =>
      c.id === combatantId ? { ...c, ...patch } : c,
    );
    this.patchCombat({ ...combat, combatants }, options);
  }

  /** Partage un jet dans le fil de table (visible party). */
  shareDiceRoll(faces: number, result: number, label?: string): void {
    if (this.isSpectator()) return;
    const session = this.activeSession();
    const c = this._campaign();
    if (!session || !c) return;
    const who = this.auth.user()?.displayName?.trim() || 'Joueur';
    const tag = label?.trim() ? ` (${label.trim()})` : '';
    const body = `🎲 ${who}${tag} : d${faces} → ${result}`;
    this.campaigns.postTableChat(c.id, { sessionId: session.id, body }).subscribe({
      error: () => this.setFeedback('err', 'Jet non partagé (fil de table).'),
    });
  }

  destroy(): void {
    this.flushPendingSessionWork();
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.campaignChanged$.complete();
  }
}

export { combatantInitiativeTotal };
