import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { FriendChatDockService } from '@core/services/friend-chat-dock.service';
import { FriendChatService, FriendMessage } from '@core/services/friend-chat.service';
import { NotificationService } from '@core/services/notification.service';
import type { ChatConversation } from '@core/services/friend-chat-dock.service';

@Component({
  selector: 'app-friend-chat-dock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './friend-chat-dock.html',
  styleUrl: './friend-chat-dock.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FriendChatDockComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  readonly dock = inject(FriendChatDockService);
  private readonly chat = inject(FriendChatService);
  private readonly notifications = inject(NotificationService);

  @ViewChild('threadScroll') threadScroll?: ElementRef<HTMLDivElement>;

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly messages = signal<FriendMessage[]>([]);
  readonly draft = signal('');
  readonly threadLoading = signal(false);
  readonly sending = signal(false);
  readonly threadError = signal<string | null>(null);

  private messagePollTimer: ReturnType<typeof setInterval> | null = null;
  private activeThreadId: string | null = null;

  constructor() {
    effect(() => {
      if (this.dock.view() === 'thread') {
        const id = this.dock.activeFriendId();
        if (id) this.startThread(id);
      } else {
        this.stopThreadPoll();
        this.messages.set([]);
        this.draft.set('');
        this.threadError.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.dock.init();
  }

  ngOnDestroy(): void {
    this.stopThreadPoll();
    this.dock.destroy();
  }

  toggle(): void {
    this.dock.toggle();
  }

  close(): void {
    this.stopThreadPoll();
    this.dock.close();
  }

  openConversation(c: ChatConversation): void {
    this.dock.openThread(c.friendUserId, c.friendDisplayName);
  }

  backToList(): void {
    this.dock.backToList();
  }

  private startThread(friendId: string): void {
    if (this.activeThreadId === friendId && this.messagePollTimer) return;
    this.stopThreadPoll();
    this.activeThreadId = friendId;
    this.messages.set([]);
    this.threadLoading.set(true);
    this.threadError.set(null);
    this.loadMessages(friendId, true);
    this.messagePollTimer = setInterval(() => this.loadMessages(friendId, false), 5000);
  }

  send(): void {
    const id = this.dock.activeFriendId();
    const text = this.draft().trim();
    if (!id || !text || this.sending()) return;
    this.sending.set(true);
    this.threadError.set(null);
    this.chat.sendMessage(id, text).subscribe({
      next: (msg) => {
        this.draft.set('');
        this.messages.update((list) => [...list, msg]);
        this.sending.set(false);
        this.scrollThreadToBottom();
        this.dock.refreshSummaries();
        this.notifications.refresh();
      },
      error: () => {
        this.threadError.set('Envoi impossible.');
        this.sending.set(false);
      },
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  initial(name: string): string {
    const t = name.trim();
    return t ? t[0]!.toUpperCase() : '?';
  }

  formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  trackConversation(_i: number, c: ChatConversation): string {
    return c.friendUserId;
  }

  trackMessage(_i: number, m: FriendMessage): string {
    return m.id;
  }

  private loadMessages(friendId: string, initial: boolean): void {
    const after =
      !initial && this.messages().length > 0
        ? this.messages()[this.messages().length - 1]!.createdAt
        : undefined;

    this.chat.listMessages(friendId, after).subscribe({
      next: (batch) => {
        if (initial) {
          this.messages.set(batch);
          this.threadLoading.set(false);
          this.chat.markRead(friendId).subscribe(() => {
            this.dock.refreshSummaries();
            this.notifications.refresh();
          });
        } else if (batch.length > 0) {
          this.messages.update((list) => {
            const ids = new Set(list.map((m) => m.id));
            return [...list, ...batch.filter((m) => !ids.has(m.id))];
          });
          this.chat.markRead(friendId).subscribe(() => {
            this.dock.refreshSummaries();
            this.notifications.refresh();
          });
        }
        if (batch.length > 0) this.scrollThreadToBottom();
      },
      error: () => {
        if (initial) {
          this.threadError.set('Conversation inaccessible.');
          this.threadLoading.set(false);
        }
      },
    });
  }

  private scrollThreadToBottom(): void {
    setTimeout(() => {
      const el = this.threadScroll?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  private stopThreadPoll(): void {
    if (this.messagePollTimer) {
      clearInterval(this.messagePollTimer);
      this.messagePollTimer = null;
    }
    this.activeThreadId = null;
  }
}
