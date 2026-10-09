import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, Subject } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { NotificationService } from '@core/services/notification.service';
import {
  ActiveCombat,
  CampaignData,
  CampaignSession,
  Combatant,
  EncounterGroup,
  type CampaignDetail as CampaignDetailModel,
  type CampaignHandout,
  type NotebookPage,
  type SessionTimelineItem,
} from '@core/models/Campaign/campaign';
import { encounterTotalXp } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import { campaignDataAfterDmDamage } from '@core/utils/play-combat-mutations.util';
import { sessionPatchAfterPlayEnd } from '@core/utils/play-combat-session.util';
import { withFogToggled } from '@core/utils/dungeon-fog.util';
import {
  buildSceneTimerStart,
  canToggleTableReady,
  initialHandoutOverlayId,
  toggleSceneTimerPauseState,
  toggleTableReadyUserIds,
  type PlayPlayerOverlay,
} from '@core/utils/play-table.util';
import {
  bumpEncounterCreatureDefeated,
  creatureTrackKey,
  splitEncounterXp,
  withBulkCreatureRole,
  withCreatureRole,
} from '@core/utils/campaign-hub-write.util';
import type { CreatureRole, StoryCreatureSelection } from '@core/models/Story/story';
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
  private readonly characters = inject(CharacterCloudService);
  private readonly notifications = inject(NotificationService);

  private readonly _campaign = signal<CampaignDetailModel | null>(null);
  readonly campaign = this._campaign.asReadonly();

  /** Le shell s’abonne et re-émet vers le parent page. */
  readonly campaignChanged$ = new Subject<CampaignDetailModel>();

  readonly saving = signal(false);
  readonly feedback = signal<PlayFeedback | null>(null);
  readonly confirmDialog = signal<PlayConfirmDialog | null>(null);
  readonly awardingXpId = signal<string | null>(null);
  readonly playerOverlay = signal<PlayPlayerOverlay | null>(null);
  readonly selectedHandoutId = signal<string | null>(null);
  readonly myCharacters = signal<{ id: string; name: string }[]>([]);
  readonly myCharactersLoading = signal(false);
  readonly proposeBusyId = signal<string | null>(null);

  readonly publishedHandouts = computed((): CampaignHandout[] =>
    (this._campaign()?.data.handouts ?? []).filter((h) => h.published),
  );

  readonly selectedHandout = computed((): CampaignHandout | null => {
    const id = this.selectedHandoutId();
    if (!id) return null;
    return this.publishedHandouts().find((h) => h.id === id) ?? null;
  });

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

  /** Hit MJ : PV + journal + rencontres, une seule écriture. */
  applyDmCombatHit(targetId: string, damage: number, logLine: string): void {
    const c = this.requireCampaign();
    const session = this.activeSession();
    const combat = this.activeCombat();
    if (!session || !combat) return;
    const data = campaignDataAfterDmDamage(c.data, session.id, combat, targetId, damage, logLine);
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

  startPlaySession(sessionId: string): void {
    if (!this.isDm()) return;
    this.flushSessionSave();
    this.saveData({ activeSessionId: sessionId });
  }

  endPlaySession(playerRecap?: string, onSuccess?: (campaignId: string) => void): void {
    const c = this._campaign();
    const session = this.activeSession();
    if (!c?.isOwner || !session) return;
    this.flushPendingSessionWork();
    const sessions = (c.data.sessions ?? []).map((s) =>
      s.id === session.id ? { ...s, ...sessionPatchAfterPlayEnd(s, playerRecap) } : s,
    );
    this.saveData({ sessions, activeSessionId: null }, () => onSuccess?.(c.id));
  }

  patchSessionDungeonMap(partial: Partial<CampaignDungeonMap>): void {
    if (!this.isDm()) return;
    const map = this.activeSessionMap();
    const c = this._campaign();
    if (!map || !c) return;
    const dungeonMaps = (c.data.dungeonMaps ?? []).map((m) =>
      m.id === map.id ? { ...m, ...partial, updatedAt: new Date().toISOString() } : m,
    );
    this.saveData({ dungeonMaps });
  }

  startSceneTimer(minutes: number, label = 'Scène'): void {
    if (!this.isDm()) return;
    this.patchSession({ sceneTimer: buildSceneTimerStart(minutes, label) }, { immediate: true });
  }

  toggleSceneTimerPause(): void {
    if (!this.isDm()) return;
    const t = this.activeSession()?.sceneTimer;
    if (!t) return;
    this.patchSession({ sceneTimer: toggleSceneTimerPauseState(t) }, { immediate: true });
  }

  stopSceneTimer(): void {
    if (!this.isDm()) return;
    this.patchSession({ sceneTimer: null }, { immediate: true });
  }

  updateCreatureRole(cr: StoryCreatureSelection, role: CreatureRole): void {
    if (!this.isDm()) return;
    const c = this._campaign();
    if (!c) return;
    this.saveData({ creatures: withCreatureRole(c.data.creatures ?? [], cr, role) });
  }

  applyBulkCreatureRole(unsorted: StoryCreatureSelection[], role: 'ally' | 'antagonist'): void {
    if (!this.isDm()) return;
    const c = this._campaign();
    if (!c || !unsorted.length) return;
    const keys = new Set(unsorted.map((cr) => creatureTrackKey(cr)));
    this.saveData({ creatures: withBulkCreatureRole(c.data.creatures ?? [], keys, role) });
  }

  /** @returns false si le joueur n’a pas le droit ou pas de session. */
  togglePlayerTableReady(userId: string): boolean {
    if (
      !canToggleTableReady({
        isSpectator: this.isSpectator(),
        isDm: this.isDm(),
        me: this.auth.user()?.id,
        userId,
      })
    ) {
      return false;
    }
    const session = this.activeSession();
    if (!session) return false;
    this.patchSession(
      { tableReadyUserIds: toggleTableReadyUserIds(session.tableReadyUserIds, userId) },
      { immediate: true },
    );
    return true;
  }

  assignSessionMap(mapId: string | null): void {
    if (!this.isDm() || !this.activeSession()) return;
    this.patchSession({ activeMapId: mapId }, { immediate: true });
  }

  setSessionResume(page: NotebookPage): void {
    if (!this.isDm()) return;
    this.saveData({ sessionResume: page });
  }

  setSessionTimeline(timeline: SessionTimelineItem[]): void {
    const session = this.activeSession();
    if (!session || !this.isDm()) return;
    this.updateSession(session.id, { timeline });
  }

  bumpEncounterDefeated(encounterId: string, creatureIndex: number, delta: 1 | -1): void {
    if (!this.isDm()) return;
    const c = this._campaign();
    if (!c) return;
    this.saveData({
      encounters: bumpEncounterCreatureDefeated(c.data.encounters, encounterId, creatureIndex, delta),
    });
  }

  openHandoutsOverlay(): void {
    this.selectedHandoutId.set(
      initialHandoutOverlayId(this._campaign()?.data.pinnedHandoutId, this.publishedHandouts()),
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

  proposeCharacter(characterId: string, onReload?: () => void): void {
    if (this.proposeBusyId()) return;
    const c = this._campaign();
    if (!c) return;
    this.proposeBusyId.set(characterId);
    this.campaigns.proposeCharacter(c.id, characterId).subscribe({
      next: () => {
        this.proposeBusyId.set(null);
        this.closePlayerOverlay();
        this.setFeedback('ok', 'Héros proposé — en attente de l’approbation du MJ.');
        this.notifications.refresh();
        onReload?.();
      },
      error: () => {
        this.proposeBusyId.set(null);
        this.setFeedback('err', 'Impossible de proposer ce personnage.');
      },
    });
  }

  awardEncounterXp(encounter: EncounterGroup): void {
    const c = this._campaign();
    if (!c?.isOwner || encounter.xpAwarded) {
      this.setFeedback('err', 'XP déjà distribuée ou action impossible.');
      return;
    }
    if (this.awardingXpId()) return;
    const approved = this.players().filter((p) => p.proposalStatus === 'approved');
    const xpGained = encounterTotalXp(encounter);
    const split = splitEncounterXp(xpGained, approved.length);
    if (!split.ok) {
      const msg =
        split.reason === 'no-xp'
          ? 'Aucun XP à distribuer pour cette rencontre.'
          : split.reason === 'no-players'
            ? 'Aucun joueur avec personnage approuvé.'
            : 'Part d’XP trop faible à répartir.';
      this.setFeedback('err', msg);
      return;
    }

    this.awardingXpId.set(encounter.id);
    let completed = 0;
    let failed = 0;
    for (const player of approved) {
      this.campaigns.awardXp(c.id, player.id, split.share).subscribe({
        next: () => {
          completed++;
          if (completed + failed !== approved.length) return;
          this.awardingXpId.set(null);
          if (failed === 0) {
            const latest = this._campaign();
            const encounters = (latest?.data.encounters ?? []).map((e) =>
              e.id === encounter.id ? { ...e, xpAwarded: true } : e,
            );
            this.saveData({ encounters });
            this.setFeedback(
              'ok',
              `+${split.share} XP × ${approved.length} joueur(s) (${xpGained} XP total).`,
            );
          } else {
            this.setFeedback(
              'err',
              `XP partiellement envoyée (${completed}/${approved.length}). Réessayez.`,
            );
          }
        },
        error: () => {
          failed++;
          if (completed + failed !== approved.length) return;
          this.awardingXpId.set(null);
          this.setFeedback(
            'err',
            `Échec XP (${completed}/${approved.length} OK). Vérifiez la connexion.`,
          );
        },
      });
    }
  }

  /** @returns false si aucune carte de session (raccourci F). */
  toggleSessionFog(): boolean {
    const map = this.activeSessionMap();
    if (!map || !this.isDm()) return false;
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
    return true;
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
