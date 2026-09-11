import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-campaign-join',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campaign-join.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignJoinPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly joining = signal(false);
  readonly error = signal<string | null>(null);
  readonly title = signal('');
  readonly ownerName = signal('');
  readonly campaignId = signal<string | null>(null);
  readonly alreadyMember = signal(false);
  readonly token = signal('');

  readonly isLoggedIn = this.auth.isLoggedIn;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token')?.trim() ?? '';
    this.token.set(token);
    if (!token) {
      this.error.set('Lien d’invitation invalide.');
      this.loading.set(false);
      return;
    }

    this.campaigns.previewJoin(token).subscribe({
      next: (preview) => {
        this.title.set(preview.title);
        this.ownerName.set(preview.ownerDisplayName);
        this.campaignId.set(preview.campaignId);
        this.alreadyMember.set(preview.alreadyMember);
        this.loading.set(false);
        if (preview.alreadyMember && this.auth.isLoggedIn()) {
          void this.router.navigate(['/campaigns', preview.campaignId]);
        }
      },
      error: () => {
        this.error.set('Ce lien d’invitation est invalide ou a été révoqué.');
        this.loading.set(false);
      },
    });
  }

  goLogin(): void {
    const returnUrl = `/join/${encodeURIComponent(this.token())}`;
    void this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  join(): void {
    if (!this.auth.isLoggedIn()) {
      this.goLogin();
      return;
    }
    if (this.joining()) return;
    this.joining.set(true);
    this.error.set(null);
    this.campaigns.joinByToken(this.token()).subscribe({
      next: (summary) => {
        this.joining.set(false);
        void this.router.navigate(['/campaigns', summary.id], {
          queryParams: { joined: '1' },
        });
      },
      error: () => {
        this.joining.set(false);
        this.error.set('Impossible de rejoindre cette campagne.');
      },
    });
  }
}
