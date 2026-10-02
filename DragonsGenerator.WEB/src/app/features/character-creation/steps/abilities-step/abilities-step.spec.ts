import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { DataService } from '@core/services/data.service';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import { AbilitiesStep } from './abilities-step';

describe('AbilitiesStep', () => {
  let component: AbilitiesStep;
  let fixture: ComponentFixture<AbilitiesStep>;

  beforeEach(async () => {
    const builderStub: Record<string, unknown> = {
      creation: signal({
        ...structuredClone(INITIAL_CREATION_STATE),
        classId: 'cls-guerrier',
        className: 'Guerrier',
        targetLevel: 1,
        pointsRemaining: 27,
      }),
      finalAbilities: signal({
        force: 10,
        dexterite: 10,
        constitution: 10,
        intelligence: 10,
        sagesse: 10,
        charisme: 10,
      }),
      abilityModifiers: signal({
        force: 0,
        dexterite: 0,
        constitution: 0,
        intelligence: 0,
        sagesse: 0,
        charisme: 0,
      }),
      targetLevel: signal(1),
      secondaryClasses: signal([]),
      hitPointsMax: signal(10),
      proficiencyBonus: signal(2),
      woundThreshold: signal(5),
      baseArmorClass: signal(10),
      initiative: signal(0),
      passivePerception: signal(10),
      setAbilities: jasmine.createSpy('setAbilities'),
      setAbilityScore: jasmine.createSpy('setAbilityScore'),
      nextStep: jasmine.createSpy('nextStep'),
      previousStep: jasmine.createSpy('previousStep'),
      getModifier: (s: number) => Math.floor((s - 10) / 2),
      formatMod: (s: number) => {
        const m = Math.floor((s - 10) / 2);
        return m >= 0 ? `+${m}` : `${m}`;
      },
    };

    await TestBed.configureTestingModule({
      imports: [AbilitiesStep],
      providers: [
        ...zonelessTestProviders,
        { provide: CharacterBuilderService, useValue: builderStub },
        {
          provide: DataService,
          useValue: {
            getFeats: () => of([]),
            getSpells: () => of([]),
            getClasses: () => of([]),
            getClassById: () => of(null),
            getSkills: () => of([]),
            getEquipments: () => of([]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AbilitiesStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and lists the six abilities', () => {
    expect(component.abilities.length).toBe(6);
  });

  it('blocks confirm while points remain', () => {
    expect(component.canConfirm()).toBeFalse();
  });
});
