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

export interface NavLink {
  label: string;
  path: string;
  icon: string;
}

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
  readonly codexOpen = signal(false);
  readonly accountOpen = signal(false);

  readonly friendsActionCount = this.notifications.friendsActionCount;
  readonly campaignsActionCount = this.notifications.campaignsActionCount;
  readonly notificationCount = computed(() =>
    this.notifications
      .items()
      .filter((item) => this.notifPrefs.isKindEnabled(item.kind) && !this.notifPrefs.isDismissed(item.key))
      .length,
  );
  readonly guideNewsCount = this.guidePrefs.unreadNewsCount;

  private savedScrollY = 0;
  private bodyScrollLocked = false;

  readonly codexLinks: NavLink[] = [
    { label: 'Espèces', path: '/species', icon: 'fluent-emoji:dna' },
    { label: 'Classes', path: '/classes', icon: 'fluent-emoji:crossed-swords' },
    { label: 'Civilisations', path: '/civilisations', icon: 'fluent-emoji:classical-building' },
    { label: 'Équipements', path: '/equipments', icon: 'fluent-emoji:shield' },
    { label: 'Sortilèges', path: '/spells', icon: 'fluent-emoji:sparkles' },
    { label: 'Bestiaire', path: '/creatures', icon: 'fluent-emoji:dragon' },
    { label: 'Compétences', path: '/skills', icon: 'fluent-emoji:bookmark-tabs' },
    { label: 'Dons', path: '/feats', icon: 'fluent-emoji:trophy' },
    { label: 'Historiques', path: '/backgrounds', icon: 'fluent-emoji:scroll' },
    { label: 'Actions de combat', path: '/combat-actions', icon: 'fluent-emoji:collision' },
    { label: 'Divinités', path: '/deities', icon: 'fluent-emoji:glowing-star' },
  ];

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.preloadNavbarIcons();
    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.closeMenus());
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
    if (!target?.closest('[data-codex-menu]')) this.codexOpen.set(false);
    if (!target?.closest('[data-account-menu]')) this.accountOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenus();
  }

  toggleCodex(event: Event): void {
    event.stopPropagation();
    this.codexOpen.update((v) => !v);
    this.accountOpen.set(false);
  }

  toggleAccount(event: Event): void {
    event.stopPropagation();
    this.accountOpen.update((v) => !v);
    this.codexOpen.set(false);
  }

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
    this.syncBodyScrollLock();
    if (!this.mobileOpen()) {
      this.codexOpen.set(false);
      this.accountOpen.set(false);
    }
  }

  closeMenus(): void {
    this.mobileOpen.set(false);
    this.codexOpen.set(false);
    this.accountOpen.set(false);
    this.syncBodyScrollLock();
  }

  logout(): void {
    this.closeMenus();
    this.auth.logout();
  }

  isCodexActive(): boolean {
    return this.codexLinks.some((l) => this.router.url.startsWith(l.path));
  }

  private preloadNavbarIcons(): void {
    if (typeof customElements === 'undefined') return;

    const icons = [
      'mdi:bell-outline',
      'mdi:cog-outline',
      'fluent-emoji:hammer-and-pick',
      'fluent-emoji:busts-in-silhouette',
      'fluent-emoji:world-map',
      'fluent-emoji:scroll',
      'fluent-emoji:handshake',
      'fluent-emoji:envelope',
      'fluent-emoji:shield',
      ...this.codexLinks.map((l) => l.icon),
    ];

    customElements.whenDefined('iconify-icon').then(() => {
      const IconifyIcon = customElements.get('iconify-icon') as
        | { loadIcons?: (names: string[]) => void }
        | undefined;
      IconifyIcon?.loadIcons?.([...new Set(icons)]);
    });
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
