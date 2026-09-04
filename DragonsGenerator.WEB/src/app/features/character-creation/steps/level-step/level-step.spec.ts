import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { LevelStep } from './level-step';

describe('LevelStep', () => {
  let component: LevelStep;
  let fixture: ComponentFixture<LevelStep>;
  let setTargetLevelSpy: jasmine.Spy;
  let nextStepSpy: jasmine.Spy;
  let targetLevelSignal: ReturnType<typeof signal<number>>;

  beforeEach(async () => {
    targetLevelSignal = signal(1);
    setTargetLevelSpy = jasmine.createSpy('setTargetLevel').and.callFake((lvl: number) => {
      targetLevelSignal.set(lvl);
    });
    nextStepSpy = jasmine.createSpy('nextStep');

    await TestBed.configureTestingModule({
      imports: [LevelStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: CharacterBuilderService,
          useValue: {
            targetLevel: targetLevelSignal,
            setTargetLevel: setTargetLevelSpy,
            nextStep: nextStepSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LevelStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('exposes levels 1 to 20', () => {
    expect(component.levels.length).toBe(20);
    expect(component.levels[0]).toBe(1);
    expect(component.levels[19]).toBe(20);
  });

  it('delegates level selection to the builder', () => {
    component.selectLevel(7);
    expect(setTargetLevelSpy).toHaveBeenCalledWith(7);
  });

  it('advances to the next step on continue', () => {
    component.continueToNextStep();
    expect(nextStepSpy).toHaveBeenCalled();
  });
});
