import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  untracked,
  viewChild,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { AuthService } from '@core/services/auth.service';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { mergeRemoteLiveTable } from '@core/utils/campaign-persist.util';
import { CampaignPlayPanel } from '../campaign-play-panel/campaign-play-panel';
import type { CampaignDetail as CampaignDetailModel } from '@core/models/Campaign/campaign';

@Component({
  selector: 'app-campaign-play',
  standalone: true,
  imports: [CommonModule, RouterLink, CampaignPlayPanel],
  templateUrl: './campaign-play.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignPlayPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly live = inject(CampaignLiveService);
  private readonly auth = inject(AuthService);
  private readonly sessionDock = inject(CampaignSessionDockService);
  private readonly playPanel = viewChild(CampaignPlayPanel);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly campaign = signal<CampaignDetailModel | null>(null);
  readonly xpNotice = signal<string | null>(null);

  private softPollTimer: ReturnType<typeof setInterval> | null = null;
  private liveSub: Subscription | null = null;

  constructor() {
    effect(() => {
      const c = this.campaign();
      untracked(() => this.sessionDock.bindCampaign(c));
    });
    effect(() => {
      // Recaler le poll de secours quand le hub connecte / coupe.
      this.live.connected();
      const c = this.campaign();
      untracked(() => {
        if (c && !c.isOwner) this.startSoftPoll(c);
      });
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    ) {
      return;
    }
    // Sous-overlays (donjon / carnet Main) gèrent Escape en premier.
    if (
      typeof document !== 'undefined' &&
      (document.querySelector('.dungeon-shell--fullscreen') ||
        document.querySelector('[aria-label="Notes à la main"]'))
    ) {
      return;
    }
    const c = this.campaign();
    if (!c) return;
    event.preventDefault();
    void this.router.navigate(['/campaigns', c.id]);
  }

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/campaigns']);
      return;
    }

    this.campaigns.get(id).subscribe({
      next: (c) => {
        this.campaign.set(c);
        this.loading.set(false);
        void this.live.watch(c.id);
        this.liveSub = this.live.updates(c.id).subscribe(() => this.softReload());
        this.startSoftPoll(c);
        this.consumeCodexImportQuery();
      },
      error: () => {
        this.error.set('Campagne introuvable.');
        this.loading.set(false);
      },
    });
  }

  /** ?added=Nom depuis le CTA Codex « Voir la table ». */
  private consumeCodexImportQuery(): void {
    const added = this.route.snapshot.queryParamMap.get('added');
    if (!added?.trim()) return;
    const name = added.trim();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { added: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    const tryAnnounce = (left: number) => {
      const panel = this.playPanel();
      if (panel) {
        panel.announceCodexImport(name);
        return;
      }
      if (left > 0) setTimeout(() => tryAnnounce(left - 1), 40);
    };
    setTimeout(() => tryAnnounce(12), 0);
  }

  ngOnDestroy(): void {
    this.stopSoftPoll();
    this.liveSub?.unsubscribe();
    void this.live.unwatch();
  }

  onCampaignChange(updated: CampaignDetailModel): void {
    this.campaign.set(updated);
    this.sessionDock.patchLiveCampaign(updated);
  }

  /**
   * Poll de secours : 4 s si hub down ; 30 s si SignalR connecté.
   * MJ : pas de poll (écrit déjà) mais reste abonné au hub pour jets d’init joueurs.
   */
  private startSoftPoll(c: CampaignDetailModel): void {
    this.stopSoftPoll();
    if (c.isOwner) return;
    const ms = this.live.fallbackPollMs(4_000);
    this.softPollTimer = setInterval(() => this.softReload(), ms);
  }

  private stopSoftPoll(): void {
    if (this.softPollTimer) {
      clearInterval(this.softPollTimer);
      this.softPollTimer = null;
    }
  }

  private softReload(): void {
    const c = this.campaign();
    if (!c) return;
    // Pendant une sauvegarde MJ, ne pas fusionner un GET qui pourrait être stale.
    if (c.isOwner && this.playPanel()?.saving()) return;
    this.campaigns.get(c.id).subscribe({
      next: (updated) => {
        // Toujours reprendre l’état local le plus récent (évite d’écraser un xpAwarded
        // posé juste après le notify SignalR de award-xp).
        const latest = this.campaign();
        if (!latest) return;
        if (latest.isOwner) {
          if (this.playPanel()?.saving()) return;
          const merged = mergeRemoteLiveTable(latest, updated);
          this.campaign.set(merged);
          this.sessionDock.patchLiveCampaign(merged);
          return;
        }
        this.announcePlayerXpGain(latest, updated);
        this.campaign.set(updated);
        this.sessionDock.patchLiveCampaign(updated);
      },
      error: () => {
        /* ignore poll errors */
      },
    });
  }

  private announcePlayerXpGain(previous: CampaignDetailModel, next: CampaignDetailModel): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const before =
      previous.members.find((m) => m.userId === userId && m.role === 'player')?.xpEarnedInCampaign ??
      0;
    const after =
      next.members.find((m) => m.userId === userId && m.role === 'player')?.xpEarnedInCampaign ?? 0;
    const delta = after - before;
    if (delta <= 0) return;
    this.xpNotice.set(`+${delta} XP reçue — total campagne ${after}`);
    window.setTimeout(() => this.xpNotice.set(null), 6_000);
  }
}
