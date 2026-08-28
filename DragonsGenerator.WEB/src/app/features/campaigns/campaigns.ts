import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { FriendsService } from '@core/services/friends.service';
import { AuthService } from '@core/services/auth.service';
import { CampaignInvite, CampaignSummary } from '@core/models/Campaign/campaign';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campaigns.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Campaigns implements OnInit {
  private campaigns = inject(CampaignCloudService);
  private friends = inject(FriendsService);
  private auth = inject(AuthService);
  private router = inject(Router);

  readonly list = signal<CampaignSummary[]>([]);
  readonly invites = signal<CampaignInvite[]>([]);
  readonly loading = signal(true);
  readonly toDelete = signal<CampaignSummary | null>(null);
  readonly deleteConfirmName = signal('');
  readonly isLoggedIn = this.auth.isLoggedIn;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      return;
    }
    this.reload();
    this.friends.listCampaignInvites().subscribe((i) => this.invites.set(i));
  }

  reload(): void {
    this.loading.set(true);
    this.campaigns.list().subscribe({
      next: (items) => {
        this.list.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  open(c: CampaignSummary): void {
    this.router.navigate(['/campaigns', c.id]);
  }

  acceptInvite(inv: CampaignInvite): void {
    this.friends.acceptCampaignInvite(inv.id).subscribe(() => {
      this.reload();
      this.friends.listCampaignInvites().subscribe((i) => this.invites.set(i));
    });
  }

  declineInvite(inv: CampaignInvite): void {
    this.friends.declineCampaignInvite(inv.id).subscribe(() => {
      this.friends.listCampaignInvites().subscribe((i) => this.invites.set(i));
    });
  }

  confirmDelete(c: CampaignSummary): void {
    this.deleteConfirmName.set('');
    this.toDelete.set(c);
  }

  cancelDelete(): void {
    this.deleteConfirmName.set('');
    this.toDelete.set(null);
  }

  canConfirmDelete(): boolean {
    const c = this.toDelete();
    if (!c) return false;
    return this.deleteConfirmName().trim() === c.title.trim();
  }

  deleteCampaign(): void {
    const c = this.toDelete();
    if (!c || !this.canConfirmDelete()) return;
    this.campaigns.delete(c.id).subscribe(() => {
      this.deleteConfirmName.set('');
      this.toDelete.set(null);
      this.reload();
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Récemment';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Récemment';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }
}
