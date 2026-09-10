import {
  ChangeDetectionStrategy,
  Component,
  effect,
  HostListener,
  inject,
  OnInit,
  signal,
  untracked,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
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
export class CampaignPlayPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly auth = inject(AuthService);
  private readonly sessionDock = inject(CampaignSessionDockService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly campaign = signal<CampaignDetailModel | null>(null);

  constructor() {
    effect(() => {
      const c = this.campaign();
      untracked(() => this.sessionDock.bindCampaign(c));
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
      },
      error: () => {
        this.error.set('Campagne introuvable.');
        this.loading.set(false);
      },
    });
  }

  onCampaignChange(updated: CampaignDetailModel): void {
    this.campaign.set(updated);
    this.sessionDock.patchLiveCampaign(updated);
  }
}
