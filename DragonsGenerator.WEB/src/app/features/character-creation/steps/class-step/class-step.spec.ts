import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { createLettreClass } from '@testing/lettre-fixtures';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService, type ClassSelection } from '@core/services/character-builder.service';
import { ClassStep } from './class-step';

describe('ClassStep (Lettré)', () => {
  let component: ClassStep;
  let fixture: ComponentFixture<ClassStep>;
  let setClassSpy: jasmine.Spy;
  let setProgSpy: jasmine.Spy;
  let creationSignal: ReturnType<typeof signal<any>>;

  const lettreClass = createLettreClass();

  beforeEach(async () => {
    creationSignal = signal({ classId: null, targetLevel: 1, classChoiceAnswers: {} });
    setClassSpy = jasmine.createSpy('setClass');
    setProgSpy = jasmine.createSpy('setClassProgressionChoices');

    await TestBed.configureTestingModule({
      imports: [ClassStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: { getClasses: () => of([lettreClass]) },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            targetLevel: () => 1,
            proficiencyBonus: () => 2,
            clearClass: jasmine.createSpy('clearClass'),
            setClass: setClassSpy,
            setClassProgressionChoices: setProgSpy,
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads classes and exposes Lettré starting equipment slots', () => {
    expect(component.loading()).toBeFalse();
    expect(component.allClasses().length).toBe(1);
    component.selectedClassId.set('cls-lettre');
    fixture.detectChanges();

    const slots = lettreClass.data.starting_equipment;
    expect(slots.length).toBeGreaterThan(1);
    const slot2 = slots.find((s) =>
      s.alternatives?.some((alt) => alt.some((i) => i.id === 'wp-mastered-choice')),
    );
    expect(slot2).toBeTruthy();
  });

  it('requires astuce picks before selection is complete', () => {
    component.selectedClassId.set('cls-lettre');
    fixture.detectChanges();

    expect(component.currentPhase()).toBe('prog_choice');
    expect(component.selectionComplete()).toBeFalse();

    const astuceChoice = component.activeProgChoices().find(
      (c) => c.id === 'choice-astuces-initial-cls-lettre',
    );
    expect(astuceChoice?.count).toBe(2);

    component.progChoiceAnswers.update((m) =>
      new Map(m).set('choice-astuces-initial-cls-lettre', [
        'feat-astuce-audace',
        'feat-astuce-brio',
      ]),
    );
    fixture.detectChanges();
    expect(component.selectionComplete()).toBeTrue();
  });

  it('applySelectionToBuilder pushes Lettré class with mastered-choice equipment slots', () => {
    component.selectedClassId.set('cls-lettre');
    component.progChoiceAnswers.update((m) =>
      new Map(m).set('choice-astuces-initial-cls-lettre', [
        'feat-astuce-audace',
        'feat-astuce-brio',
      ]),
    );
    fixture.detectChanges();

    const ok = (component as unknown as { applySelectionToBuilder: () => boolean }).applySelectionToBuilder();
    expect(ok).toBeTrue();
    expect(setClassSpy).toHaveBeenCalledTimes(1);

    const selection = setClassSpy.calls.mostRecent().args[0] as ClassSelection;
    expect(selection.classId).toBe('cls-lettre');
    expect(selection.weaponProficiencies).toContain('wp-dague');
    expect(selection.startingEquipmentSlots.length).toBeGreaterThan(1);

    const masteredSlot = selection.startingEquipmentSlots.find((s) =>
      s.alternatives?.some((alt) => alt.some((i) => i.id === 'wp-mastered-choice')),
    );
    expect(masteredSlot).toBeTruthy();

    expect(setProgSpy).toHaveBeenCalled();
    const progPayload = setProgSpy.calls.mostRecent().args[0];
    expect(progPayload.classChoiceAnswers['choice-astuces-initial-cls-lettre']).toEqual([
      'feat-astuce-audace',
      'feat-astuce-brio',
    ]);
  });

  it('shows load error when classes fail', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ClassStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: { getClasses: () => throwError(() => new Error('network')) },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal({ targetLevel: 1 }),
            targetLevel: () => 1,
            proficiencyBonus: () => 2,
            clearClass: jasmine.createSpy(),
            setClass: jasmine.createSpy(),
            setClassProgressionChoices: jasmine.createSpy(),
            nextStep: jasmine.createSpy(),
            previousStep: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();

    const errFixture = TestBed.createComponent(ClassStep);
    errFixture.detectChanges();
    expect(errFixture.componentInstance.error()).toBe('Impossible de charger les classes.');
  });
});
