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

type ChatHistoryState = { dgFriendChat: 'list' | 'thread'; friendId?: string };

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
  private historyDepth = 0;
  private ignorePopState = false;
  private readonly onPopState = (): void => this.handlePopState();

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.onPopState);
    }
    this.refreshList();
    this.summaryPollTimer = setInterval(() => {
      if (this.auth.isLoggedIn()) this.refreshSummaries();
    }, 20_000);
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.onPopState);
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
    this.pushHistory({ dgFriendChat: 'list' });
    this.setBodyScrollLocked(true);
    this.refreshList();
  }

  close(): void {
    if (!this.isOpen()) return;
    const steps = this.historyDepth;
    this.applyClose();
    if (steps > 0) {
      this.ignorePopState = true;
      history.go(-steps);
      this.historyDepth = 0;
      this.ignorePopState = false;
    }
  }

  openThread(friendUserId: string, displayName: string): void {
    if (!this.auth.isLoggedIn()) return;
    const wasOpen = this.isOpen();
    this.activeFriendId.set(friendUserId);
    this.activeFriendName.set(displayName);
    this.view.set('thread');
    this.isOpen.set(true);
    if (!wasOpen) {
      this.pushHistory({ dgFriendChat: 'list' });
    }
    this.pushHistory({ dgFriendChat: 'thread', friendId: friendUserId });
    this.setBodyScrollLocked(true);
    this.refreshList();
  }

  backToList(): void {
    if (this.view() !== 'thread') return;
    history.back();
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

  private handlePopState(): void {
    if (this.ignorePopState) return;

    if (this.view() === 'thread') {
      this.applyBackToList();
      this.historyDepth = Math.max(0, this.historyDepth - 1);
      return;
    }

    if (this.isOpen()) {
      this.applyClose();
      this.historyDepth = 0;
    }
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

  private pushHistory(state: ChatHistoryState): void {
    if (typeof history === 'undefined') return;
    history.pushState(state, '');
    this.historyDepth++;
  }

  private setBodyScrollLocked(lock: boolean): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    document.body.style.overflow = lock && mobile ? 'hidden' : '';
  }
}
