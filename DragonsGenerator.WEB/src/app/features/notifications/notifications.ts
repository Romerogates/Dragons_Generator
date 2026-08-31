import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService } from '@core/services/notification.service';
import { NotificationPreferencesService } from '@core/services/notification-preferences.service';
import { AuthService } from '@core/services/auth.service';
import type { NotificationItem, NotificationType } from '@core/models/notification.model';

type NotifFilter = 'all' | 'friends' | 'campaigns';

const FRIEND_KINDS: NotificationType[] = ['friend_request', 'friend_message'];
const CAMPAIGN_KINDS: NotificationType[] = [
  'campaign_invite',
  'character_proposal',
  'proposal_rejected',
  'proposal_approved',
];

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './notifications.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class NotificationsPage implements OnInit {
  private readonly notifications = inject(NotificationService);
  private readonly notifPrefs = inject(NotificationPreferencesService);
  private readonly auth = inject(AuthService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly allItems = this.notifications.items;
  readonly filter = signal<NotifFilter>('all');

  readonly visibleItems = computed(() => {
    const f = this.filter();
    return this.notifications
      .items()
      .filter((item) => this.notifPrefs.isKindEnabled(item.kind))
      .filter((item) => !this.notifPrefs.isDismissed(item.key))
      .filter((item) => {
        if (f === 'all') return true;
        if (f === 'friends') return FRIEND_KINDS.includes(item.kind);
        return CAMPAIGN_KINDS.includes(item.kind);
      });
  });

  readonly friendsCount = computed(
    () =>
      this.notifications
        .items()
        .filter((i) => FRIEND_KINDS.includes(i.kind) && this.notifPrefs.isKindEnabled(i.kind))
        .filter((i) => !this.notifPrefs.isDismissed(i.key)).length,
  );

  readonly campaignsCount = computed(
    () =>
      this.notifications
        .items()
        .filter((i) => CAMPAIGN_KINDS.includes(i.kind) && this.notifPrefs.isKindEnabled(i.kind))
        .filter((i) => !this.notifPrefs.isDismissed(i.key)).length,
  );

  readonly totalVisible = computed(() => this.visibleItems().length);
  readonly hiddenByPrefsCount = computed(() => {
    const all = this.notifications.items();
    return all.filter((i) => !this.notifPrefs.isKindEnabled(i.kind)).length;
  });

  ngOnInit(): void {
    this.notifications.refresh();
  }

  setFilter(f: NotifFilter): void {
    this.filter.set(f);
  }

  dismiss(item: NotificationItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.notifPrefs.dismiss(item.key);
  }

  clearDismissed(): void {
    this.notifPrefs.clearDismissed();
  }

  iconFor(kind: NotificationType): string {
    switch (kind) {
      case 'friend_request':
        return 'fluent-emoji:handshake';
      case 'friend_message':
        return 'fluent-emoji:speech-balloon';
      case 'campaign_invite':
        return 'fluent-emoji:world-map';
      case 'character_proposal':
        return 'fluent-emoji:bust-in-silhouette';
      case 'proposal_rejected':
        return 'fluent-emoji:warning';
      case 'proposal_approved':
        return 'fluent-emoji:check-mark-button';
    }
  }

  relativeTime(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diffSec = Math.round((Date.now() - t) / 1000);
    if (diffSec < 60) return 'à l’instant';
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
    if (diffSec < 86400 * 7) return `il y a ${Math.floor(diffSec / 86400)} j`;
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackItem(_index: number, item: NotificationItem): string {
    return item.key;
  }
}
