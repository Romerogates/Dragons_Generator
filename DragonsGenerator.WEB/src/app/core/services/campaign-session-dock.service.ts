import { Injectable, computed, signal } from '@angular/core';
import type { CampaignDetail } from '@core/models/Campaign/campaign';

/**
 * Dock flottant « session active » (FAB à côté des messages).
 * Enregistre la campagne courante quand `activeSessionId` est posé.
 */
@Injectable({ providedIn: 'root' })
export class CampaignSessionDockService {
  readonly isOpen = signal(false);
  readonly campaignId = signal<string | null>(null);
  readonly campaignTitle = signal('');
  readonly sessionTitle = signal('');
  /** Snapshot léger pour le badge / résumé sans recharger. */
  readonly hasActiveCombat = signal(false);
  readonly combatRound = signal<number | null>(null);
  readonly recentLog = signal<string[]>([]);

  /** Detail vivant fourni par campaign-detail / play page (évite double fetch). */
  readonly liveCampaign = signal<CampaignDetail | null>(null);

  readonly isVisible = computed(() => {
    const detail = this.liveCampaign();
    const id = detail?.data.activeSessionId;
    if (!detail || !id) return false;
    return (detail.data.sessions ?? []).some((s) => s.id === id);
  });

  bindCampaign(detail: CampaignDetail | null): void {
    if (!detail) {
      this.clear();
      return;
    }
    if (!detail.data.activeSessionId) {
      if (this.campaignId() === detail.id) this.clear();
      return;
    }
    const session = detail.data.sessions.find((s) => s.id === detail.data.activeSessionId);
    if (!session) {
      if (this.campaignId() === detail.id) this.clear();
      return;
    }
    this.campaignId.set(detail.id);
    this.campaignTitle.set(detail.title);
    this.sessionTitle.set(session.title ?? 'Session');
    this.hasActiveCombat.set(!!session.activeCombat);
    this.combatRound.set(session.activeCombat?.round ?? null);
    this.recentLog.set((session.combatLog ?? []).slice(-8).reverse());
    this.liveCampaign.set(detail);
  }

  clear(): void {
    this.campaignId.set(null);
    this.campaignTitle.set('');
    this.sessionTitle.set('');
    this.hasActiveCombat.set(false);
    this.combatRound.set(null);
    this.recentLog.set([]);
    this.liveCampaign.set(null);
    this.isOpen.set(false);
  }

  clearIfCampaign(id: string | null | undefined): void {
    if (!id || this.campaignId() !== id) return;
    this.clear();
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  patchLiveCampaign(detail: CampaignDetail): void {
    if (this.campaignId() !== detail.id) return;
    this.bindCampaign(detail);
  }
}
