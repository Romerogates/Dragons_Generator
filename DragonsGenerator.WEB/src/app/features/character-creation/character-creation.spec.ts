import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { AuthService } from '@core/services/auth.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { DataService } from '@core/services/data.service';
import { CharacterAutoGeneratorService } from '@core/services/character-auto-generator.service';
import { ForgePreferencesService } from '@core/services/forge-preferences.service';
import { UiBannerPreferencesService } from '@core/services/ui-banner-preferences.service';
import { CharacterCreation } from './character-creation';

describe('CharacterCreation host', () => {
  let component: CharacterCreation;
  let fixture: ComponentFixture<CharacterCreation>;
  let hasPendingDraft: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    hasPendingDraft = signal(false);
    await TestBed.configureTestingModule({
      imports: [CharacterCreation],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        {
          provide: CharacterBuilderService,
          useValue: {
            hasPendingDraft,
            isEditMode: false,
            checkForEditMode: jasmine.createSpy('checkForEditMode'),
            currentStep: signal(1),
            totalSteps: signal(11),
            draftSummary: signal('Brouillon'),
            steps: signal([{ number: 1, title: 'Niveau', icon: '🔢' }]),
            creation: signal({}),
            reset: jasmine.createSpy('reset'),
            goToStep: jasmine.createSpy('goToStep'),
            goToSummary: jasmine.createSpy('goToSummary'),
            jumpToSummaryForced: jasmine.createSpy('jumpToSummaryForced'),
            summaryStep: signal(11),
            returnToSummary: signal(false),
            stepJumpBlocked: signal(null),
            clearStepJumpBlocked: jasmine.createSpy('clearStepJumpBlocked'),
            needsMagicStep: signal(false),
            isLevelLocked: signal(false),
            levelAcknowledged: signal(false),
            acknowledgeLevel: jasmine.createSpy('acknowledgeLevel'),
            replaceCreation: jasmine.createSpy('replaceCreation'),
            abilityModifiers: signal({}),
            build: jasmine.createSpy('build'),
            targetLevel: signal(1),
            setTargetLevel: jasmine.createSpy('setTargetLevel'),
          },
        },
        {
          provide: AuthService,
          useValue: { isLoggedIn: signal(false) },
        },
        {
          provide: ConnectivityService,
          useValue: { isOnline: signal(true) },
        },
        {
          provide: OfflineCodexService,
          useValue: {
            isDownloaded: () => true,
            downloading: signal(false),
            downloadError: signal(null),
            downloadCodex: () => of(true),
          },
        },
        {
          provide: CharacterHandoffService,
          useValue: {
            hasEditPending: () => false,
            setCurrent: jasmine.createSpy('setCurrent'),
          },
        },
        {
          provide: DataService,
          useValue: {
            getLanguages: () => of([]),
            getSpells: () => of([]),
            getClasses: () => of([]),
          },
        },
        {
          provide: CharacterAutoGeneratorService,
          useValue: {
            populateWizardWithRandomHero: jasmine
              .createSpy('populateWizardWithRandomHero')
              .and.resolveTo({}),
            populateWizardWithRandomLevel1: jasmine
              .createSpy('populateWizardWithRandomLevel1')
              .and.resolveTo({}),
          },
        },
        {
          provide: ForgePreferencesService,
          useValue: {
            skipModePrompt: signal(true),
            setSkipModePrompt: jasmine.createSpy('setSkipModePrompt'),
          },
        },
        {
          provide: UiBannerPreferencesService,
          useValue: {
            hideAllBanners: signal(false),
            isVisible: () => true,
            hydrated: signal(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterCreation);
    component = fixture.componentInstance;
  });

  it('does not show draft prompt when no pending draft', () => {
    fixture.detectChanges();
    expect(component.showDraftPrompt()).toBeFalse();
  });

  it('shows draft prompt when hasPendingDraft is true', () => {
    hasPendingDraft.set(true);
    fixture.detectChanges();
    component.ngOnInit();
    expect(component.showDraftPrompt()).toBeTrue();
  });

  it('resumeDraft hides the prompt', () => {
    component.showDraftPrompt.set(true);
    component.resumeDraft();
    expect(component.showDraftPrompt()).toBeFalse();
  });

  it('shows level required prompt when generating without acknowledged level', async () => {
    fixture.detectChanges();
    component.ngOnInit();
    await component.generateQuickHero();
    expect(component.showLevelRequiredPrompt()).toBeTrue();
  });

  it('shows forge mode prompt when skipModePrompt is false and no draft', () => {
    const forge = TestBed.inject(ForgePreferencesService) as {
      skipModePrompt: ReturnType<typeof signal<boolean>>;
    };
    forge.skipModePrompt.set(false);
    hasPendingDraft.set(false);
    component.ngOnInit();
    expect(component.showForgeModePrompt()).toBeTrue();
  });
});
