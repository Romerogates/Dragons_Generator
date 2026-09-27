import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { Navbar } from './shared/components/navbar/navbar';
import { AppContextMenu } from './shared/components/app-context-menu/app-context-menu';
import { AiRateLimitDialogComponent } from './shared/components/ai-rate-limit-dialog/ai-rate-limit-dialog';
import { SiteFooterComponent } from './shared/components/site-footer/site-footer';
import { GameLabelCatalogService } from '@core/services/game-label-catalog.service';
import { AuthService } from '@core/services/auth.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { NotificationService } from '@core/services/notification.service';
import { PushNotificationService } from '@core/services/push-notification.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { PwaLifecycleService } from '@core/services/pwa-lifecycle.service';
import { FriendChatDockComponent } from './shared/components/friend-chat-dock/friend-chat-dock';
import { CampaignSessionDockComponent } from './shared/components/campaign-session-dock/campaign-session-dock';
import { AiGenerationDock } from './shared/components/ai-generation-dock/ai-generation-dock';
import { clearPersistedAiRateLimit } from '@core/utils/ai-rate-limit.util';
import {
  dismissAuthCookieMigrationBanner,
  shouldShowReconnectBanner,
} from '@core/utils/legacy-auth-migration.util';

/** Hauteur de repli si mesure DOM indisponible. */
const BANNER_ROW_PX_FALLBACK = 40;

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    Navbar,
    SiteFooterComponent,
    AppContextMenu,
    AiRateLimitDialogComponent,
    FriendChatDockComponent,
    CampaignSessionDockComponent,
    AiGenerationDock,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly gameLabels = inject(GameLabelCatalogService);
  private readonly auth = inject(AuthService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly notifications = inject(NotificationService);
  private readonly push = inject(PushNotificationService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly pwa = inject(PwaLifecycleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly title = signal('DragonsGenerator.WEB');

  readonly isOnline = this.connectivity.isOnline;
  readonly pendingSyncCount = this.offlineSync.pendingCount;
  readonly updateReady = this.pwa.updateReady;
  readonly showReconnectBanner = signal(shouldShowReconnectBanner());

  /** Table /play : plein écran (chrome dédié). Le guide garde navbar + footer. */
  readonly hideSiteChrome = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.shouldHideSiteChrome(this.router.url)),
      startWith(this.shouldHideSiteChrome(this.router.url)),
    ),
    { initialValue: false },
  );

  private shouldHideSiteChrome(url: string): boolean {
    const path = url.split('?')[0] ?? url;
    return /\/campaigns\/[^/]+\/play\/?$/.test(path);
  }

  constructor() {
    effect(() => {
      // Dépendances signal : recalcule quand une bannière apparaît/disparaît.
      void this.showReconnectBanner();
      void this.isOnline();
      void this.updateReady();
      queueMicrotask(() => this.measureBannerHeight());
    });
    this.destroyRef.onDestroy(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.removeProperty('--dg-banner-height');
      }
    });
    if (typeof window !== 'undefined') {
      const onResize = (): void => this.measureBannerHeight();
      window.addEventListener('resize', onResize);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', onResize));
    }
  }

  private measureBannerHeight(): void {
    if (typeof document === 'undefined') return;
    const root = this.host.nativeElement as HTMLElement;
    const banners = root.querySelectorAll<HTMLElement>('[data-dg-banner]');
    let total = 0;
    banners.forEach((el) => {
      total += el.getBoundingClientRect().height;
    });
    if (total <= 0) {
      let rows = 0;
      if (this.showReconnectBanner()) rows += 1;
      if (!this.isOnline()) rows += 1;
      if (this.updateReady()) rows += 1;
      total = rows * BANNER_ROW_PX_FALLBACK;
    }
    document.documentElement.style.setProperty('--dg-banner-height', `${Math.round(total)}px`);
  }

  ngOnInit(): void {
    this.showReconnectBanner.set(shouldShowReconnectBanner());
    this.gameLabels.warmUp();
    this.auth.initSessionSync();
    this.offlineSync.init();
    this.notifications.init();
    this.pwa.init();
    if (this.auth.isLoggedIn()) {
      this.push.initAfterLogin();
    }
    if (this.auth.isAdmin()) clearPersistedAiRateLimit();
  }

  applyUpdate(): void {
    this.pwa.applyUpdate();
  }

  dismissUpdate(): void {
    this.pwa.dismissUpdate();
  }

  dismissReconnectBanner(): void {
    dismissAuthCookieMigrationBanner();
    this.showReconnectBanner.set(false);
  }
}
