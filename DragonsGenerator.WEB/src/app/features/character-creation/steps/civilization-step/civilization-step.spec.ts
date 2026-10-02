import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { DataService } from '@core/services/data.service';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import type { Civilisation } from '@core/models/Civilisations/civilisations';
import { CivilizationStep } from './civilization-step';

const MOCK_CIV: Civilisation = {
  id: 'civ-ajagar',
  name: 'Ajagar',
  randomization: { diceMin: 1, diceMax: 2 },
  demographics: {
    primarySpecies: [],
    secondarySpecies: [],
    isCosmopolitan: false,
    cosmopolitanZones: [],
    socialRoles: [],
  },
  linguistics: {
    officialLanguages: [{ id: 'lg-commun', label: 'Commun' }],
    additionalLanguagesSpoken: false,
    writingSystems: [],
  },
  lore: { fullDescription: 'Empire du sud.', threatIds: [], geographyTags: [] },
};

describe('CivilizationStep', () => {
  let component: CivilizationStep;
  let fixture: ComponentFixture<CivilizationStep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CivilizationStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal(structuredClone(INITIAL_CREATION_STATE)),
            setCivilization: jasmine.createSpy('setCivilization'),
            clearCivilization: jasmine.createSpy('clearCivilization'),
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
        {
          provide: DataService,
          useValue: { getCivilisations: () => of([MOCK_CIV]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CivilizationStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads civilisations for the map step', () => {
    expect(component.allCivilizations().length).toBe(1);
    expect(component.allCivilizations()[0]?.id).toBe('civ-ajagar');
  });

  it('selectCiv sets local selection', () => {
    component.selectCiv('civ-ajagar');
    expect(component.selectedCivId()).toBe('civ-ajagar');
  });
});
