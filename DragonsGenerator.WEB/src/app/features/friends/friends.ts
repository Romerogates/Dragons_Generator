import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FriendsService } from '@core/services/friends.service';
import { AuthService } from '@core/services/auth.service';
import { CampaignInvite, FriendRequest, FriendUser } from '@core/models/Campaign/campaign';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './friends.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FriendsPage implements OnInit {
  private friends = inject(FriendsService);
  private auth = inject(AuthService);

  readonly searchQuery = signal('');
  readonly searchResults = signal<FriendUser[]>([]);
  readonly friendsList = signal<FriendUser[]>([]);
  readonly requests = signal<FriendRequest[]>([]);
  readonly campaignInvites = signal<CampaignInvite[]>([]);
  readonly message = signal<string | null>(null);
  readonly isLoggedIn = this.auth.isLoggedIn;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    this.reload();
  }

  reload(): void {
    this.friends.listFriends().subscribe((f) => this.friendsList.set(f));
    this.friends.listIncomingRequests().subscribe((r) => this.requests.set(r));
    this.friends.listCampaignInvites().subscribe((i) => this.campaignInvites.set(i));
  }

  search(): void {
    const q = this.searchQuery().trim();
    if (q.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.friends.searchUsers(q).subscribe((r) => this.searchResults.set(r));
  }

  sendRequest(userId: string): void {
    this.message.set(null);
    this.friends.sendRequest(userId).subscribe({
      next: () => this.message.set('Demande envoyée !'),
      error: (err) => this.message.set(err?.error?.errors?.[0]?.reason ?? 'Échec de la demande.'),
    });
  }

  accept(id: string): void {
    this.friends.acceptRequest(id).subscribe(() => this.reload());
  }

  decline(id: string): void {
    this.friends.declineRequest(id).subscribe(() => this.reload());
  }

  acceptCampaign(id: string): void {
    this.friends.acceptCampaignInvite(id).subscribe(() => this.reload());
  }

  declineCampaign(id: string): void {
    this.friends.declineCampaignInvite(id).subscribe(() => this.reload());
  }
}
