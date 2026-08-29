import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FriendChatService, FriendMessage } from '@core/services/friend-chat.service';
import { FriendsService } from '@core/services/friends.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-friend-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './friend-chat.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class FriendChatPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly chat = inject(FriendChatService);
  private readonly friends = inject(FriendsService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  @ViewChild('scrollBox') scrollBox?: ElementRef<HTMLDivElement>;

  readonly friendId = signal<string | null>(null);
  readonly friendName = signal('Ami');
  readonly messages = signal<FriendMessage[]>([]);
  readonly draft = signal('');
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly isLoggedIn = this.auth.isLoggedIn;

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      return;
    }
    const id = this.route.snapshot.paramMap.get('userId');
    if (!id) return;
    this.friendId.set(id);
    this.resolveFriendName(id);
    this.loadMessages(true);
    this.pollTimer = setInterval(() => this.loadMessages(false), 5000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  send(): void {
    const id = this.friendId();
    const text = this.draft().trim();
    if (!id || !text || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.chat.sendMessage(id, text).subscribe({
      next: (msg) => {
        this.draft.set('');
        this.messages.update((list) => [...list, msg]);
        this.sending.set(false);
        this.scrollToBottom();
        this.notifications.refresh();
      },
      error: () => {
        this.error.set('Impossible d\'envoyer le message.');
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

  private resolveFriendName(id: string): void {
    this.friends.listFriends().subscribe((list) => {
      const match = list.find((f) => f.id === id);
      if (match) this.friendName.set(match.displayName);
    });
  }

  private loadMessages(initial: boolean): void {
    const id = this.friendId();
    if (!id) return;
    const after =
      !initial && this.messages().length > 0
        ? this.messages()[this.messages().length - 1].createdAt
        : undefined;

    this.chat.listMessages(id, after).subscribe({
      next: (batch) => {
        if (initial) {
          this.messages.set(batch);
          this.loading.set(false);
          this.chat.markRead(id).subscribe(() => this.notifications.refresh());
        } else if (batch.length > 0) {
          this.messages.update((list) => {
            const ids = new Set(list.map((m) => m.id));
            return [...list, ...batch.filter((m) => !ids.has(m.id))];
          });
          this.chat.markRead(id).subscribe(() => this.notifications.refresh());
        }
        if (batch.length > 0) this.scrollToBottom();
      },
      error: () => {
        if (initial) {
          this.error.set('Conversation inaccessible.');
          this.loading.set(false);
        }
      },
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollBox?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }
}
