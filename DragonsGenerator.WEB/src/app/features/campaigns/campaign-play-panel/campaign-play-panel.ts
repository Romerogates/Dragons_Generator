import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import type { Character } from '@core/models/Character/character';
import {
  ActiveCombat,
  CampaignData,
  CampaignSession,
  CampaignSessionStatus,
  Combatant,
  encounterPendingXp,
  encounterTotalXp,
  EncounterGroup,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';
import {
  COMBATANT_KIND_LABELS,
  advanceTurn,
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
  isCombatantDefeated,
  reorderCombatantInTurnOrder,
  sortedTurnOrder,
  syncEncountersFromCombatants,
} from '@core/utils/combat-tracker.util';

@Component({
  selector: 'app-campaign-play-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './campaign-play-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignPlayPanel implements OnDestroy {
  private readonly campaigns = inject(CampaignCloudService);
  private readonly router = inject(Router);

  readonly campaign = input.required<CampaignDetailModel>();
  readonly fullscreen = input(false);
  readonly campaignChange = output<CampaignDetailModel>();

  readonly saving = signal(false);
  readonly importingParty = signal(false);

  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private initiativePollTimer: ReturnType<typeof setInterval> | null = null;

  readonly activeSession = computed(() => {
    const c = this.campaign();
    const id = c.data.activeSessionId;
    if (!c.isOwner || !id) return null;
    return (c.data.sessions ?? []).find((s) => s.id === id) ?? null;
  });

  readonly activeCombat = computed(() => this.activeSession()?.activeCombat ?? null);

  readonly combatTurnOrder = computed(() => {
    const combat = this.activeCombat();
    return combat ? sortedTurnOrder(combat) : [];
  });

  readonly sessionCombatHistory = computed(() => {
    const session = this.activeSession();
    return [...(session?.combatHistory ?? [])].reverse();
  });

  readonly currentTurn = computed(() => {
    const combat = this.activeCombat();
    return combat ? currentTurnCombatant(combat) : null;
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

  protected encounterTotalXp = encounterTotalXp;
  protected encounterPendingXp = encounterPendingXp;
  protected combatantInitiativeTotal = combatantInitiativeTotal;
  protected combatantKindLabels = COMBATANT_KIND_LABELS;
  protected isCombatantDefeated = isCombatantDefeated;

  ngOnDestroy(): void {
    this.flushSessionSave();
    this.stopInitiativePoll();
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
    if (!this.campaign().isOwner) return;
    this.flushSessionSave();
    this.saveData({ activeSessionId: sessionId });
  }

  endPlaySession(): void {
    const c = this.campaign();
    const session = this.activeSession();
    if (!c.isOwner || !session) return;
    if (!confirm('Terminer la session en cours ? Les notes de jeu seront archivées.')) return;
    this.flushSessionSave();
    const sessions = (c.data.sessions ?? []).map((s) => {
      if (s.id !== session.id) return s;
      const playBlock = s.playNotes?.trim();
      const mergedNotes = playBlock
        ? [s.notes?.trim(), playBlock].filter(Boolean).join('\n\n--- Notes de session ---\n\n')
        : s.notes;
      return {
        ...s,
        status: 'played' as CampaignSessionStatus,
        notes: mergedNotes || s.notes,
        playNotes: '',
        activeCombat: null,
      };
    });
    this.saveData({ sessions, activeSessionId: null });
    if (this.fullscreen()) {
      this.router.navigate(['/campaigns', c.id]);
    }
  }

  startStandaloneCombat(): void {
    if (!this.confirmReplaceCombat()) return;
    this.setActiveCombat(createActiveCombat([], { label: 'Combat' }));
  }

  startCombatFromEncounter(encounter: EncounterGroup): void {
    if (!this.confirmReplaceCombat()) return;
    const combatants = expandEncounterToCombatants(encounter);
    this.setActiveCombat(
      createActiveCombat(combatants, { label: encounter.name, encounterId: encounter.id }),
    );
  }

  importPartyIntoCombat(): void {
    const session = this.activeSession();
    if (!session || this.importingParty()) return;

    const approved = this.approvedPlayers();
    if (!approved.length) {
      if (!this.activeCombat()) {
        this.startStandaloneCombat();
      }
      return;
    }

    this.importingParty.set(true);
    const campaignId = this.campaign().id;
    const requests = approved.map((p) =>
      this.campaigns.getMemberCharacter(campaignId, p.id, 'approved').pipe(
        map((res) => {
          const character = { ...(res.data as object), name: res.name ?? p.approvedCharacterName } as Character;
          return this.combatantFromCharacter(character, p.userId);
        }),
        catchError(() =>
          of(
            createCombatant({
              name: p.approvedCharacterName ?? p.displayName,
              kind: 'player',
              initiativeBonus: 0,
              memberUserId: p.userId,
            }),
          ),
        ),
      ),
    );

    forkJoin(requests).subscribe({
      next: (partyCombatants) => {
        this.importingParty.set(false);
        const existing = this.activeCombat();
        if (existing) {
          this.patchCombat({
            ...existing,
            combatants: [...existing.combatants, ...partyCombatants],
          });
        } else {
          this.setActiveCombat(createActiveCombat(partyCombatants, { label: 'Party' }));
        }
      },
      error: () => this.importingParty.set(false),
    });
  }

  endCombat(): void {
    const combat = this.activeCombat();
    const session = this.activeSession();
    if (!combat || !session) return;
    if (!confirm('Terminer le combat en cours ? Un résumé sera ajouté aux notes de session.')) return;

    this.stopInitiativePoll();
    const archive = formatCombatArchiveSummary(combat);
    const entry = createCombatHistoryEntry(combat);
    const playNotes = [session.playNotes?.trim(), archive].filter(Boolean).join('\n\n');
    const combatHistory = [...(session.combatHistory ?? []), entry];
    this.patchSession({ activeCombat: null, playNotes, combatHistory }, { immediate: true });
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
    const combat = this.activeCombat();
    if (!combat) {
      this.startStandaloneCombat();
      return;
    }
    this.patchCombat({
      ...combat,
      combatants: [
        ...combat.combatants,
        createCombatant({ name: '', kind: 'npc', initiativeBonus: 0 }),
      ],
    });
  }

  removeCombatant(combatantId: string): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const combatants = combat.combatants.filter((c) => c.id !== combatantId);
    const turnIndex = Math.min(combat.turnIndex, Math.max(0, combatants.length - 1));
    this.patchCombat({ ...combat, combatants, turnIndex }, { immediate: true });
  }

  updateCombatantConditions(combatantId: string, raw: string): void {
    const conditions = raw.trim()
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    this.updateCombatant(combatantId, { conditions });
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
    const roll = Math.floor(Math.random() * 20) + 1;
    this.updateCombatant(combatantId, { initiativeRoll: roll }, { immediate: true });
  }

  nextTurn(): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const patch = advanceTurn(combat, 1);
    this.patchCombat({ ...combat, ...patch }, { immediate: true });
  }

  prevTurn(): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const patch = advanceTurn(combat, -1);
    this.patchCombat({ ...combat, ...patch }, { immediate: true });
  }

  openInitiativeCollection(): void {
    const combat = this.activeCombat();
    if (!combat) return;
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
      { ...combat, collectingInitiative: false },
      { immediate: true },
    );
  }

  private startInitiativePoll(): void {
    this.stopInitiativePoll();
    this.initiativePollTimer = setInterval(() => {
      if (!this.activeCombat()?.collectingInitiative) {
        this.stopInitiativePoll();
        return;
      }
      this.reload();
    }, 4000);
  }

  private stopInitiativePoll(): void {
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

  copyInitiativeLink(): void {
    const url = this.initiativeShareUrl();
    if (!url || !navigator.clipboard) return;
    void navigator.clipboard.writeText(url);
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
    const combat = this.activeCombat();
    if (!combat) return false;
    return canReorderCombatantInTurnOrder(combat, combatantId, direction);
  }

  moveCombatantTurn(combatantId: string, direction: -1 | 1): void {
    const combat = this.activeCombat();
    if (!combat) return;
    const patch = reorderCombatantInTurnOrder(combat, combatantId, direction);
    if (!patch.turnOrderIds) return;
    this.patchCombat({ ...combat, ...patch }, { immediate: true });
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
    if (!c.isOwner || encounter.xpAwarded) return;
    const xpGained = encounterTotalXp(encounter);
    if (xpGained <= 0) return;

    const approved = this.players().filter((p) => p.proposalStatus === 'approved');
    if (approved.length === 0) return;

    const share = Math.floor(xpGained / approved.length);
    if (share <= 0) return;

    let completed = 0;
    for (const player of approved) {
      this.campaigns.awardXp(c.id, player.id, share).subscribe({
        next: () => {
          completed++;
          if (completed === approved.length) {
            const encounters = c.data.encounters.map((e) =>
              e.id === encounter.id ? { ...e, xpAwarded: true } : e,
            );
            this.saveData({ encounters });
            this.reload();
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
    return createCombatant({
      name: character.name || 'Sans nom',
      kind: 'player',
      initiativeBonus: character.initiative ?? 0,
      maxHp,
      currentHp: maxHp,
      memberUserId: memberUserId ?? null,
    });
  }

  private confirmReplaceCombat(): boolean {
    if (!this.activeCombat()) return true;
    return confirm('Remplacer le combat en cours ?');
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
    this.campaignChange.emit({ ...c, data });
  }

  private saveData(patch: Partial<CampaignData>): void {
    const c = this.campaign();
    const data = { ...c.data, ...patch };
    this.persist(c.title, data);
  }

  private persist(title: string, data: CampaignData): void {
    const c = this.campaign();
    this.saving.set(true);
    this.campaigns.update(c.id, title, data).subscribe({
      next: () => {
        this.campaignChange.emit({ ...c, data });
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  private reload(): void {
    const c = this.campaign();
    this.campaigns.get(c.id).subscribe({
      next: (updated) => this.campaignChange.emit(updated),
    });
  }
}
