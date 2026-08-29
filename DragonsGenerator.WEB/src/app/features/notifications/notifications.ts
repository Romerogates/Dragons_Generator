import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import type { NotificationItem, NotificationType } from '@core/models/notification.model';

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
  private readonly auth = inject(AuthService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly items = this.notifications.items;
  readonly totalCount = this.notifications.totalCount;

  ngOnInit(): void {
    this.notifications.refresh();
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
    }
  }

  trackItem(_index: number, item: NotificationItem): string {
    return item.key;
  }
}
