import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { createLettreClass, LETTRE_STARTING_SLOTS } from '@testing/lettre-fixtures';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { SkillsStep } from './steps/skills-step/skills-step';
import { EquipmentStep } from './steps/equipment-step/equipment-step';
import type { Equipment } from '@core/models/Equipments/equipment';

const MOCK_WEAPONS: Equipment[] = [
  {
    id: 'wp-dague',
    name: 'Dague',
    type: 'WEAPON',
    subtype: 'SIMPLE_MELEE',
    cost: { v: 2, u: 'po' },
    wKg: 0.5,
    data: {} as Equipment['data'],
  },
  {
    id: 'wp-baton-de-combat',
    name: 'Bâton de combat',
    type: 'WEAPON',
    subtype: 'SIMPLE_MELEE',
    cost: { v: 2, u: 'po' },
    wKg: 2,
    data: {} as Equipment['data'],
  },
  {
    id: 'wp-epee-courte',
    name: 'Épée courte',
    type: 'WEAPON',
    subtype: 'MARTIAL_MELEE',
    cost: { v: 10, u: 'po' },
    wKg: 1,
    data: {} as Equipment['data'],
  },
  {
    id: 'wp-arbalete-legere',
    name: 'Arbalète légère',
    type: 'WEAPON',
    subtype: 'MARTIAL_RANGED',
    cost: { v: 25, u: 'po' },
    wKg: 2.5,
    data: {} as Equipment['data'],
  },
];

const MOCK_TOOLS: Equipment[] = [
  {
    id: 'tl-lyre',
    name: 'Lyre',
    type: 'TOOL',
    subtype: 'musical_instrument' as Equipment['subtype'],
    cost: { v: 35, u: 'po' },
    wKg: 1,
    data: {} as Equipment['data'],
  },
  {
    id: 'tl-des',
    name: 'Dés',
    type: 'TOOL',
    subtype: 'gaming_set' as Equipment['subtype'],
    cost: { v: 0.1, u: 'po' },
    wKg: 0,
    data: {} as Equipment['data'],
  },
  {
    id: 'tl-echecs',
    name: 'Échecs',
    type: 'TOOL',
    subtype: 'gaming_set' as Equipment['subtype'],
    cost: { v: 1, u: 'po' },
    wKg: 0.5,
    data: {} as Equipment['data'],
  },
];

const MOCK_SKILLS = [
  { id: 'ski-arcanes', name: 'Arcanes', ability: 'Intelligence', description: '', examples: [], passiveCheck: false },
  { id: 'ski-histoire', name: 'Histoire', ability: 'Intelligence', description: '', examples: [], passiveCheck: false },
  { id: 'ski-investigation', name: 'Investigation', ability: 'Intelligence', description: '', examples: [], passiveCheck: false },
  { id: 'ski-perception', name: 'Perception', ability: 'Sagesse', description: '', examples: [], passiveCheck: false },
];

describe('Lettré mastered-choice integration', () => {
  const lettreClass = createLettreClass();

  it('skills step merges class weapon/tool picks before equipment resolves mastered-choice', async () => {
    const creationSignal = signal({
      classId: 'cls-lettre',
      className: 'Lettré',
      skillChooseCount: 3,
      skillOptions: ['any'],
      weaponProficiencies: ['wp-dague', 'wp-baton-de-combat'],
      toolProficiencies: [] as string[],
      backgroundSkills: ['skill-histoire'],
      backgroundTools: [] as string[],
      backgroundProficiencies: { skills: { fixed: [], chooseCount: 0 }, tools: { fixed: [] } },
      selectedSkills: [] as string[],
      expertiseSkills: [] as string[],
      classChoiceAnswers: {} as Record<string, string[]>,
      startingEquipmentSlots: LETTRE_STARTING_SLOTS,
      backgroundEquipmentSlots: [],
      targetLevel: 1,
    });

    const mergeSpy = jasmine.createSpy('mergeClassProficiencies').and.callFake(
      (weapons: string[], tools: string[], answers: Record<string, string[]>) => {
        creationSignal.update((c) => ({
          ...c,
          weaponProficiencies: [...new Set([...c.weaponProficiencies, ...weapons])],
          toolProficiencies: [...new Set([...c.toolProficiencies, ...tools])],
          classChoiceAnswers: { ...c.classChoiceAnswers, ...answers },
        }));
      },
    );

    await TestBed.configureTestingModule({
      imports: [SkillsStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSkills: () => of(MOCK_SKILLS),
            getClassById: () => of(lettreClass),
            getEquipments: () => of([...MOCK_WEAPONS, ...MOCK_TOOLS]),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            targetLevel: () => 1,
            abilityModifiers: () => ({
              force: 0,
              dexterite: 0,
              constitution: 0,
              intelligence: 2,
              sagesse: 1,
              charisme: 0,
            }),
            setProficiencies: jasmine.createSpy('setProficiencies'),
            setExpertiseSkills: jasmine.createSpy('setExpertiseSkills'),
            mergeClassProficiencies: mergeSpy,
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    const skillsFixture = TestBed.createComponent(SkillsStep);
    const skills = skillsFixture.componentInstance;
    skillsFixture.detectChanges();

    expect(skills.classWeaponsNeeded()).toBe(2);
    expect(skills.classToolsNeeded()).toBe(3);

    skills.toggleClassSkill('skill-arcanes');
    skills.toggleClassSkill('skill-investigation');
    skills.toggleClassSkill('skill-perception');
    skills.toggleClassWeapon('wp-epee-courte');
    skills.toggleClassWeapon('wp-arbalete-legere');
    skills.toggleClassTool('tl-lyre');
    skills.toggleClassTool('tl-des');
    skills.toggleClassTool('tl-echecs');
    skillsFixture.detectChanges();

    expect(skills.isSelectionComplete()).toBeTrue();
    skills.confirmSelection();

    expect(mergeSpy).toHaveBeenCalled();
    expect(creationSignal().weaponProficiencies).toContain('wp-epee-courte');
    expect(creationSignal().toolProficiencies).toEqual(['tl-lyre', 'tl-des', 'tl-echecs']);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EquipmentStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: { getEquipments: () => of([...MOCK_WEAPONS, ...MOCK_TOOLS]) },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    const eqFixture = TestBed.createComponent(EquipmentStep);
    eqFixture.detectChanges();
    const eq = eqFixture.componentInstance;

    const wpSlot = eq.resolvedSlots().find((s) =>
      s.alternatives?.some((alt) => alt.items.some((i) => i.ref.id === 'wp-mastered-choice')),
    );
    expect(wpSlot).toBeTruthy();

    const allItems = eq.resolvedSlots().flatMap((s) => [
      ...s.fixedItems,
      ...s.alternatives.flatMap((a) => a.items),
    ]);
    const wpChoice = allItems.find((i) => i.ref.id === 'wp-mastered-choice');
    expect(wpChoice?.categoryItems?.length).toBe(4);
    expect(wpChoice?.categoryItems?.some((w) => w.id === 'wp-epee-courte')).toBeTrue();
  });
});
