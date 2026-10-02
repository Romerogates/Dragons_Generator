import { Injectable, computed, signal } from '@angular/core';
import type { CampaignDetail } from '@core/models/Campaign/campaign';

const ACTIVE_TABLE_CAMPAIGN_KEY = 'dg-active-table-campaign';

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

  /**
   * Après « Terminer session » : ne pas réécrire `sessionStorage` tant qu’une
   * nouvelle session live n’est pas ouverte (évite FAB/Codex fantôme).
   */
  private suppressRemember = false;

  readonly isVisible = computed(() => {
    const detail = this.liveCampaign();
    const id = detail?.data.activeSessionId;
    if (!detail || !id) return false;
    return (detail.data.sessions ?? []).some((s) => s.id === id);
  });

  /** Id campagne persisté (survit à une navigation plein Codex / refresh). */
  rememberedCampaignId(): string | null {
    const live = this.campaignId();
    if (live) return live;
    try {
      return sessionStorage.getItem(ACTIVE_TABLE_CAMPAIGN_KEY);
    } catch {
      return null;
    }
  }

  bindCampaign(detail: CampaignDetail | null): void {
    if (!detail) {
      this.clear();
      return;
    }

    if (!detail.data.activeSessionId) {
      if (this.campaignId() === detail.id) this.clearLiveState();
      // Codex prep : mémoriser sauf juste après Terminer session.
      if (!this.suppressRemember) this.persistRememberedId(detail.id);
      return;
    }
    const session = detail.data.sessions.find((s) => s.id === detail.data.activeSessionId);
    if (!session) {
      if (this.campaignId() === detail.id) this.clearLiveState();
      if (!this.suppressRemember) this.persistRememberedId(detail.id);
      return;
    }
    this.suppressRemember = false;
    this.persistRememberedId(detail.id);
    this.campaignId.set(detail.id);
    this.campaignTitle.set(detail.title);
    this.sessionTitle.set(session.title ?? 'Session');
    this.hasActiveCombat.set(!!session.activeCombat);
    this.combatRound.set(session.activeCombat?.round ?? null);
    this.recentLog.set((session.combatLog ?? []).slice(-8).reverse());
    this.liveCampaign.set(detail);
  }

  /**
   * Terminer / supprimer la session active — vide le dock + sessionStorage
   * même si l’on n’est plus sur `/play`.
   */
  forgetAfterSessionEnd(campaignId?: string | null): void {
    this.suppressRemember = true;
    this.clearLiveState();
    try {
      const key = sessionStorage.getItem(ACTIVE_TABLE_CAMPAIGN_KEY);
      if (!campaignId || key === campaignId || !key) {
        sessionStorage.removeItem(ACTIVE_TABLE_CAMPAIGN_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  clear(): void {
    const previousId = this.campaignId();
    this.clearLiveState();
    if (previousId) {
      try {
        if (sessionStorage.getItem(ACTIVE_TABLE_CAMPAIGN_KEY) === previousId) {
          sessionStorage.removeItem(ACTIVE_TABLE_CAMPAIGN_KEY);
        }
      } catch {
        /* ignore */
      }
    }
  }

  private clearLiveState(): void {
    this.campaignId.set(null);
    this.campaignTitle.set('');
    this.sessionTitle.set('');
    this.hasActiveCombat.set(false);
    this.combatRound.set(null);
    this.recentLog.set([]);
    this.liveCampaign.set(null);
    this.isOpen.set(false);
  }

  private persistRememberedId(id: string): void {
    try {
      sessionStorage.setItem(ACTIVE_TABLE_CAMPAIGN_KEY, id);
    } catch {
      /* ignore quota / private mode */
    }
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
    if (this.campaignId() !== detail.id && this.rememberedCampaignId() !== detail.id) return;
    this.bindCampaign(detail);
  }
}
