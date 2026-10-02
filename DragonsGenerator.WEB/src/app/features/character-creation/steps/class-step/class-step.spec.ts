import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { createLettreClass } from '@testing/lettre-fixtures';
import { normalizeCharacterClass } from '@core/utils/class-data.adapter';
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

  it('prevPhase from ensorceleur subclass (Atavisme) returns to class selection', async () => {
    TestBed.resetTestingModule();
    const sorcerer = normalizeCharacterClass({
      id: 'cls-ensorceleur',
      name: 'Ensorceleur',
      data: {
        hit_die: '1d6',
        hp_at_level_1: 6,
        hp_per_level_average: 4,
        primary_abilities: ['cha'],
        saving_throw_proficiencies: ['con', 'cha'],
        armor_proficiencies: [],
        weapon_proficiencies: ['wp-dague'],
        tool_proficiencies: [],
        choice_pools: [],
        features_details: [],
        subclasses: {
          name: 'Atavisme',
          level_unlocked: 1,
          options: [
            {
              id: 'subcls-lignee-draconique',
              name: 'Lignée draconique',
              desc: 'Sang de dragon.',
              features: [],
              sub_choices: [
                {
                  id: 'choice-dragon-ancestry',
                  label: 'Ancestralité',
                  level_required: 1,
                  count: 1,
                  type: 'dragon_ancestry',
                  pool: ['dragon-rouge', 'dragon-bleu'],
                },
              ],
            },
            {
              id: 'subcls-magie-psychique',
              name: 'Magie psychique',
              desc: 'Esprit.',
              features: [],
            },
          ],
        },
        progression: [{ level: 1, prof_bonus: 2, features: [] }],
        starting_equipment: { fixed: [{ id: 'wp-dague', qty: 2 }], choice_pools: [] },
      },
    } as any);
    const clearClass = jasmine.createSpy('clearClass');
    await TestBed.configureTestingModule({
      imports: [ClassStep],
      providers: [
        ...zonelessTestProviders,
        { provide: DataService, useValue: { getClasses: () => of([sorcerer]) } },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal({ classId: null, targetLevel: 1, classChoiceAnswers: {} }),
            targetLevel: () => 1,
            proficiencyBonus: () => 2,
            clearClass,
            setClass: jasmine.createSpy('setClass'),
            setClassProgressionChoices: jasmine.createSpy('setClassProgressionChoices'),
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ClassStep);
    const c = f.componentInstance;
    f.detectChanges();
    c.selectedClassId.set('cls-ensorceleur');
    f.detectChanges();
    expect(c.currentPhase()).toBe('subclass');
    expect(c.canGoPrevPhase()).toBeTrue();

    // Sur le carrousel Atavisme sans voie choisie → retour classe
    c.prevPhase();
    f.detectChanges();
    expect(c.selectedClassId()).toBeNull();
    expect(c.currentPhase()).toBe('class');
    expect(clearClass).toHaveBeenCalled();

    // Reprendre : voie choisie, sous-choix pas encore rempli → prev retire la voie
    clearClass.calls.reset();
    c.selectedClassId.set('cls-ensorceleur');
    c.selectedSubclassId.set('subcls-lignee-draconique');
    c.subChoiceAnswers.set(new Map());
    f.detectChanges();
    expect(c.currentPhase()).toBe('sub_choice');
    c.prevPhase();
    f.detectChanges();
    expect(c.selectedSubclassId()).toBeNull();
    expect(c.subChoiceAnswers().size).toBe(0);
    expect(c.currentPhase()).toBe('subclass');
    expect(c.selectedClassId()).toBe('cls-ensorceleur');
    expect(clearClass).not.toHaveBeenCalled();
  });

  it('prevPhase from subclass after combat_style returns to combat_style then class', async () => {
    TestBed.resetTestingModule();
    const fighter = normalizeCharacterClass({
      id: 'cls-guerrier',
      name: 'Guerrier',
      data: {
        hit_die: '1d10',
        hp_at_level_1: 10,
        hp_per_level_average: 6,
        primary_abilities: ['str'],
        saving_throw_proficiencies: ['str', 'con'],
        armor_proficiencies: [],
        weapon_proficiencies: [],
        tool_proficiencies: [],
        choice_pools: [
          {
            id: 'choice-style-de-combat',
            name: 'Style de combat',
            type: 'fighting_style',
            quantity: 1,
            pool: ['feat-style-duel', 'feat-style-protection'],
            unlocked_at_level: 1,
          },
        ],
        features_details: [
          {
            id: 'feat-style-de-combat',
            name: 'Style de combat',
            desc: 'Choisissez un style.',
            level: 1,
            resolves_to_choice_pool: 'choice-style-de-combat',
          },
        ],
        subclasses: {
          name: 'Archétype martial',
          level_unlocked: 3,
          options: [
            { id: 'subcls-champion', name: 'Champion', desc: '…', features: [] },
          ],
        },
        progression: [
          { level: 1, prof_bonus: 2, features: ['feat-style-de-combat'] },
          { level: 3, prof_bonus: 2, features: [] },
        ],
        starting_equipment: [],
      },
    } as any);
    const clearClass = jasmine.createSpy('clearClass');
    await TestBed.configureTestingModule({
      imports: [ClassStep],
      providers: [
        ...zonelessTestProviders,
        { provide: DataService, useValue: { getClasses: () => of([fighter]) } },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal({ classId: null, targetLevel: 3, classChoiceAnswers: {} }),
            targetLevel: () => 3,
            proficiencyBonus: () => 2,
            clearClass,
            setClass: jasmine.createSpy('setClass'),
            setClassProgressionChoices: jasmine.createSpy('setClassProgressionChoices'),
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ClassStep);
    const c = f.componentInstance;
    f.detectChanges();
    c.selectedClassId.set('cls-guerrier');
    c.selectedCombatStyleIds.set(['feat-style-duel']);
    f.detectChanges();
    expect(c.currentPhase()).toBe('subclass');

    c.prevPhase();
    f.detectChanges();
    expect(c.selectedCombatStyleIds()).toEqual([]);
    expect(c.currentPhase()).toBe('combat_style');
    expect(c.selectedClassId()).toBe('cls-guerrier');

    c.prevPhase();
    f.detectChanges();
    expect(c.selectedClassId()).toBeNull();
    expect(c.currentPhase()).toBe('class');
    expect(clearClass).toHaveBeenCalled();
  });

  it('prevPhase from empty combat_style returns to class selection', async () => {
    TestBed.resetTestingModule();
    const fighter = normalizeCharacterClass({
      id: 'cls-guerrier',
      name: 'Guerrier',
      data: {
        hit_die: '1d10',
        hp_at_level_1: 10,
        hp_per_level_average: 6,
        primary_abilities: ['str'],
        saving_throw_proficiencies: ['str', 'con'],
        armor_proficiencies: [],
        weapon_proficiencies: [],
        tool_proficiencies: [],
        choice_pools: [
          {
            id: 'choice-style-de-combat',
            name: 'Style de combat',
            type: 'fighting_style',
            quantity: 1,
            pool: ['feat-style-duel', 'feat-style-protection'],
            unlocked_at_level: 1,
          },
        ],
        features_details: [
          {
            id: 'feat-style-de-combat',
            name: 'Style de combat',
            desc: 'Choisissez un style.',
            level: 1,
            resolves_to_choice_pool: 'choice-style-de-combat',
          },
        ],
        subclasses: [],
        progression: [{ level: 1, prof_bonus: 2, features: ['feat-style-de-combat'] }],
        starting_equipment: [],
      },
    } as any);
    const clearClass = jasmine.createSpy('clearClass');
    await TestBed.configureTestingModule({
      imports: [ClassStep],
      providers: [
        ...zonelessTestProviders,
        { provide: DataService, useValue: { getClasses: () => of([fighter]) } },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal({ classId: null, targetLevel: 1, classChoiceAnswers: {} }),
            targetLevel: () => 1,
            proficiencyBonus: () => 2,
            clearClass,
            setClass: jasmine.createSpy('setClass'),
            setClassProgressionChoices: jasmine.createSpy('setClassProgressionChoices'),
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ClassStep);
    const c = f.componentInstance;
    f.detectChanges();
    c.selectedClassId.set('cls-guerrier');
    c.selectedCombatStyleIds.set([]);
    f.detectChanges();
    expect(c.currentPhase()).toBe('combat_style');

    c.prevPhase();
    f.detectChanges();
    expect(c.selectedClassId()).toBeNull();
    expect(c.currentPhase()).toBe('class');
    expect(clearClass).toHaveBeenCalled();
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
