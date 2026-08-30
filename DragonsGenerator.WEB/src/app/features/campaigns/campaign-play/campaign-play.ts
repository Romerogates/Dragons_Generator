import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
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

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly campaign = signal<CampaignDetailModel | null>(null);

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
        if (!c.isOwner) {
          this.router.navigate(['/campaigns', id]);
          return;
        }
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
  }
}
