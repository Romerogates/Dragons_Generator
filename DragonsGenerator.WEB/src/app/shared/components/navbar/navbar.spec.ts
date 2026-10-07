import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AuthService } from '@core/services/auth.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import { NotificationPreferencesService } from '@core/services/notification-preferences.service';
import { NotificationService } from '@core/services/notification.service';
import { of } from 'rxjs';
import { Navbar } from './navbar';
import { DataService } from '@core/services/data.service';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: signal(false),
            isAdmin: () => false,
            user: signal(null),
            logout: jasmine.createSpy('logout'),
          },
        },
        {
          provide: NotificationService,
          useValue: { items: signal([]) },
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

  it('does not list Accueil Codex in the dropdown', () => {
    expect(component.codexLinks.some((l) => l.path === '/codex')).toBeFalse();
    expect(component.codexLinks.some((l) => /accueil/i.test(l.label))).toBeFalse();
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
});
