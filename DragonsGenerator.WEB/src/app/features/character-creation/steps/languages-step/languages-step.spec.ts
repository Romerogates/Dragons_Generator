import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import type { Language } from '@core/models/Languages/language';
import { LanguagesStep } from './languages-step';

function lang(id: string, name: string, category: string): Language {
  return {
    id,
    name,
    category,
    linguistics: { writingSystems: [], isOralOnly: false },
    speakers: { primary: [], regions: [], isExtinct: false },
    lore: { fullDescription: '' },
  };
}

const MOCK_LANGUAGES: Language[] = [
  lang('lg-commun', 'Commun', 'base'),
  lang('lg-elfique', 'Elfique', 'base'),
  lang('lg-draconique', 'Draconique', 'exotique'),
  lang('lg-infernal', 'Infernal', 'exotique'),
];

function languagesCreation(overrides: Record<string, unknown> = {}) {
  return {
    classId: null,
    subclassId: null,
    speciesLanguages: [] as string[],
    civilizationLanguages: [] as string[],
    backgroundLanguages: [] as string[],
    languages: [] as string[],
    bonusLanguageCount: 2,
    requiredExoticLanguageCount: 0,
    requiredBaseLanguageCount: 0,
    ...overrides,
  };
}

describe('LanguagesStep', () => {
  let component: LanguagesStep;
  let fixture: ComponentFixture<LanguagesStep>;
  let creationSignal: ReturnType<typeof signal<ReturnType<typeof languagesCreation>>>;
  let addLanguageSpy: jasmine.Spy;
  let removeLanguageSpy: jasmine.Spy;
  let nextStepSpy: jasmine.Spy;

  beforeEach(async () => {
    creationSignal = signal(languagesCreation());
    addLanguageSpy = jasmine.createSpy('addLanguage').and.callFake((name: string) => {
      creationSignal.update((c) => ({ ...c, languages: [...c.languages, name] }));
    });
    removeLanguageSpy = jasmine.createSpy('removeLanguage');
    nextStepSpy = jasmine.createSpy('nextStep');

    await TestBed.configureTestingModule({
      imports: [LanguagesStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getLanguages: () => of(MOCK_LANGUAGES),
            getClassById: () => of({ id: 'cls-test', name: 'Test', data: {} }),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            addLanguage: addLanguageSpy,
            removeLanguage: removeLanguageSpy,
            nextStep: nextStepSpy,
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguagesStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('requires the exact number of base languages when the class root pool is common-only (ex. Barde)', () => {
    creationSignal.set(languagesCreation({ bonusLanguageCount: 2, requiredBaseLanguageCount: 2 }));
    fixture.detectChanges();

    expect(component.baseRemaining()).toBe(2);
    component.confirm();
    expect(nextStepSpy).not.toHaveBeenCalled();

    component.addLanguage('Elfique');
    component.addLanguage('Draconique');
    fixture.detectChanges();

    // Une seule des deux langues piochées est courante : l'exigence n'est pas remplie.
    expect(component.chosenBaseCount()).toBe(1);
    expect(component.baseRemaining()).toBe(1);
    component.confirm();
    expect(nextStepSpy).not.toHaveBeenCalled();
  });

  it('advances once the required base language count is met', () => {
    creationSignal.set(languagesCreation({ bonusLanguageCount: 2, requiredBaseLanguageCount: 2 }));
    fixture.detectChanges();

    component.addLanguage('Elfique');
    component.addLanguage('Commun');
    fixture.detectChanges();

    expect(component.baseRemaining()).toBe(0);
    component.confirm();
    expect(nextStepSpy).toHaveBeenCalled();
  });

  it('hides common languages when remaining picks must be exotic', () => {
    creationSignal.set(
      languagesCreation({ bonusLanguageCount: 1, requiredExoticLanguageCount: 1 }),
    );
    fixture.detectChanges();

    expect(component.mustReserveExoticSlots()).toBeTrue();
    expect(component.availableBaseLanguages().length).toBe(0);
    expect(component.availableExoticLanguages().length).toBe(2);

    component.addLanguage('Commun');
    expect(addLanguageSpy).not.toHaveBeenCalled();

    component.addLanguage('Draconique');
    expect(addLanguageSpy).toHaveBeenCalledWith('Draconique');
  });

  it('does not gate on base languages when no class requirement is set', () => {
    expect(component.requiredBaseCount()).toBe(0);
    expect(component.baseRemaining()).toBe(0);
  });
});
