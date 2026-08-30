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
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import {
  CampaignData,
  CampaignSession,
  CampaignSessionStatus,
  encounterPendingXp,
  encounterTotalXp,
  EncounterGroup,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';

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

  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly activeSession = computed(() => {
    const c = this.campaign();
    const id = c.data.activeSessionId;
    if (!c.isOwner || !id) return null;
    return (c.data.sessions ?? []).find((s) => s.id === id) ?? null;
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

  protected encounterTotalXp = encounterTotalXp;
  protected encounterPendingXp = encounterPendingXp;

  ngOnDestroy(): void {
    this.flushSessionSave();
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
      };
    });
    this.saveData({ sessions, activeSessionId: null });
    if (this.fullscreen()) {
      this.router.navigate(['/campaigns', c.id]);
    }
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

  markDefeated(encounterId: string, creatureIndex: number): void {
    const c = this.campaign();
    if (!c.isOwner) return;
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
