import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { DataService } from '@core/services/data.service';
import {
  CharacterBuilderService,
  type SpeciesSelection,
} from '@core/services/character-builder.service';
import type { Species } from '@core/models/Species/species';
import { SpeciesStep } from './species-step';

function baseStats(overrides: Record<string, unknown> = {}) {
  return {
    abilityScoreIncrease: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speedM: 9,
    size: 'M',
    darkvisionM: 0,
    height: { desc: '1.70m' },
    weight: { desc: '70kg' },
    age: { maturityYears: 18, lifespanYears: 80, desc: '' },
    alignment: { tendency: 'any', desc: '' },
    ...overrides,
  };
}

const MOCK_HUMAIN: Species = {
  id: 'sp-humain',
  name: 'Humain',
  nameAlt: [],
  source: { book: 'Test', pages: '1' },
  flavor: { summary: 'Peuple polyvalent.' },
  baseStats: baseStats(),
  traits: [{ id: 'trait-humain', name: 'Polyvalence', desc: 'Bonus partout.' }],
  creationChoices: [],
  languages: { fixed: ['lg-commun'], choiceCount: 1 },
  subspecies: [],
  optionalRules: [],
};

const MOCK_DRAKEIDE: Species = {
  id: 'sp-drakeide',
  name: 'Drakeide',
  nameAlt: ['Dragonborn'],
  source: { book: 'Test', pages: '2' },
  flavor: { summary: 'Descendants des dragons.' },
  baseStats: baseStats({ abilityScoreIncrease: { str: 2, cha: 1 } }),
  traits: [{ id: 'trait-breath', name: 'Souffle', desc: 'Attaque de souffle.' }],
  creationChoices: [],
  languages: { fixed: ['lg-commun', 'lg-draconique'], choiceCount: 0 },
  subspecies: [
    {
      id: 'sub-drakeide-rouge',
      name: 'Rouge',
      playable: true,
      flavor: 'Feu.',
      abilityScoreIncrease: { str: 1 },
      traits: [{ id: 'trait-fire', name: 'Résistance feu', desc: 'Résistance au feu.' }],
      creationChoices: [
        {
          id: 'choice-drakeide-asi',
          name: 'Caractéristique bonus',
          desc: 'Choisissez une caractéristique.',
          type: 'ability_score_increase',
          choiceCount: 1,
          options: ['str', 'con'],
          valuePerChoice: 1,
        },
      ],
    },
    {
      id: 'sub-drakeide-bleu',
      name: 'Bleu',
      playable: true,
      flavor: 'Foudre.',
      abilityScoreIncrease: { dex: 1 },
      traits: [{ id: 'trait-lightning', name: 'Résistance foudre', desc: 'Résistance à la foudre.' }],
      creationChoices: [],
    },
  ],
  optionalRules: [],
};

const MOCK_LANGUAGES = [{ id: 'lg-commun', name: 'Commun' }];

describe('SpeciesStep', () => {
  let component: SpeciesStep;
  let fixture: ComponentFixture<SpeciesStep>;
  let creationSignal: ReturnType<typeof signal<Record<string, unknown>>>;
  let setSpeciesSpy: jasmine.Spy;
  let clearSpeciesSpy: jasmine.Spy;
  let nextStepSpy: jasmine.Spy;

  beforeEach(async () => {
    creationSignal = signal({});
    setSpeciesSpy = jasmine.createSpy('setSpecies');
    clearSpeciesSpy = jasmine.createSpy('clearSpecies');
    nextStepSpy = jasmine.createSpy('nextStep');

    await TestBed.configureTestingModule({
      imports: [SpeciesStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpecies: () => of([MOCK_HUMAIN, MOCK_DRAKEIDE]),
            getLanguagesSummary: () => of(MOCK_LANGUAGES),
            getSpells: () => of([]),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            setSpecies: setSpeciesSpy,
            clearSpecies: clearSpeciesSpy,
            nextStep: nextStepSpy,
            previousStep: jasmine.createSpy('previousStep'),
            targetLevel: () => 1,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SpeciesStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads species and exposes carousel cards', () => {
    expect(component.loading()).toBeFalse();
    expect(component.allSpecies().length).toBe(2);
    expect(component.currentPhase()).toBe('species');
    expect(component.currentCards().some((c) => c.id === 'sp-humain')).toBeTrue();
  });

  it('completes humain selection without subspecies or choices', () => {
    component.selectedSpeciesId.set('sp-humain');
    fixture.detectChanges();

    expect(component.requiresSubspecies()).toBeFalse();
    expect(component.currentPhase()).toBe('species');
    expect(component.selectionComplete()).toBeTrue();
    expect(component.canContinue()).toBeTrue();
  });

  it('requires subspecies and lineage choice for drakeide', () => {
    component.selectedSpeciesId.set('sp-drakeide');
    fixture.detectChanges();

    expect(component.requiresSubspecies()).toBeTrue();
    expect(component.selectionComplete()).toBeFalse();
    expect(component.currentPhase()).toBe('subspecies');

    component.selectedSubspeciesId.set('sub-drakeide-rouge');
    fixture.detectChanges();
    expect(component.selectionComplete()).toBeFalse();
    expect(component.currentPhase()).toBe('choice');

    component.choiceAnswers.update((m) => new Map(m).set('choice-drakeide-asi', ['str']));
    fixture.detectChanges();

    expect(component.selectionComplete()).toBeTrue();
  });

  it('confirmSelection pushes species data to the builder', () => {
    component.selectedSpeciesId.set('sp-drakeide');
    component.selectedSubspeciesId.set('sub-drakeide-rouge');
    component.choiceAnswers.update((m) => new Map(m).set('choice-drakeide-asi', ['str']));
    fixture.detectChanges();

    component.confirmSelection();
    expect(setSpeciesSpy).toHaveBeenCalledTimes(1);

    const selection = setSpeciesSpy.calls.mostRecent().args[0] as SpeciesSelection;
    expect(selection.speciesId).toBe('sp-drakeide');
    expect(selection.subspeciesId).toBe('sub-drakeide-rouge');
    expect(selection.choiceAnswers['choice-drakeide-asi']).toEqual(['str']);
    expect(selection.traits.some((t) => t.refId === 'trait-breath')).toBeTrue();
  });

  it('continueToNextStep confirms and advances when selection is complete', () => {
    component.selectedSpeciesId.set('sp-humain');
    fixture.detectChanges();

    component.continueToNextStep();
    expect(setSpeciesSpy).toHaveBeenCalled();
    expect(nextStepSpy).toHaveBeenCalled();
  });

  it('restoreFromBuilder rehydrates saved species picks', async () => {
    TestBed.resetTestingModule();
    creationSignal = signal({
      speciesId: 'sp-drakeide',
      subspeciesId: 'sub-drakeide-bleu',
      speciesChoiceAnswers: {},
    });

    await TestBed.configureTestingModule({
      imports: [SpeciesStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpecies: () => of([MOCK_HUMAIN, MOCK_DRAKEIDE]),
            getLanguagesSummary: () => of(MOCK_LANGUAGES),
            getSpells: () => of([]),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            setSpecies: jasmine.createSpy('setSpecies'),
            clearSpecies: jasmine.createSpy('clearSpecies'),
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    const restoreFixture = TestBed.createComponent(SpeciesStep);
    restoreFixture.detectChanges();

    const restored = restoreFixture.componentInstance;
    expect(restored.selectedSpeciesId()).toBe('sp-drakeide');
    expect(restored.selectedSubspeciesId()).toBe('sub-drakeide-bleu');
    expect(restored.selectionComplete()).toBeTrue();
  });

  it('clearSelection resets local picks and builder species', () => {
    component.selectedSpeciesId.set('sp-humain');
    fixture.detectChanges();

    jasmine.clock().install();
    component.clearSelection();
    jasmine.clock().tick(200);
    fixture.detectChanges();
    jasmine.clock().uninstall();

    expect(clearSpeciesSpy).toHaveBeenCalled();
    expect(component.selectedSpeciesId()).toBeNull();
  });

  it('shows load error when species fail', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SpeciesStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpecies: () => throwError(() => new Error('network')),
            getLanguagesSummary: () => of([]),
            getSpells: () => of([]),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal({}),
            setSpecies: jasmine.createSpy('setSpecies'),
            clearSpecies: jasmine.createSpy('clearSpecies'),
            nextStep: jasmine.createSpy('nextStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    const errFixture = TestBed.createComponent(SpeciesStep);
    errFixture.detectChanges();
    expect(errFixture.componentInstance.error()).toBe('Impossible de charger les données.');
  });
});

