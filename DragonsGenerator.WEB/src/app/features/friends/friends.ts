import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
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
import {
  CampaignInvite,
  FriendRelationshipStatus,
  FriendRequest,
  FriendUser,
  UserSearchResult,
  UserSuggestion,
} from '@core/models/Campaign/campaign';
import { ProfileAvatarComponent } from '@shared/components/profile-avatar/profile-avatar';
import {
  FRIENDS_SEARCH_DEBOUNCE_MS,
  FRIENDS_SEARCH_MIN_LENGTH,
  formatMemberSince,
  pickRecentFriends,
  relationshipStatusLabel,
  shouldTriggerFriendsSearch,
} from '@core/utils/friends-search.util';

type FriendsTab = 'discover' | 'friends' | 'requests';

type DiscoverCard = UserSearchResult | UserSuggestion;

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileAvatarComponent],
  templateUrl: './friends.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FriendsPage implements OnInit, OnDestroy {
  private friends = inject(FriendsService);
  private chat = inject(FriendChatService);
  private dock = inject(FriendChatDockService);
  private auth = inject(AuthService);
  private notifications = inject(NotificationService);

  readonly searchMinLength = FRIENDS_SEARCH_MIN_LENGTH;
  readonly shouldTriggerFriendsSearch = shouldTriggerFriendsSearch;
  readonly searchQuery = signal('');
  readonly searchResults = signal<UserSearchResult[]>([]);
  readonly suggestions = signal<UserSuggestion[]>([]);
  readonly searching = signal(false);
  readonly friendsList = signal<FriendUser[]>([]);
  readonly chatSummaries = signal<FriendChatSummary[]>([]);
  readonly requests = signal<FriendRequest[]>([]);
  readonly sentRequests = signal<FriendRequest[]>([]);
  readonly campaignInvites = signal<CampaignInvite[]>([]);
  readonly message = signal<string | null>(null);
  readonly friendToRemove = signal<FriendUser | null>(null);
  readonly removing = signal(false);
  readonly activeTab = signal<FriendsTab>('discover');
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly myDisplayName = computed(() => this.auth.user()?.displayName ?? '');

  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly unreadByFriendId = computed(() => {
    const map = new Map<string, number>();
    for (const s of this.chatSummaries()) {
      map.set(s.friendUserId, s.unreadCount);
    }
    return map;
  });

  readonly recentFriends = computed(() => pickRecentFriends(this.friendsList()));

  readonly pendingRequestsCount = computed(
    () => this.requests().length + this.sentRequests().length + this.campaignInvites().length,
  );

  readonly showSuggestions = computed(
    () => !shouldTriggerFriendsSearch(this.searchQuery()) && this.suggestions().length > 0,
  );

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    this.reload();
    this.loadSuggestions();
    this.softPollTimer = setInterval(() => {
      if (this.auth.isLoggedIn()) this.reload();
    }, 12_000);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onWindowFocus);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    if (this.softPollTimer) clearInterval(this.softPollTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
    }
  }

  private softPollTimer: ReturnType<typeof setInterval> | null = null;

  private readonly onWindowFocus = (): void => {
    if (this.auth.isLoggedIn()) this.reload();
  };

  reload(): void {
    this.friends.listFriends().subscribe((f) => this.friendsList.set(f));
    this.chat.listSummaries().subscribe((s) => this.chatSummaries.set(s));
    this.friends.listIncomingRequests().subscribe((r) => this.requests.set(r));
    this.friends.listSentRequests().subscribe((r) => this.sentRequests.set(r));
    this.friends.listCampaignInvites().subscribe((i) => this.campaignInvites.set(i));
    this.notifications.refresh();
  }

  loadSuggestions(): void {
    this.friends.listSuggestions().subscribe((s) => this.suggestions.set(s));
  }

  onSearchInput(value: string): void {
    this.searchQuery.set(value);
    clearTimeout(this.searchTimer);

    if (!shouldTriggerFriendsSearch(value)) {
      this.searchResults.set([]);
      this.searching.set(false);
      return;
    }

    this.searching.set(true);
    this.searchTimer = setTimeout(() => this.runSearch(), FRIENDS_SEARCH_DEBOUNCE_MS);
  }

  runSearch(): void {
    const q = this.searchQuery().trim();
    if (!shouldTriggerFriendsSearch(q)) {
      this.searchResults.set([]);
      this.searching.set(false);
      return;
    }

    this.friends.searchUsers(q).subscribe({
      next: (r) => {
        this.searchResults.set(r);
        this.searching.set(false);
      },
      error: () => {
        this.searchResults.set([]);
        this.searching.set(false);
      },
    });
  }

  sendRequest(userId: string): void {
    this.message.set(null);
    this.friends.sendRequest(userId).subscribe({
      next: () => {
        this.message.set('Demande envoyée !');
        this.reload();
        this.runSearch();
        this.loadSuggestions();
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
        this.loadSuggestions();
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

  setTab(tab: FriendsTab): void {
    this.activeTab.set(tab);
  }

  statusLabel(status: FriendRelationshipStatus): string | null {
    return relationshipStatusLabel(status);
  }

  memberSinceLabel(iso: string): string {
    return formatMemberSince(iso);
  }

  friendSinceLabel(friend: FriendUser): string {
    return friend.friendSince ? formatMemberSince(friend.friendSince) : '';
  }

  isSuggestion(card: DiscoverCard): card is UserSuggestion {
    return 'suggestionReason' in card;
  }

  cardRelationship(card: DiscoverCard): FriendRelationshipStatus {
    return card.relationshipStatus;
  }

  cardBio(card: DiscoverCard): string | null | undefined {
    return card.bio;
  }

  cardMemberSince(card: DiscoverCard): string {
    return card.memberSince;
  }

  copyMyPseudo(): void {
    const name = this.myDisplayName().trim();
    if (!name) return;
    navigator.clipboard.writeText(name).then(
      () => this.message.set('Pseudo copié — partagez-le sur Discord !'),
      () => this.message.set('Impossible de copier le pseudo.'),
    );
  }
}
