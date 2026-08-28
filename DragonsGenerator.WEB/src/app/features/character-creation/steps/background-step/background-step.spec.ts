import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { normalizeBackground } from '@core/utils/background-data.adapter';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { BackgroundStep } from './background-step';

const MOCK_ERUDIT = normalizeBackground({
  id: 'bg-erudit',
  name: 'Érudit',
  data: {
    preset: true,
    proficiencies: {
      skills: { fixed: ['skill-arcanes'], choose: { count: 0, options: [] } },
      tools: {
        fixed: [],
        choose: [
          {
            chooseCount: 1,
            options: [{ type: 'tool_category', category: 'instrument', name: 'Instrument' }],
          },
        ],
      },
      languages: { fixed: ['lang-commun'], choiceCount: 2 },
    },
    equipment: {
      fixed: [{ id: 'gr-sac-derudit', name: "Sac d'érudit", qty: 1 }],
      choose: [
        {
          name: 'Outil de calligraphie',
          pool: [{ id: 'tl-necessaire-de-calligraphe', qty: 1 }],
        },
      ],
      currency: { or: 10 },
    },
    privilege: { id: 'priv-erudit', name: 'Bibliothèque', desc: 'Accès privilégié aux archives.' },
    flavor: { summary: 'Une vie passée à étudier.' },
    personalityTables: {
      traits: { entries: [{ text: 'Je cite des textes anciens.' }] },
      ideals: { entries: [{ text: 'La connaissance doit être partagée.' }] },
      bonds: { entries: [{ text: 'Mon mentor compte plus que tout.' }] },
      flaws: { entries: [{ text: 'Je cache mes sources.' }] },
    },
  },
} as any);

const MOCK_CUSTOM = normalizeBackground({
  id: 'bg-custom',
  name: 'Personnalisé',
  data: {
    preset: false,
    proficiencies: {
      skills: { fixed: [], choose: { count: 0, options: [] } },
      tools: { fixed: [], choose: [] },
      languages: { fixed: [], choiceCount: 0 },
    },
    equipment: { fixed: [], choose: [], currency: { or: 0 } },
    privilege: { id: 'priv-custom', name: '', desc: '' },
    flavor: { summary: 'Historique sur mesure.' },
  },
} as any);

describe('BackgroundStep', () => {
  let component: BackgroundStep;
  let fixture: ComponentFixture<BackgroundStep>;
  let setBackgroundSpy: jasmine.Spy;
  let nextStepSpy: jasmine.Spy;

  beforeEach(async () => {
    setBackgroundSpy = jasmine.createSpy('setBackground');
    nextStepSpy = jasmine.createSpy('nextStep');

    await TestBed.configureTestingModule({
      imports: [BackgroundStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: { getBackgrounds: () => of([MOCK_ERUDIT, MOCK_CUSTOM]) },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal({
              speciesName: 'Humain',
              civilizationName: 'Ajagar',
              backgroundId: null,
            }),
            setBackground: setBackgroundSpy,
            nextStep: nextStepSpy,
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BackgroundStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads backgrounds and builds tool choice groups for preset', () => {
    expect(component.loading()).toBeFalse();
    expect(component.backgrounds().length).toBe(2);

    component.selectBackground('bg-erudit');
    fixture.detectChanges();

    expect(component.phase()).toBe('configure');
    expect(component.isCustom()).toBeFalse();
    expect(component.maxSkills()).toBe(0);
    expect(component.maxLanguages()).toBe(2);
    expect(component.toolChoiceGroups().length).toBe(1);
    expect(component.toolChoiceGroups()[0].options[0].label).toContain('Instrument');
  });

  it('validates custom background before confirm', () => {
    component.selectBackground('bg-custom');
    fixture.detectChanges();

    expect(component.isConfigValid()).toBeFalse();
    expect(component.validationMessages().length).toBeGreaterThan(0);

    component.customBgName.set('Exilé des brumes');
    component.customPrivilegeName.set('Contacts');
    component.customPrivilegeDesc.set('Un réseau d’informateurs.');
    fixture.detectChanges();
    expect(component.isConfigValid()).toBeTrue();
  });

  it('confirm pushes preset background with equipment slots and skills', () => {
    component.selectBackground('bg-erudit');
    component.pickEntry('traits', 'Je cite des textes anciens.');
    component.pickEntry('ideals', 'La connaissance doit être partagée.');
    fixture.detectChanges();

    component.confirm();

    expect(setBackgroundSpy).toHaveBeenCalledTimes(1);
    expect(nextStepSpy).toHaveBeenCalledTimes(1);

    const sel = setBackgroundSpy.calls.mostRecent().args[0];
    expect(sel.backgroundId).toBe('bg-erudit');
    expect(sel.skills).toEqual(['skill-arcanes']);
    expect(sel.equipment.length).toBe(1);
    expect(sel.equipment[0].refId).toBe('gr-sac-derudit');
    expect(sel.equipmentSlots.length).toBe(1);
    expect(sel.equipmentSlots[0].alternatives?.[0][0].id).toBe('tl-necessaire-de-calligraphe');
    expect(sel.currency.or).toBe(10);
    expect(sel.traits).toBe('Je cite des textes anciens.');
  });

  it('shows error when backgrounds fail to load', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [BackgroundStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: { getBackgrounds: () => throwError(() => new Error('fail')) },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal({}),
            setBackground: jasmine.createSpy(),
            nextStep: jasmine.createSpy(),
            previousStep: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();

    const errFixture = TestBed.createComponent(BackgroundStep);
    errFixture.detectChanges();
    expect(errFixture.componentInstance.error()).toBe('Impossible de charger les historiques.');
  });
});
