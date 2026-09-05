import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { DataService } from '@core/services/data.service';
import { AiRateLimitDialogService } from '@core/services/ai-rate-limit-dialog.service';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import { IdentityStep } from './identity-step';

describe('IdentityStep', () => {
  let component: IdentityStep;
  let fixture: ComponentFixture<IdentityStep>;
  let creationSignal: ReturnType<typeof signal<typeof INITIAL_CREATION_STATE>>;
  let setIdentitySpy: jasmine.Spy;
  let nextStepSpy: jasmine.Spy;
  let previousStepSpy: jasmine.Spy;
  let generateBackstorySpy: jasmine.Spy;
  let showIfBlockedSpy: jasmine.Spy;
  let aiRunSpy: jasmine.Spy;

  function patchCreation(overrides: Partial<typeof INITIAL_CREATION_STATE>): void {
    creationSignal.update((c) => ({ ...c, ...overrides }));
  }

  beforeEach(async () => {
    creationSignal = signal(structuredClone(INITIAL_CREATION_STATE));
    setIdentitySpy = jasmine.createSpy('setIdentity').and.callFake((partial: object) => {
      creationSignal.update((c) => ({ ...c, ...partial }));
    });
    nextStepSpy = jasmine.createSpy('nextStep');
    previousStepSpy = jasmine.createSpy('previousStep');
    generateBackstorySpy = jasmine.createSpy('generateBackstory').and.returnValue(
      of({ story: 'Une épopée forgée par les astres.' }),
    );
    showIfBlockedSpy = jasmine.createSpy('showIfBlocked').and.returnValue(false);
    aiRunSpy = jasmine
      .createSpy('run')
      .and.callFake((_kind: string, work: () => ReturnType<typeof of>) => work());

    spyOn(window, 'scrollTo');

    await TestBed.configureTestingModule({
      imports: [IdentityStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            setIdentity: setIdentitySpy,
            nextStep: nextStepSpy,
            previousStep: previousStepSpy,
          },
        },
        {
          provide: DataService,
          useValue: { generateBackstory: generateBackstorySpy },
        },
        {
          provide: AiRateLimitDialogService,
          useValue: { showIfBlocked: showIfBlockedSpy },
        },
        {
          provide: AiGenerationProgressService,
          useValue: {
            run: aiRunSpy,
            active: signal(false),
            progress: signal(0),
            stageLabel: signal(''),
            providerLabel: signal(''),
            detail: signal<string | null>(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IdentityStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('scrolls to top on init and exposes alignments', () => {
    expect(window.scrollTo).toHaveBeenCalled();
    expect(component.alignments.length).toBeGreaterThan(0);
  });

  describe('charSummary', () => {
    it('falls back to Aventurier when empty', () => {
      expect(component.charSummary()).toBe('Aventurier');
    });

    it('joins species, class with subclass, and background', () => {
      patchCreation({
        speciesName: 'Elfe',
        className: 'Magicien',
        subclassName: 'Évocation',
        backgroundName: 'Érudit',
      });
      expect(component.charSummary()).toBe('Elfe · Magicien (Évocation) · Érudit');
    });

    it('omits subclass parentheses when absent', () => {
      patchCreation({
        speciesName: 'Nain',
        className: 'Guerrier',
        subclassName: null,
      });
      expect(component.charSummary()).toBe('Nain · Guerrier');
    });
  });

  describe('identity updates', () => {
    it('delegates field updates to the builder', () => {
      component.updateIdentity('name', 'Aria');
      expect(setIdentitySpy).toHaveBeenCalledWith({ name: 'Aria' });
    });

    it('normalizes sex to M/F/X', () => {
      component.updateSex('F');
      expect(setIdentitySpy).toHaveBeenCalledWith({ sex: 'F' });

      component.updateSex('M');
      expect(setIdentitySpy).toHaveBeenCalledWith({ sex: 'M' });

      component.updateSex('maybe');
      expect(setIdentitySpy).toHaveBeenCalledWith({ sex: 'X' });
    });
  });

  describe('navigation', () => {
    it('blocks confirm without a name', () => {
      patchCreation({ name: '   ' });
      component.confirm();
      expect(component.generationError()).toBe('Le nom est requis.');
      expect(nextStepSpy).not.toHaveBeenCalled();
    });

    it('advances when name is present', () => {
      patchCreation({ name: 'Aria' });
      component.confirm();
      expect(component.generationError()).toBeNull();
      expect(nextStepSpy).toHaveBeenCalled();
    });

    it('goes to previous step', () => {
      component.prevStep();
      expect(previousStepSpy).toHaveBeenCalled();
    });
  });

  describe('generateStory', () => {
    it('requires a name', () => {
      patchCreation({ name: '' });
      component.generateStory();
      expect(component.generationError()).toBe("Le nom est requis pour l'inspiration.");
      expect(generateBackstorySpy).not.toHaveBeenCalled();
    });

    it('requires species and class', () => {
      patchCreation({ name: 'Aria', speciesName: null, className: null });
      component.generateStory();
      expect(component.generationError()).toBe("L'espèce et la classe sont nécessaires.");
      expect(generateBackstorySpy).not.toHaveBeenCalled();
    });

    it('aborts when AI rate limit dialog is shown', () => {
      showIfBlockedSpy.and.returnValue(true);
      patchCreation({
        name: 'Aria',
        speciesName: 'Elfe',
        className: 'Magicien',
      });
      component.generateStory();
      expect(aiRunSpy).not.toHaveBeenCalled();
      expect(generateBackstorySpy).not.toHaveBeenCalled();
    });

    it('writes the generated story into identity', () => {
      patchCreation({
        name: 'Aria',
        sex: 'F',
        speciesName: 'Elfe',
        subspeciesName: 'Haut-elfe',
        civilizationName: 'Nordique',
        className: 'Magicien',
        alignment: 'NB',
        traits: 'Curieuse',
        bonds: 'Guilde',
        flaws: 'Orgueil',
        background: 'Études',
      });
      component.generateStory();

      expect(aiRunSpy).toHaveBeenCalled();
      expect(generateBackstorySpy).toHaveBeenCalledWith(
        jasmine.objectContaining({
          name: 'Aria',
          sex: 'F',
          speciesName: 'Elfe',
          subspeciesName: 'Haut-elfe',
          civilizationName: 'Nordique',
          className: 'Magicien',
        }),
      );
      expect(setIdentitySpy).toHaveBeenCalledWith({
        story: 'Une épopée forgée par les astres.',
      });
      expect(component.generationError()).toBeNull();
    });

    it('defaults civilization and sex when absent', () => {
      patchCreation({
        name: 'Borin',
        sex: 'X',
        speciesName: 'Nain',
        className: 'Guerrier',
        civilizationName: null,
      });
      component.generateStory();
      expect(generateBackstorySpy).toHaveBeenCalledWith(
        jasmine.objectContaining({
          sex: 'X',
          civilizationName: 'Inconnue',
        }),
      );
    });

    it('surfaces API generalErrors message', () => {
      generateBackstorySpy.and.returnValue(
        throwError(() => ({
          error: { errors: { generalErrors: ['Quota dépassé.'] } },
        })),
      );
      patchCreation({ name: 'Aria', speciesName: 'Elfe', className: 'Magicien' });
      component.generateStory();
      expect(component.generationError()).toBe('Quota dépassé.');
    });

    it('surfaces API reason then message fallbacks', () => {
      generateBackstorySpy.and.returnValue(
        throwError(() => ({
          error: { errors: [{ reason: 'Service saturé' }] },
        })),
      );
      patchCreation({ name: 'Aria', speciesName: 'Elfe', className: 'Magicien' });
      component.generateStory();
      expect(component.generationError()).toBe('Service saturé');

      generateBackstorySpy.and.returnValue(
        throwError(() => ({
          error: { message: 'Timeout upstream' },
        })),
      );
      component.generateStory();
      expect(component.generationError()).toBe('Timeout upstream');
    });

    it('uses Groq fallback for generic API noise', () => {
      generateBackstorySpy.and.returnValue(
        throwError(() => ({
          error: { message: 'One or more errors occurred!' },
        })),
      );
      patchCreation({ name: 'Aria', speciesName: 'Elfe', className: 'Magicien' });
      component.generateStory();
      expect(component.generationError()).toContain('inspiration cosmique');
    });

    it('ignores AI rate-limit HTTP errors without setting a message', () => {
      const err = new HttpErrorResponse({
        status: 429,
        url: 'https://api.example/api/generate-backstory',
        error: { code: 'ai_rate_limit', message: 'Limite atteinte' },
      });
      generateBackstorySpy.and.returnValue(throwError(() => err));
      patchCreation({ name: 'Aria', speciesName: 'Elfe', className: 'Magicien' });
      component.generationError.set(null);
      component.generateStory();
      expect(component.generationError()).toBeNull();
    });
  });
});
