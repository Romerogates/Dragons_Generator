import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';
import { AppContextMenu } from './shared/components/app-context-menu/app-context-menu';
import { AiRateLimitDialogComponent } from './shared/components/ai-rate-limit-dialog/ai-rate-limit-dialog';
import { SiteFooterComponent } from './shared/components/site-footer/site-footer';
import { GameLabelCatalogService } from '@core/services/game-label-catalog.service';
import { AuthService } from '@core/services/auth.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { NotificationService } from '@core/services/notification.service';
import { clearPersistedAiRateLimit } from '@core/utils/ai-rate-limit.util';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, SiteFooterComponent, AppContextMenu, AiRateLimitDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly gameLabels = inject(GameLabelCatalogService);
  private readonly auth = inject(AuthService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly notifications = inject(NotificationService);
  protected readonly title = signal('DragonsGenerator.WEB');

  ngOnInit(): void {
    this.gameLabels.warmUp();
    this.offlineSync.init();
    this.notifications.init();
    if (this.auth.isAdmin()) clearPersistedAiRateLimit();
  }
}
