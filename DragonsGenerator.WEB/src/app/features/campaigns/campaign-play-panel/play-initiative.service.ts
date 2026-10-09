import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { mergeRemoteLiveTable } from '@core/utils/campaign-persist.util';
import { combatantInitiativeTotal } from '@core/utils/combat-tracker.util';
import {
  type ActiveCombat,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';
import { PlayTableShellService } from './play-table-shell.service';
import { PlayCombatState } from './play-combat-state.service';

export type PlayInitiativeHooks = {
  emitCampaign: (c: CampaignDetailModel) => void;
  closeInitiativeCollection: () => void;
};

/**
 * Collecte d’initiative (poll live + QR / lien). Persist = store via GET merge.
 */
@Injectable()
export class PlayInitiativeService {
  private readonly campaigns = inject(CampaignCloudService);
  private readonly live = inject(CampaignLiveService);
  private readonly shell = inject(PlayTableShellService);
  private readonly state = inject(PlayCombatState);

  private hooks: PlayInitiativeHooks | null = null;
  private initiativePollTimer: ReturnType<typeof setInterval> | null = null;
  private initiativeLiveSub: Subscription | null = null;
  private seenInitiativeSubmissions = new Set<string>();

  configure(hooks: PlayInitiativeHooks): void {
    this.hooks = hooks;
  }

  rememberInitSubmissions(ids: Iterable<string>): void {
    this.seenInitiativeSubmissions = new Set(ids);
  }

  startInitiativePoll(): void {
    this.stopInitiativePoll();
    const campaignId = this.state.campaign().id;
    this.initiativeLiveSub = this.live.updates(campaignId).subscribe((evt) => {
      if (evt.reason === 'initiative' || evt.reason === 'combat' || evt.reason === 'campaign') {
        this.pollInitiativeRolls();
      }
    });
    const ms = this.live.fallbackPollMs(1_500, 8_000);
    this.initiativePollTimer = setInterval(() => {
      if (!this.state.activeCombat()?.collectingInitiative) {
        this.stopInitiativePoll();
        return;
      }
      this.pollInitiativeRolls();
    }, ms);
  }

  stopInitiativePoll(): void {
    this.initiativeLiveSub?.unsubscribe();
    this.initiativeLiveSub = null;
    if (!this.initiativePollTimer) return;
    clearInterval(this.initiativePollTimer);
    this.initiativePollTimer = null;
  }

  initiativeShareUrl(): string {
    const c = this.state.campaign();
    const combat = this.state.activeCombat();
    if (!combat?.initiativeCode) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/campaigns/${c.id}/init?code=${combat.initiativeCode}`;
  }

  initiativeQrUrl(): string {
    const url = this.initiativeShareUrl();
    if (!url) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`;
  }

  copyInitiativeLink(): void {
    const url = this.initiativeShareUrl();
    if (!url) {
      this.shell.setFeedback('err', 'Aucun lien à copier — ouvrez d’abord la collecte.');
      return;
    }
    if (!navigator.clipboard?.writeText) {
      this.shell.setFeedback('err', 'Presse-papiers indisponible dans ce navigateur.');
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => this.shell.setFeedback('ok', 'Lien d’initiative copié.'),
      () => this.shell.setFeedback('err', 'Impossible de copier le lien.'),
    );
  }

  submittedPlayerCount(): number {
    const combat = this.state.activeCombat();
    if (!combat) return 0;
    return combat.combatants.filter((c) => c.kind === 'player' && c.playerSubmitted).length;
  }

  playerCombatantCount(): number {
    const combat = this.state.activeCombat();
    if (!combat) return 0;
    return combat.combatants.filter((c) => c.kind === 'player').length;
  }

  reload(): void {
    const c = this.state.campaign();
    this.campaigns.get(c.id).subscribe({
      next: (updated) => {
        this.hooks?.emitCampaign(updated);
        const session = updated.data.sessions?.find(
          (s) => s.id === updated.data.activeSessionId,
        );
        const combat = session?.activeCombat;
        if (!combat?.collectingInitiative) return;
        this.notifyNewInitiativeRolls(combat);
        const players = combat.combatants.filter((cb) => cb.kind === 'player');
        if (players.length > 0 && players.every((cb) => cb.playerSubmitted)) {
          this.shell.setFeedback('ok', 'Tous les jets d’initiative reçus — vous pouvez ouvrir le combat.');
          this.hooks?.closeInitiativeCollection();
        }
      },
    });
  }

  persistPlayerAttack(body: {
    actorId: string;
    targetId: string;
    hit: boolean;
    damage: number | null;
    logLine: string;
  }): void {
    const campaignId = this.state.campaign().id;
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
            next: (fresh) => this.hooks?.emitCampaign(fresh),
            error: () => undefined,
          });
        },
        error: () =>
          this.shell.setFeedback('err', 'Impossible d’enregistrer l’attaque — réessayez.', 6000),
      });
  }

  private pollInitiativeRolls(): void {
    const c = this.state.campaign();
    this.campaigns.get(c.id).subscribe({
      next: (remote) => {
        const merged = mergeRemoteLiveTable(this.state.campaign(), remote);
        this.hooks?.emitCampaign(merged);
        const session = merged.data.sessions?.find((s) => s.id === merged.data.activeSessionId);
        const combat = session?.activeCombat;
        if (!combat?.collectingInitiative) return;
        this.notifyNewInitiativeRolls(combat);
        const players = combat.combatants.filter((cb) => cb.kind === 'player');
        if (players.length > 0 && players.every((cb) => cb.playerSubmitted)) {
          this.shell.setFeedback('ok', 'Tous les jets d’initiative reçus — vous pouvez ouvrir le combat.');
          this.hooks?.closeInitiativeCollection();
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
      const who = this.state.playerDisplayName(cb) || cb.name || 'Joueur';
      this.shell.setFeedback(
        'ok',
        total != null
          ? `${who} a envoyé son init : ${cb.initiativeRoll}${bonusLabel} = ${total}`
          : `${who} a envoyé son jet d’initiative.`,
      );
    }
  }
}
