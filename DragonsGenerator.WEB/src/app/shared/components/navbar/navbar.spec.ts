import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AuthService } from '@core/services/auth.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import { NotificationPreferencesService } from '@core/services/notification-preferences.service';
import { NotificationService } from '@core/services/notification.service';
import { SiteAnnouncementService } from '@core/services/site-announcement.service';
import type { NotificationItem } from '@core/models/notification.model';
import { of } from 'rxjs';
import { Navbar } from './navbar';
import { DataService } from '@core/services/data.service';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;
  const notifItems = signal<NotificationItem[]>([]);
  const bannerDismissed = new Set<string>();
  const isLoggedIn = signal(false);
  const user = signal<{ displayName: string; email: string; avatarEmoji?: string; accentColor?: string } | null>(
    null,
  );

  beforeEach(async () => {
    notifItems.set([]);
    bannerDismissed.clear();
    isLoggedIn.set(false);
    user.set(null);
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn,
            isAdmin: () => false,
            user,
            logout: jasmine.createSpy('logout'),
          },
        },
        {
          provide: NotificationService,
          useValue: { items: notifItems, supportInboxCount: signal(0) },
        },
        {
          provide: SiteAnnouncementService,
          useValue: { isDismissed: (id: string) => bannerDismissed.has(id) },
        },
        {
          provide: NotificationPreferencesService,
          useValue: {
            isKindEnabled: () => true,
            isDismissed: () => false,
          },
        },
        {
          provide: GuidePreferencesService,
          useValue: { unreadNewsCount: signal(0) },
        },
        {
          provide: DataService,
          useValue: {
            getSpeciesSummary: () => of([]),
            getClassesSummary: () => of([]),
            getCivilisationsSummary: () => of([]),
            getEquipmentsSummary: () => of([]),
            getSpellsSummary: () => of([]),
            getCreaturesSummary: () => of([]),
            getSkillsSummary: () => of([]),
            getFeatsSummary: () => of([]),
            getBackgroundsSummary: () => of([]),
            getCombatActionsSummary: () => of([]),
            getDeitiesSummary: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('links to patch notes from the account menu', () => {
    component.accountOpen.set(true);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('[data-testid="account-patch-notes"]') as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/patch-notes');
  });

  it('does not list Accueil Codex in the dropdown', () => {
    expect(component.codexLinks.some((l) => l.path === '/codex')).toBeFalse();
    expect(component.codexLinks.some((l) => /accueil/i.test(l.label))).toBeFalse();
  });

  it('lists Héros and Donjons without a Création dropdown or wizard shortcuts', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="nav-creation"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="nav-characters"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="nav-dungeons"]')).toBeTruthy();
    expect(component.workshopLinks.map((l) => l.path)).toEqual(['/characters', '/dungeons']);
    expect(component.workshopLinks.some((l) => l.path === '/create' || l.path === '/story/create')).toBeFalse();
  });

  it('treats story and character wizards as the parent list in the nav', () => {
    const router = TestBed.inject(Router);
    expect(component.isNavPathActive('/dungeons')).toBeFalse();

    spyOnProperty(router, 'url', 'get').and.returnValue('/story/create?x=1');
    expect(component.isNavPathActive('/campaigns')).toBeTrue();
    expect(component.isNavPathActive('/characters')).toBeFalse();
  });

  it('highlights Héros while forging a character', () => {
    const router = TestBed.inject(Router);
    spyOnProperty(router, 'url', 'get').and.returnValue('/create/review#top');
    expect(component.isNavPathActive('/characters')).toBeTrue();
    expect(component.isNavPathActive('/campaigns')).toBeFalse();
    expect(component.isNavPathActive('/dungeons')).toBeFalse();
  });

  it('matches campaign, character, and dungeon list URLs', () => {
    const router = TestBed.inject(Router);
    const url = spyOnProperty(router, 'url', 'get');
    url.and.returnValue('/campaigns');
    expect(component.isNavPathActive('/campaigns')).toBeTrue();
    url.and.returnValue('/campaigns/abc');
    expect(component.isNavPathActive('/campaigns')).toBeTrue();
    url.and.returnValue('/scenario/create');
    expect(component.isNavPathActive('/campaigns')).toBeTrue();
    url.and.returnValue('/characters');
    expect(component.isNavPathActive('/characters')).toBeTrue();
    url.and.returnValue('/characters/char-1');
    expect(component.isNavPathActive('/characters')).toBeTrue();
    url.and.returnValue('/dungeons');
    expect(component.isNavPathActive('/dungeons')).toBeTrue();
    url.and.returnValue('/dungeons/map-1');
    expect(component.isNavPathActive('/dungeons')).toBeTrue();
    url.and.returnValue('/guide');
    expect(component.isNavPathActive('/dungeons')).toBeFalse();
  });

  it('keeps the mobile menu mounted after first open so icons are not recreated', () => {
    expect(component.mobileMenuMounted()).toBeFalse();
    expect(component.mobileOpen()).toBeFalse();

    component.toggleMobile();
    expect(component.mobileOpen()).toBeTrue();
    expect(component.mobileMenuMounted()).toBeTrue();

    component.closeMenus();
    expect(component.mobileOpen()).toBeFalse();
    expect(component.mobileMenuMounted()).toBeTrue();

    component.toggleMobile();
    expect(component.mobileOpen()).toBeTrue();
    expect(component.mobileMenuMounted()).toBeTrue();
  });

  it('opens the Plus sheet from the bottom rail and has no header burger', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="nav-hamburger"]')).toBeNull();
    const more = fixture.nativeElement.querySelector('[data-testid="bottom-nav-more"]') as HTMLButtonElement | null;
    expect(more).toBeTruthy();
    more?.click();
    fixture.detectChanges();
    expect(component.mobileOpen()).toBeTrue();
    const sheet = fixture.nativeElement.querySelector('[data-testid="mobile-more-sheet"]') as HTMLElement | null;
    expect(sheet).toBeTruthy();
    expect(sheet?.className).toContain('right-0');
    expect(sheet?.className).not.toContain('inset-x-0');
    expect(sheet?.className).not.toContain('top-0');
    const hrefs = [...(sheet?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.startsWith('/campaigns'))).toBeFalse();
    expect(hrefs.some((h) => h === '/create' || h.startsWith('/create/'))).toBeFalse();
    expect(hrefs.some((h) => h === '/codex' || h.startsWith('/species'))).toBeFalse();
    expect(hrefs.some((h) => h === '/characters')).toBeFalse();
    expect(hrefs.some((h) => h === '/dungeons')).toBeTrue();
    expect(hrefs.some((h) => h === '/guide')).toBeFalse();
    expect(hrefs.some((h) => h === '/settings')).toBeTrue();
    expect(hrefs.some((h) => h === '/patch-notes')).toBeTrue();
    expect(hrefs.some((h) => h === '/login')).toBeTrue();
  });

  it('keeps home, table, heroes, codex and guide on the rail', () => {
    const home = fixture.nativeElement.querySelector(
      '[data-testid="bottom-nav-home"]',
    ) as HTMLAnchorElement | null;
    const heroes = fixture.nativeElement.querySelector(
      '[data-testid="bottom-nav-heroes"]',
    ) as HTMLAnchorElement | null;
    const guide = fixture.nativeElement.querySelector(
      '[data-testid="bottom-nav-guide"]',
    ) as HTMLAnchorElement | null;
    expect(home?.getAttribute('href')).toBe('/');
    expect(heroes?.getAttribute('href')).toBe('/characters');
    expect(guide?.getAttribute('href')).toBe('/guide');
    expect(fixture.nativeElement.querySelector('[data-testid="bottom-nav-notifications"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="bottom-nav-account"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="bottom-nav-forge"]')).toBeNull();
    expect(component.plusSheetLinks.map((l) => l.path)).toEqual(['/dungeons']);
  });

  it('highlights Accueil only on the home URL', () => {
    const router = TestBed.inject(Router);
    const url = spyOnProperty(router, 'url', 'get');
    url.and.returnValue('/');
    expect(component.isNavPathActive('/')).toBeTrue();
    url.and.returnValue('/campaigns');
    expect(component.isNavPathActive('/')).toBeFalse();
  });

  it('puts notifications with profile, support and logout in Plus when signed in', () => {
    isLoggedIn.set(true);
    user.set({ displayName: 'Test', email: 'test@dragons.local' });
    fixture.detectChanges();
    component.toggleMobile();
    fixture.detectChanges();
    const sheet = fixture.nativeElement.querySelector('[data-testid="mobile-more-sheet"]') as HTMLElement;
    const hrefs = [...sheet.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs).toContain('/notifications');
    expect(hrefs).toContain('/profile');
    expect(hrefs).toContain('/support');
    expect(hrefs).toContain('/friends');
    expect(hrefs.some((h) => h === '/guide')).toBeFalse();
    expect(sheet.querySelector('[data-testid="mobile-account-logout"]')).toBeTruthy();
  });

  it('keeps the bottom rail on the forge without a header burger', () => {
    component.forgeRoute.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="mobile-bottom-nav"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="nav-hamburger"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="bottom-nav-more"]')).toBeTruthy();
  });

  it('formats badge counts and highlights Codex routes', () => {
    expect(component.formatBadgeCount(3)).toBe('3');
    expect(component.formatBadgeCount(10)).toBe('9+');
    const router = TestBed.inject(Router);
    const url = spyOnProperty(router, 'url', 'get');
    url.and.returnValue('/spells/spl-arme-psychique');
    expect(component.isCodexActive()).toBeTrue();
    url.and.returnValue('/campaigns');
    expect(component.isCodexActive()).toBeFalse();
    url.and.returnValue('/codex');
    expect(component.isCodexActive()).toBeTrue();
  });

  it('closes menus on Escape', () => {
    component.toggleMobile();
    expect(component.mobileOpen()).toBeTrue();
    component.onEscape();
    expect(component.mobileOpen()).toBeFalse();
  });

  it('badges unseen announcements until the banner is dismissed', () => {
    const announcement = (id: string): NotificationItem => ({
      key: `announcement-${id}`,
      kind: 'announcement',
      title: 'Incident en cours',
      message: 'Maintenance',
      actionPath: `/notifications?announcement=${id}`,
      createdAt: new Date().toISOString(),
    });
    bannerDismissed.add('seen');
    notifItems.set([announcement('new'), announcement('seen')]);
    expect(component.announcementCount()).toBe(1);
    expect(component.notificationCount()).toBe(1);
  });
});
