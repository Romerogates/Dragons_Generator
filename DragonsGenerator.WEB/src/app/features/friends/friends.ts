import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FriendsService } from '@core/services/friends.service';
import { FriendChatService, FriendChatSummary } from '@core/services/friend-chat.service';
import { FriendChatDockService } from '@core/services/friend-chat-dock.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { CampaignInvite, FriendRequest, FriendUser } from '@core/models/Campaign/campaign';
import { ProfileAvatarComponent } from '@shared/components/profile-avatar/profile-avatar';

type SearchStatus = 'none' | 'friend' | 'pending_sent' | 'pending_received';

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileAvatarComponent],
  templateUrl: './friends.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FriendsPage implements OnInit {
  private friends = inject(FriendsService);
  private chat = inject(FriendChatService);
  private dock = inject(FriendChatDockService);
  private auth = inject(AuthService);
  private notifications = inject(NotificationService);

  readonly searchQuery = signal('');
  readonly searchResults = signal<FriendUser[]>([]);
  readonly friendsList = signal<FriendUser[]>([]);
  readonly chatSummaries = signal<FriendChatSummary[]>([]);
  readonly requests = signal<FriendRequest[]>([]);
  readonly sentRequests = signal<FriendRequest[]>([]);
  readonly campaignInvites = signal<CampaignInvite[]>([]);
  readonly message = signal<string | null>(null);
  readonly friendToRemove = signal<FriendUser | null>(null);
  readonly removing = signal(false);
  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly unreadByFriendId = computed(() => {
    const map = new Map<string, number>();
    for (const s of this.chatSummaries()) {
      map.set(s.friendUserId, s.unreadCount);
    }
    return map;
  });

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    this.reload();
  }

  reload(): void {
    this.friends.listFriends().subscribe((f) => this.friendsList.set(f));
    this.chat.listSummaries().subscribe((s) => this.chatSummaries.set(s));
    this.friends.listIncomingRequests().subscribe((r) => this.requests.set(r));
    this.friends.listSentRequests().subscribe((r) => this.sentRequests.set(r));
    this.friends.listCampaignInvites().subscribe((i) => this.campaignInvites.set(i));
    this.notifications.refresh();
  }

  searchStatus(userId: string): SearchStatus {
    if (this.friendsList().some((f) => f.id === userId)) return 'friend';
    if (this.sentRequests().some((r) => r.userId === userId)) return 'pending_sent';
    if (this.requests().some((r) => r.userId === userId)) return 'pending_received';
    return 'none';
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
      next: () => {
        this.message.set('Demande envoyée !');
        this.reload();
      },
      error: (err) => this.message.set(err?.error?.errors?.[0]?.reason ?? 'Échec de la demande.'),
    });
  }

  accept(id: string): void {
    this.friends.acceptRequest(id).subscribe(() => this.reload());
  }

  decline(id: string): void {
    this.friends.declineRequest(id).subscribe(() => this.reload());
  }

  cancelSent(id: string): void {
    this.friends.cancelRequest(id).subscribe({
      next: () => {
        this.message.set('Demande annulée.');
        this.reload();
      },
      error: () => this.message.set('Impossible d\'annuler cette demande.'),
    });
  }

  acceptCampaign(id: string): void {
    this.friends.acceptCampaignInvite(id).subscribe(() => this.reload());
  }

  declineCampaign(id: string): void {
    this.friends.declineCampaignInvite(id).subscribe(() => this.reload());
  }

  confirmRemove(friend: FriendUser): void {
    this.friendToRemove.set(friend);
  }

  cancelRemove(): void {
    this.friendToRemove.set(null);
  }

  removeFriend(): void {
    const friend = this.friendToRemove();
    if (!friend || this.removing()) return;
    this.removing.set(true);
    this.friends.removeFriend(friend.id).subscribe({
      next: () => {
        this.removing.set(false);
        this.friendToRemove.set(null);
        this.message.set(`${friend.displayName} retiré de vos amis.`);
        this.reload();
      },
      error: () => {
        this.removing.set(false);
        this.message.set('Impossible de retirer cet ami.');
      },
    });
  }

  unreadCount(friendId: string): number {
    return this.unreadByFriendId().get(friendId) ?? 0;
  }

  openChat(friend: FriendUser): void {
    this.dock.openThread(friend.id, friend.displayName, friend.avatarEmoji, friend.accentColor);
  }
}
