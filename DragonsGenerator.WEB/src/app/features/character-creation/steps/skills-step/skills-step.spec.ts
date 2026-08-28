import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { SkillsStep } from './skills-step';

const MOCK_SKILLS = [
  { id: 'ski-acrobaties', name: 'Acrobaties', ability: 'Dextérité', description: '', examples: [], passiveCheck: false },
  { id: 'ski-arcanes', name: 'Arcanes', ability: 'Intelligence', description: '', examples: [], passiveCheck: false },
  { id: 'ski-histoire', name: 'Histoire', ability: 'Intelligence', description: '', examples: [], passiveCheck: false },
  { id: 'ski-investigation', name: 'Investigation', ability: 'Intelligence', description: '', examples: [], passiveCheck: false },
  { id: 'ski-perception', name: 'Perception', ability: 'Sagesse', description: '', examples: [], passiveCheck: false },
];

const MOCK_TOOLS = [
  { id: 'tl-lyre', name: 'Lyre', type: 'TOOL', subtype: 'musical_instrument' },
  { id: 'tl-des', name: 'Dés', type: 'TOOL', subtype: 'gaming_set' },
  { id: 'tl-necessaire-dherboristerie', name: "Nécessaire d'herboristerie", type: 'TOOL', subtype: 'artisan_tools' },
];

function skillsCreation(overrides: Record<string, unknown> = {}) {
  return {
    classId: 'cls-lettre',
    className: 'Lettré',
    skillChooseCount: 2,
    skillOptions: ['ski-acrobaties', 'ski-arcanes', 'ski-histoire', 'ski-investigation'],
    backgroundPreset: true,
    backgroundProficiencies: {
      skills: { fixed: ['ski-arcanes'], chooseCount: 1, options: ['any'] },
      tools: {
        fixed: [],
        choose: [{ chooseCount: 1, options: [{ type: 'instrument', any: true }] }],
      },
      equipment: { fromToolProficiency: true },
    },
    selectedSkills: [] as string[],
    backgroundSkills: [] as string[],
    backgroundTools: [] as string[],
    expertiseSkills: [] as string[],
    speciesBonusSkillCount: 0,
    speciesBonusToolCount: 0,
    targetLevel: 1,
    ...overrides,
  };
}

describe('SkillsStep', () => {
  let component: SkillsStep;
  let fixture: ComponentFixture<SkillsStep>;
  let creationSignal: ReturnType<typeof signal<ReturnType<typeof skillsCreation>>>;
  let setProficienciesSpy: jasmine.Spy;
  let setExpertiseSpy: jasmine.Spy;
  let nextStepSpy: jasmine.Spy;

  beforeEach(async () => {
    creationSignal = signal(skillsCreation());
    setProficienciesSpy = jasmine.createSpy('setProficiencies');
    setExpertiseSpy = jasmine.createSpy('setExpertiseSkills');
    nextStepSpy = jasmine.createSpy('nextStep');

    await TestBed.configureTestingModule({
      imports: [SkillsStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSkills: () => of(MOCK_SKILLS),
            getClassById: () => of({ id: 'cls-lettre', name: 'Lettré', data: { progression: [] } }),
            getEquipments: () => of(MOCK_TOOLS),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            targetLevel: () => 1,
            abilityModifiers: () => ({
              force: 0,
              dexterite: 1,
              constitution: 0,
              intelligence: 2,
              sagesse: 1,
              charisme: 0,
            }),
            setProficiencies: setProficienciesSpy,
            setExpertiseSkills: setExpertiseSpy,
            nextStep: nextStepSpy,
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SkillsStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads skill map and tool catalog on init', () => {
    expect(Object.keys(component.skillMap()).length).toBe(MOCK_SKILLS.length);
    expect(component.toolCatalog().length).toBe(MOCK_TOOLS.length);
    expect(component.bgFixedSkills()).toEqual(['skill-arcanes']);
  });

  it('restores prior selections from builder', async () => {
    await TestBed.resetTestingModule();
    creationSignal = signal(
      skillsCreation({
        selectedSkills: ['skill-acrobaties'],
        backgroundSkills: ['skill-histoire'],
        backgroundTools: ['tl-lyre'],
      }),
    );
    await TestBed.configureTestingModule({
      imports: [SkillsStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSkills: () => of(MOCK_SKILLS),
            getClassById: () => of({ id: 'cls-lettre', name: 'Lettré', data: { progression: [] } }),
            getEquipments: () => of(MOCK_TOOLS),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            targetLevel: () => 1,
            abilityModifiers: () => ({
              force: 0,
              dexterite: 1,
              constitution: 0,
              intelligence: 2,
              sagesse: 1,
              charisme: 0,
            }),
            setProficiencies: setProficienciesSpy,
            setExpertiseSkills: setExpertiseSpy,
            nextStep: nextStepSpy,
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SkillsStep);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.selectedClassSkills()).toEqual(['skill-acrobaties']);
    expect(component.selectedBgSkills()).toContain('skill-histoire');
    expect(component.selectedBgTools()).toContain('tl-lyre');
  });

  it('blocks class skill when already chosen as background skill', () => {
    component.toggleBgSkill('ski-histoire');
    fixture.detectChanges();
    component.toggleClassSkill('ski-histoire');
    fixture.detectChanges();

    expect(component.selectedClassSkills()).not.toContain('skill-histoire');
    expect(component.selectedBgSkills()).toContain('skill-histoire');
  });

  it('does not allow toggling fixed background skills', () => {
    component.toggleBgSkill('ski-arcanes');
    fixture.detectChanges();
    expect(component.selectedBgSkills()).not.toContain('skill-arcanes');
  });

  it('expands instrument category and picks concrete tool for Érudit-style group', () => {
    const group = component.bgToolChoiceGroups()[0];
    expect(group.options[0].category).toBe('instrument');

    component.onBgToolOptionClick(group.options[0], group);
    fixture.detectChanges();
    expect(component.expandedBgToolCategory()).toBe('instrument');

    component.pickConcreteBgTool('tl-lyre', 'instrument', group);
    fixture.detectChanges();
    expect(component.selectedBgTools()).toContain('tl-lyre');
    expect(component.isSelectionComplete()).toBeFalse();
  });

  it('isSelectionComplete requires class, background and tool choices', () => {
    expect(component.isSelectionComplete()).toBeFalse();

    component.toggleClassSkill('ski-acrobaties');
    component.toggleClassSkill('ski-investigation');
    component.toggleBgSkill('ski-histoire');
    fixture.detectChanges();
    expect(component.isSelectionComplete()).toBeFalse();

    const group = component.bgToolChoiceGroups()[0];
    component.pickConcreteBgTool('tl-lyre', 'instrument', group);
    fixture.detectChanges();
    expect(component.isSelectionComplete()).toBeTrue();
  });

  it('confirmSelection pushes proficiencies and advances wizard', () => {
    component.toggleClassSkill('ski-acrobaties');
    component.toggleClassSkill('ski-investigation');
    component.toggleBgSkill('ski-histoire');
    const group = component.bgToolChoiceGroups()[0];
    component.pickConcreteBgTool('tl-lyre', 'instrument', group);
    fixture.detectChanges();

    component.confirmSelection();

    expect(setProficienciesSpy).toHaveBeenCalledTimes(1);
    const [classSkills, bgSkills, tools, bgSlots] = setProficienciesSpy.calls.mostRecent().args;
    expect(classSkills).toEqual(['skill-acrobaties', 'skill-investigation']);
    expect(bgSkills).toContain('skill-histoire');
    expect(tools).toContain('tl-lyre');
    expect(bgSlots.length).toBeGreaterThan(0);
    expect(setExpertiseSpy).toHaveBeenCalled();
    expect(nextStepSpy).toHaveBeenCalled();
  });
});
