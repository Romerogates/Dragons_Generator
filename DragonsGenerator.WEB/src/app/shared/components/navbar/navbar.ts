import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  HostListener,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';

export interface NavLink {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Navbar implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly savedCountSignal = signal(0);
  private readonly campaignCountSignal = signal(0);
  private routerSub?: Subscription;

  readonly mobileOpen = signal(false);
  readonly codexOpen = signal(false);
  readonly accountOpen = signal(false);

  readonly savedCount = this.savedCountSignal.asReadonly();
  readonly campaignCount = this.campaignCountSignal.asReadonly();

  readonly codexLinks: NavLink[] = [
    { label: 'Espèces', path: '/species', icon: 'fluent-emoji:dna' },
    { label: 'Classes', path: '/classes', icon: 'fluent-emoji:crossed-swords' },
    { label: 'Civilisations', path: '/civilisations', icon: 'fluent-emoji:classical-building' },
    { label: 'Équipements', path: '/equipments', icon: 'fluent-emoji:shield' },
    { label: 'Sortilèges', path: '/spells', icon: 'fluent-emoji:sparkles' },
    { label: 'Bestiaire', path: '/creatures', icon: 'fluent-emoji:dragon' },
    { label: 'Compétences', path: '/skills', icon: 'fluent-emoji:bookmark-tabs' },
    { label: 'Dons', path: '/feats', icon: 'fluent-emoji:trophy' },
    { label: 'Actions de combat', path: '/combat-actions', icon: 'fluent-emoji:collision' },
    { label: 'Divinités', path: '/deities', icon: 'fluent-emoji:glowing-star' },
  ];

  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.preloadNavbarIcons();
    this.refreshCharacterCount();
    this.refreshCampaignCount();
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('focus', this.onFocus);

    this.routerSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.mobileOpen.set(false);
        this.codexOpen.set(false);
        this.accountOpen.set(false);
        this.refreshCharacterCount();
        this.refreshCampaignCount();
      });
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('focus', this.onFocus);
    this.routerSub?.unsubscribe();
  }

  private readonly onStorage = (): void => {
    this.refreshCharacterCount();
    this.refreshCampaignCount();
  };
  private readonly onFocus = (): void => {
    this.refreshCharacterCount();
    this.refreshCampaignCount();
  };

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('[data-codex-menu]')) this.codexOpen.set(false);
    if (!target?.closest('[data-account-menu]')) this.accountOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.codexOpen.set(false);
    this.accountOpen.set(false);
    this.mobileOpen.set(false);
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
    if (!this.mobileOpen()) {
      this.codexOpen.set(false);
      this.accountOpen.set(false);
    }
  }

  closeMenus(): void {
    this.mobileOpen.set(false);
    this.codexOpen.set(false);
    this.accountOpen.set(false);
  }

  logout(): void {
    this.closeMenus();
    this.auth.logout();
  }

  isCodexActive(): boolean {
    return this.codexLinks.some((l) => this.router.url.startsWith(l.path));
  }

  refreshCharacterCount(): void {
    const raw = localStorage.getItem('dragons-characters');
    if (!raw) {
      this.savedCountSignal.set(0);
      return;
    }
    try {
      const chars = JSON.parse(raw);
      this.savedCountSignal.set(Array.isArray(chars) ? chars.length : 0);
    } catch {
      this.savedCountSignal.set(0);
    }
  }

  refreshCampaignCount(): void {
    if (!this.auth.isLoggedIn()) {
      this.campaignCountSignal.set(0);
      return;
    }
    this.campaigns.list().subscribe({
      next: (list) => this.campaignCountSignal.set(list.length),
      error: () => this.campaignCountSignal.set(0),
    });
  }

  /** Preload menu icons so the mobile drawer does not pop them in while scrolling. */
  private preloadNavbarIcons(): void {
    if (typeof customElements === 'undefined') return;

    const icons = [
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
}
