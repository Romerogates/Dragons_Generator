import { Injectable, computed, inject, signal } from '@angular/core';
import { FriendChatService, FriendChatSummary } from './friend-chat.service';
import { FriendsService } from './friends.service';
import { AuthService } from './auth.service';
import { AiGenerationProgressService } from './ai-generation-progress.service';
import { FriendUser } from '@core/models/Campaign/campaign';

export interface ChatConversation {
  friendUserId: string;
  friendDisplayName: string;
  friendAvatarEmoji?: string | null;
  friendAccentColor?: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

type ChatHistoryLayer = 'list' | 'thread';
type ChatHistoryState = { dgFriendChat: ChatHistoryLayer };

const CHAT_HASH_LIST = '#dg-chat';
const CHAT_HASH_THREAD = '#dg-chat-thread';

@Injectable({ providedIn: 'root' })
export class FriendChatDockService {
  private readonly chat = inject(FriendChatService);
  private readonly friends = inject(FriendsService);
  private readonly auth = inject(AuthService);
  private readonly aiProgress = inject(AiGenerationProgressService);

  readonly isOpen = signal(false);
  /** Mode Messenger : quasi plein écran, liste + fil côte à côte (desktop). */
  readonly expanded = signal(false);
  readonly view = signal<'list' | 'thread'>('list');
  readonly activeFriendId = signal<string | null>(null);
  readonly activeFriendName = signal('');
  readonly activeFriendAvatar = signal<string | null>(null);
  readonly activeFriendAccent = signal<string | null>(null);
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
            friendAvatarEmoji: f.avatarEmoji,
            friendAccentColor: f.accentColor,
            lastMessagePreview: s?.lastMessagePreview?.trim()
              ? s.lastMessagePreview.trim()
              : s?.lastMessageAt
                ? 'Pièce jointe'
                : 'Dites bonjour',
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
  /** Nombre d’entrées history poussées pour le dock (liste, puis fil). */
  private historyDepth = 0;
  /** Pops déclenchés par close()/backToList() UI — à ignorer. */
  private pendingPops = 0;
  private readonly onPopState = (event: PopStateEvent): void => {
    if (this.pendingPops > 0) {
      this.pendingPops -= 1;
      return;
    }
    if (!this.isOpen()) return;
    event.stopImmediatePropagation();
    this.handleMobileBack();
  };

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    if (typeof window !== 'undefined') {
      this.stripStaleChatHash();
      window.addEventListener('popstate', this.onPopState, true);
    }
    this.refreshList();
    this.summaryPollTimer = setInterval(() => {
      if (this.auth.isLoggedIn() && !this.aiProgress.active()) this.refreshSummaries();
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

  open(options?: { expanded?: boolean }): void {
    if (!this.auth.isLoggedIn()) return;
    this.isOpen.set(true);
    this.expanded.set(options?.expanded === true);
    this.view.set('list');
    this.ensureListHistory();
    this.setBodyScrollLocked(true);
    this.refreshList();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.applyClose();
    this.dropChatHistory();
  }

  /**
   * Ferme le dock avant une navigation Angular (fiche, /join…).
   * N’appelle pas history.back() — sinon la navigation est annulée.
   */
  dismissForNavigation(): void {
    this.historyDepth = 0;
    this.pendingPops = 0;
    if (!this.isOpen()) return;
    this.applyClose();
  }

  setExpanded(expanded: boolean): void {
    if (!this.isOpen()) return;
    this.expanded.set(expanded);
    this.setBodyScrollLocked(true);
  }

  toggleExpanded(): void {
    this.setExpanded(!this.expanded());
  }

  openThread(
    friendUserId: string,
    displayName: string,
    avatarEmoji?: string | null,
    accentColor?: string | null,
    options?: { expanded?: boolean },
  ): void {
    if (!this.auth.isLoggedIn()) return;
    this.activeFriendId.set(friendUserId);
    this.activeFriendName.set(displayName);
    this.activeFriendAvatar.set(avatarEmoji ?? null);
    this.activeFriendAccent.set(accentColor ?? null);
    this.view.set('thread');
    this.isOpen.set(true);
    if (options?.expanded !== undefined) {
      this.expanded.set(options.expanded);
    }
    this.clearUnreadLocal(friendUserId);
    this.ensureListHistory();
    this.ensureThreadHistory();
    this.setBodyScrollLocked(true);
    this.refreshList();
  }

  /** Badge immédiat (avant la réponse markRead API). */
  clearUnreadLocal(friendUserId: string): void {
    this.summaries.update((list) =>
      list.map((s) => (s.friendUserId === friendUserId ? { ...s, unreadCount: 0 } : s)),
    );
  }

  backToList(): void {
    if (this.view() !== 'thread') return;
    this.applyBackToList();
    this.popThreadHistory();
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
    this.chat.listSummaries().subscribe({
      next: (s) => {
        const active = this.view() === 'thread' ? this.activeFriendId() : null;
        if (!active) {
          this.summaries.set(s);
          return;
        }
        this.summaries.set(
          s.map((row) => (row.friendUserId === active ? { ...row, unreadCount: 0 } : row)),
        );
      },
      error: () => undefined,
    });
  }

  /** Bouton retour système / geste : conversation → liste → fermer, sans quitter l'app. */
  private handleMobileBack(): void {
    if (this.view() === 'thread') {
      this.applyBackToList();
      this.historyDepth = Math.max(0, this.historyDepth - 1);
      return;
    }
    this.applyClose();
    this.historyDepth = 0;
  }

  private applyBackToList(): void {
    this.view.set('list');
    this.activeFriendId.set(null);
    this.activeFriendName.set('');
    this.activeFriendAvatar.set(null);
    this.activeFriendAccent.set(null);
    this.refreshSummaries();
  }

  private applyClose(): void {
    this.isOpen.set(false);
    this.expanded.set(false);
    this.view.set('list');
    this.activeFriendId.set(null);
    this.activeFriendName.set('');
    this.activeFriendAvatar.set(null);
    this.activeFriendAccent.set(null);
    this.searchQuery.set('');
    this.setBodyScrollLocked(false);
  }

  private ensureListHistory(): void {
    if (typeof history === 'undefined' || this.historyDepth >= 1) return;
    history.pushState({ dgFriendChat: 'list' } satisfies ChatHistoryState, '', this.chatHref('list'));
    this.historyDepth = 1;
  }

  private ensureThreadHistory(): void {
    if (typeof history === 'undefined') return;
    if (this.historyDepth >= 2) {
      history.replaceState(
        { dgFriendChat: 'thread' } satisfies ChatHistoryState,
        '',
        this.chatHref('thread'),
      );
      return;
    }
    history.pushState({ dgFriendChat: 'thread' } satisfies ChatHistoryState, '', this.chatHref('thread'));
    this.historyDepth = 2;
  }

  private popThreadHistory(): void {
    if (this.historyDepth < 2 || typeof history === 'undefined') {
      this.historyDepth = Math.min(this.historyDepth, 1);
      return;
    }
    this.pendingPops += 1;
    this.historyDepth = 1;
    history.back();
  }

  private dropChatHistory(): void {
    if (this.historyDepth <= 0 || typeof history === 'undefined') {
      this.historyDepth = 0;
      return;
    }
    this.pendingPops += this.historyDepth;
    history.go(-this.historyDepth);
    this.historyDepth = 0;
  }

  private chatHref(layer: ChatHistoryLayer): string {
    if (typeof window === 'undefined') return layer === 'thread' ? CHAT_HASH_THREAD : CHAT_HASH_LIST;
    const hash = layer === 'thread' ? CHAT_HASH_THREAD : CHAT_HASH_LIST;
    return `${window.location.pathname}${window.location.search}${hash}`;
  }

  private stripStaleChatHash(): void {
    if (typeof window === 'undefined' || typeof history === 'undefined') return;
    const hash = window.location.hash;
    if (hash !== CHAT_HASH_LIST && hash !== CHAT_HASH_THREAD) return;
    history.replaceState(
      history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  }

  private setBodyScrollLocked(lock: boolean): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    document.body.style.overflow = lock && (mobile || this.expanded()) ? 'hidden' : '';
  }
}
