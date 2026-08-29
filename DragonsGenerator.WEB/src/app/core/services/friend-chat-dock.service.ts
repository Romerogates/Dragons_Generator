import { Injectable, computed, inject, signal } from '@angular/core';
import { FriendChatService, FriendChatSummary } from './friend-chat.service';
import { FriendsService } from './friends.service';
import { AuthService } from './auth.service';
import { FriendUser } from '@core/models/Campaign/campaign';

export interface ChatConversation {
  friendUserId: string;
  friendDisplayName: string;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

type ChatHistoryState = { dgFriendChat: true };

@Injectable({ providedIn: 'root' })
export class FriendChatDockService {
  private readonly chat = inject(FriendChatService);
  private readonly friends = inject(FriendsService);
  private readonly auth = inject(AuthService);

  readonly isOpen = signal(false);
  readonly view = signal<'list' | 'thread'>('list');
  readonly activeFriendId = signal<string | null>(null);
  readonly activeFriendName = signal('');
  readonly summaries = signal<FriendChatSummary[]>([]);
  readonly friendsList = signal<FriendUser[]>([]);
  readonly searchQuery = signal('');
  readonly loadingList = signal(false);

  readonly totalUnread = computed(() =>
    this.summaries().reduce((sum, s) => sum + s.unreadCount, 0)
  );

  readonly conversations = computed((): ChatConversation[] => {
    const byId = new Map(this.summaries().map((s) => [s.friendUserId, s]));
    return this.friendsList()
      .map((f) => {
        const s = byId.get(f.id);
        return {
          friendUserId: f.id,
          friendDisplayName: f.displayName,
          lastMessagePreview: s?.lastMessagePreview?.trim() || 'Dites bonjour',
          lastMessageAt: s?.lastMessageAt ?? null,
          unreadCount: s?.unreadCount ?? 0,
        };
      })
      .sort((a, b) => {
        const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
        const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
        if (tb !== ta) return tb - ta;
        return a.friendDisplayName.localeCompare(b.friendDisplayName, 'fr');
      });
  });

  readonly filteredConversations = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.conversations();
    return this.conversations().filter((c) =>
      c.friendDisplayName.toLowerCase().includes(q)
    );
  });

  private summaryPollTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  /** Une seule entrée history tant que le chat est ouvert (évite de quitter la PWA). */
  private historyArmed = false;
  private ignorePopState = false;
  private readonly onPopState = (event: PopStateEvent): void => {
    if (this.ignorePopState || !this.isOpen()) return;
    event.stopImmediatePropagation();
    this.handleMobileBack();
  };

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.onPopState, true);
    }
    this.refreshList();
    this.summaryPollTimer = setInterval(() => {
      if (this.auth.isLoggedIn()) this.refreshSummaries();
    }, 20_000);
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.onPopState, true);
    }
    if (this.summaryPollTimer) {
      clearInterval(this.summaryPollTimer);
      this.summaryPollTimer = null;
    }
    this.setBodyScrollLocked(false);
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  open(): void {
    if (!this.auth.isLoggedIn()) return;
    this.isOpen.set(true);
    this.view.set('list');
    this.armHistory();
    this.setBodyScrollLocked(true);
    this.refreshList();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.applyClose();
    this.disarmHistory();
  }

  openThread(friendUserId: string, displayName: string): void {
    if (!this.auth.isLoggedIn()) return;
    this.activeFriendId.set(friendUserId);
    this.activeFriendName.set(displayName);
    this.view.set('thread');
    this.isOpen.set(true);
    this.armHistory();
    this.setBodyScrollLocked(true);
    this.refreshList();
  }

  backToList(): void {
    if (this.view() !== 'thread') return;
    this.applyBackToList();
  }

  refreshList(): void {
    if (!this.auth.isLoggedIn()) return;
    this.loadingList.set(true);
    this.friends.listFriends().subscribe({
      next: (list) => {
        this.friendsList.set(list);
        this.loadingList.set(false);
      },
      error: () => this.loadingList.set(false),
    });
    this.refreshSummaries();
  }

  refreshSummaries(): void {
    if (!this.auth.isLoggedIn()) {
      this.summaries.set([]);
      return;
    }
    this.chat.listSummaries().subscribe((s) => this.summaries.set(s));
  }

  /** Bouton retour système / geste : conversation → liste → fermer, sans quitter l'app. */
  private handleMobileBack(): void {
    if (this.view() === 'thread') {
      this.applyBackToList();
      this.rearmHistory();
      return;
    }
    this.applyClose();
    this.historyArmed = false;
  }

  private applyBackToList(): void {
    this.view.set('list');
    this.activeFriendId.set(null);
    this.activeFriendName.set('');
    this.refreshSummaries();
  }

  private applyClose(): void {
    this.isOpen.set(false);
    this.view.set('list');
    this.activeFriendId.set(null);
    this.activeFriendName.set('');
    this.searchQuery.set('');
    this.setBodyScrollLocked(false);
  }

  private armHistory(): void {
    if (this.historyArmed || typeof history === 'undefined') return;
    history.pushState({ dgFriendChat: true } satisfies ChatHistoryState, '', this.currentHref());
    this.historyArmed = true;
  }

  /** Après un retour depuis une conversation, remet une entrée pour ne pas quitter la PWA. */
  private rearmHistory(): void {
    if (typeof history === 'undefined') return;
    this.ignorePopState = true;
    history.pushState({ dgFriendChat: true } satisfies ChatHistoryState, '', this.currentHref());
    this.historyArmed = true;
    this.ignorePopState = false;
  }

  private disarmHistory(): void {
    if (!this.historyArmed || typeof history === 'undefined') return;
    this.ignorePopState = true;
    history.back();
    this.historyArmed = false;
    this.ignorePopState = false;
  }

  private currentHref(): string {
    if (typeof window === 'undefined') return '/';
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  private setBodyScrollLocked(lock: boolean): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    document.body.style.overflow = lock && mobile ? 'hidden' : '';
  }
}
