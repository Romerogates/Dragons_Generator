import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  computed,
  signal,
  HostListener,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import { NotificationPreferencesService } from '@core/services/notification-preferences.service';
import { NotificationService } from '@core/services/notification.service';
import { ProfileAvatarComponent } from '@shared/components/profile-avatar/profile-avatar';
import type { NotificationType } from '@core/models/notification.model';
import { CODEX_NAV_LINKS, filterCodexNavLinks } from '@core/config/codex-nav';

export interface NavLink {
  label: string;
  path: string;
  icon: string;
}

const FRIEND_ACTION_KINDS: NotificationType[] = ['friend_request', 'friend_message'];
const CAMPAIGN_ACTION_KINDS: NotificationType[] = [
  'campaign_invite',
  'character_proposal',
  'character_pick_requested',
  'proposal_rejected',
];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ProfileAvatarComponent],
  templateUrl: './navbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Navbar implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly notifPrefs = inject(NotificationPreferencesService);
  readonly guidePrefs = inject(GuidePreferencesService);
  private routerSub?: Subscription;

  readonly mobileOpen = signal(false);
  /**
   * Une fois ouvert, le panneau mobile reste monté (CSS hide) pour ne pas
   * recharger les iconify-icon à chaque ouverture du burger.
   */
  readonly mobileMenuMounted = signal(false);
  readonly codexOpen = signal(false);
  readonly creationOpen = signal(false);
  readonly accountOpen = signal(false);

  readonly friendsActionCount = computed(
    () =>
      this.notifications
        .items()
        .filter(
          (item) =>
            FRIEND_ACTION_KINDS.includes(item.kind) &&
            this.notifPrefs.isKindEnabled(item.kind) &&
            !this.notifPrefs.isDismissed(item.key),
        ).length,
  );
  readonly campaignsActionCount = computed(
    () =>
      this.notifications
        .items()
        .filter(
          (item) =>
            CAMPAIGN_ACTION_KINDS.includes(item.kind) &&
            this.notifPrefs.isKindEnabled(item.kind) &&
            !this.notifPrefs.isDismissed(item.key),
        ).length,
  );
  readonly notificationCount = computed(
    () => this.friendsActionCount() + this.campaignsActionCount(),
  );
  readonly guideNewsCount = this.guidePrefs.unreadNewsCount;
  /** Badge hamburger (md–lg) : notifs + demandes + campagnes + guide. */
  readonly hamburgerBadgeCount = computed(
    () => this.notificationCount() + this.guideNewsCount(),
  );

  private savedScrollY = 0;
  private bodyScrollLocked = false;

  readonly creationLinks: NavLink[] = [
    { label: 'Forger un héros', path: '/create', icon: 'fluent-emoji:hammer-and-pick' },
    { label: 'Nouveau scénario', path: '/story/create', icon: 'fluent-emoji:scroll' },
    { label: 'Héros', path: '/characters', icon: 'fluent-emoji:busts-in-silhouette' },
    { label: 'Donjons', path: '/dungeons', icon: 'fluent-emoji:japanese-castle' },
  ];

  readonly codexLinks: NavLink[] = [
    { label: 'Accueil Codex', path: '/codex', icon: 'fluent-emoji:books' },
    ...CODEX_NAV_LINKS.map((l) => ({ label: l.label, path: l.path, icon: l.icon })),
  ];

  readonly codexFilter = signal('');
  readonly filteredCodexLinks = computed(() => {
    const q = this.codexFilter().trim().toLowerCase();
    if (!q) return this.codexLinks;
    const matched = new Set(filterCodexNavLinks(q).map((l) => l.path));
    return this.codexLinks.filter(
      (l) =>
        l.path === '/codex' ||
        matched.has(l.path) ||
        l.label.toLowerCase().includes(q) ||
        l.path.toLowerCase().includes(q),
    );
  });

  private readonly router = inject(Router);

  /** Sur la forge, la navbar défile pour laisser les étapes collées en haut. */
  readonly forgeRoute = signal(false);

  ngOnInit(): void {
    this.syncForgeRoute(this.router.url);
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.closeMenus();
        this.syncForgeRoute(e.urlAfterRedirects);
      });
  }

  private syncForgeRoute(url: string): void {
    const path = url.split('?')[0] ?? url;
    this.forgeRoute.set(path === '/create' || path.startsWith('/create/'));
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
    this.routerSub?.unsubscribe();
  }

  formatBadgeCount(count: number): string {
    return count > 9 ? '9+' : String(count);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('[data-creation-menu]')) this.creationOpen.set(false);
    if (!target?.closest('[data-codex-menu]')) this.codexOpen.set(false);
    if (!target?.closest('[data-account-menu]')) this.accountOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenus();
  }

  toggleCreation(event: Event): void {
    event.stopPropagation();
    this.creationOpen.update((v) => !v);
    this.codexOpen.set(false);
    this.accountOpen.set(false);
  }

  toggleCodex(event: Event): void {
    event.stopPropagation();
    this.codexOpen.update((v) => !v);
    this.creationOpen.set(false);
    this.accountOpen.set(false);
  }

  toggleAccount(event: Event): void {
    event.stopPropagation();
    this.accountOpen.update((v) => !v);
    this.creationOpen.set(false);
    this.codexOpen.set(false);
  }

  toggleMobile(): void {
    const opening = !this.mobileOpen();
    this.mobileOpen.set(opening);
    if (opening) this.mobileMenuMounted.set(true);
    this.syncBodyScrollLock();
    if (!opening) {
      this.creationOpen.set(false);
      this.codexOpen.set(false);
      this.accountOpen.set(false);
    }
  }

  closeMenus(): void {
    this.mobileOpen.set(false);
    this.creationOpen.set(false);
    this.codexOpen.set(false);
    this.accountOpen.set(false);
    this.codexFilter.set('');
    this.syncBodyScrollLock();
  }

  logout(): void {
    this.closeMenus();
    this.auth.logout();
  }

  isCreationActive(): boolean {
    return this.creationLinks.some((l) => this.router.url.startsWith(l.path));
  }

  isCodexActive(): boolean {
    return this.codexLinks.some((l) => this.router.url.startsWith(l.path));
  }

  private syncBodyScrollLock(): void {
    if (typeof document === 'undefined') return;

    if (this.mobileOpen()) {
      if (this.bodyScrollLocked) return;
      this.savedScrollY = window.scrollY;
      const body = document.body;
      body.style.position = 'fixed';
      body.style.top = `-${this.savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      this.bodyScrollLocked = true;
      return;
    }

    this.unlockBodyScroll();
  }

  private unlockBodyScroll(): void {
    if (typeof document === 'undefined' || !this.bodyScrollLocked) return;

    const body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    window.scrollTo(0, this.savedScrollY);
    this.bodyScrollLocked = false;
  }
}
