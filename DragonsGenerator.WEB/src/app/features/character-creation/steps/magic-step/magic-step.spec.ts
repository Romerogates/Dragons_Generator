import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import type { Spell } from '@core/models/Spells/spell';
import type { Deity } from '@core/models/Deities/deity';
import { MagicStep } from './magic-step';

const CLASS_ID = 'cls-magicien';
const CLERIC_CLASS_ID = 'cls-pretre';

function mockSpell(id: string, level: number, classId = CLASS_ID): Spell {
  return {
    id,
    name: id,
    level,
    school: 'evocation',
    castingTime: { amount: 1, unit: 'action' },
    range: { amount: 30, unit: 'feet' },
    duration: { amount: null, unit: 'instantaneous' },
    components: { v: true, s: true, m: null },
    isRitual: false,
    isConcentration: false,
    isCorrupted: false,
    description: 'Sort de test.',
    modularOptions: [],
    classes: [classId],
  };
}

const MOCK_CANTrips = ['spl-ray', 'spl-mage-hand', 'spl-prestidigitation', 'spl-light'].map((id) =>
  mockSpell(id, 0),
);

const MOCK_LEVEL1 = ['spl-magic-missile', 'spl-shield', 'spl-sleep', 'spl-burning-hands', 'spl-charm', 'spl-detect'].map(
  (id) => mockSpell(id, 1),
);

const MOCK_WIZARD_CLASS = {
  id: CLASS_ID,
  name: 'Magicien',
  data: {
    spellcasting: { grimoire: { initial_spells: 6 } },
    progression: [{ level: 1, resources: { cantrips_known: 3, spells_known: 0 } }],
  },
};

const MOCK_CLERIC_CLASS = {
  id: CLERIC_CLASS_ID,
  name: 'Prêtre',
  data: {
    spellcasting: { ability: 'wis' },
    progression: [{ level: 1, resources: { cantrips_known: 3, spells_known: 0 } }],
    subclasses: {
      options: [
        {
          id: 'subcls-domaine-de-la-vie',
          bonus_spells_granted: [{ level_unlocked: 1, spells: ['spl-bless'] }],
        },
      ],
    },
  },
};

const MOCK_DEITIES: Deity[] = [
  {
    id: 'deity-life',
    name: 'Déesse de la Vie',
    domains: ['dom-vie'],
    grantsPowersTo: ['pretre'],
    otherNames: [],
  },
];

function wizardCreation(overrides: Record<string, unknown> = {}) {
  return {
    classId: CLASS_ID,
    spellcastingKind: 'wizard',
    hasSpellcasting: true,
    targetLevel: 1,
    racialSpellGrants: [],
    spellcastingDetails: {},
    spellcastingAbility: 'int',
    ...overrides,
  };
}

function clericCreation(overrides: Record<string, unknown> = {}) {
  return {
    classId: CLERIC_CLASS_ID,
    spellcastingKind: 'cleric',
    hasSpellcasting: true,
    subclassId: 'subcls-domaine-de-la-vie',
    targetLevel: 1,
    racialSpellGrants: [],
    spellcastingDetails: {},
    spellcastingAbility: 'wis',
    ...overrides,
  };
}

function builderMock(
  creation: ReturnType<typeof signal<Record<string, unknown>>>,
  extra: Record<string, unknown> = {},
) {
  return {
    creation,
    targetLevel: () => (creation() as { targetLevel?: number }).targetLevel ?? 1,
    abilityModifiers: () => ({ int: 2, wis: 2, str: 0, dex: 0, con: 0, cha: 0 }),
    proficiencyBonus: () => 2,
    nextStep: jasmine.createSpy('nextStep'),
    previousStep: jasmine.createSpy('previousStep'),
    ...extra,
  };
}

describe('MagicStep', () => {
  let component: MagicStep;
  let fixture: ComponentFixture<MagicStep>;
  let creationSignal: ReturnType<typeof signal<ReturnType<typeof wizardCreation>>>;
  let nextStepSpy: jasmine.Spy;

  beforeEach(async () => {
    creationSignal = signal(wizardCreation());
    nextStepSpy = jasmine.createSpy('nextStep');

    await TestBed.configureTestingModule({
      imports: [MagicStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpells: () => of([...MOCK_CANTrips, ...MOCK_LEVEL1]),
            getDeities: () => of(MOCK_DEITIES),
            getClassById: (id: string) =>
              of(id === CLERIC_CLASS_ID ? MOCK_CLERIC_CLASS : MOCK_WIZARD_CLASS),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: builderMock(creationSignal, { nextStep: nextStepSpy }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MagicStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads spells and builds wizard quota', () => {
    expect(component.loading()).toBeFalse();
    expect(component.allSpells().length).toBeGreaterThan(0);
    expect(component.quota()?.cantrips).toBe(3);
    expect(component.quota()?.grimoireSpells).toBe(6);
    expect(component.isWizard()).toBeTrue();
  });

  it('requires full cantrip and grimoire picks before selection is complete', () => {
    expect(component.selectionComplete()).toBeFalse();

    for (const id of ['spl-ray', 'spl-mage-hand', 'spl-prestidigitation']) {
      component.toggleCantrip(id);
    }
    fixture.detectChanges();
    expect(component.cantripsRemaining()).toBe(0);
    expect(component.selectionComplete()).toBeFalse();

    for (const id of MOCK_LEVEL1.slice(0, 6).map((s) => s.id)) {
      component.toggleSpell(id);
    }
    fixture.detectChanges();

    expect(component.spellsRemaining()).toBe(0);
    expect(component.selectionComplete()).toBeTrue();
  });

  it('filters cantrips by name only and by school select', () => {
    expect(component.filteredCantrips().length).toBe(component.availableCantrips().length);
    component.spellSearchQuery.set('ray');
    fixture.detectChanges();
    expect(component.filteredCantrips().every((s) => /ray/i.test(s.name))).toBeTrue();

    // Description / école ne doivent pas matcher via le champ texte
    const evocation = component.availableCantrips().find((s) =>
      s.school.toLowerCase().includes('evocation'),
    );
    if (evocation) {
      component.spellSearchQuery.set(evocation.school);
      fixture.detectChanges();
      expect(component.filteredCantrips().some((s) => s.id === evocation.id)).toBeFalse();
    }

    component.clearSpellFilters();
    component.spellSchoolFilter.set('evocation');
    fixture.detectChanges();
    expect(component.spellFiltersActive()).toBeTrue();
    expect(
      component.filteredCantrips().every((s) => s.school.toLowerCase().includes('evocation')),
    ).toBeTrue();
  });

  it('gates mastery (L17) and signature spells (L19) for high-level wizard', async () => {
    TestBed.resetTestingModule();
    const highCreation = signal(wizardCreation({ targetLevel: 19 }));
    const level2 = ['spl-invisibility', 'spl-misty'].map((id) => mockSpell(id, 2));
    const level3 = ['spl-fireball', 'spl-counterspell'].map((id) => mockSpell(id, 3));
    await TestBed.configureTestingModule({
      imports: [MagicStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpells: () => of([...MOCK_CANTrips, ...MOCK_LEVEL1, ...level2, ...level3]),
            getDeities: () => of([]),
            getClassById: () => of(MOCK_WIZARD_CLASS),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: builderMock(highCreation),
        },
      ],
    }).compileComponents();

    const highFixture = TestBed.createComponent(MagicStep);
    const high = highFixture.componentInstance;
    highFixture.detectChanges();

    expect(high.needsSpellMastery()).toBeTrue();
    expect(high.needsSignatureSpells()).toBeTrue();
    expect(high.masteryComplete()).toBeFalse();

    high.selectedSpells.set(
      new Set(['spl-magic-missile', 'spl-invisibility', 'spl-fireball', 'spl-counterspell']),
    );
    high.pickMastery(1, 'spl-magic-missile');
    high.pickMastery(2, 'spl-invisibility');
    high.toggleSignature('spl-fireball');
    high.toggleSignature('spl-counterspell');
    highFixture.detectChanges();

    expect(high.masteryComplete()).toBeTrue();
    expect(high.signatureComplete()).toBeTrue();

    high.toggleSpell('spl-magic-missile');
    highFixture.detectChanges();
    expect(high.masteryComplete()).toBeFalse();
    expect(high.masteryPicks()[1]).toBeUndefined();
  });

  it('respects cantrip and spell quotas when toggling', () => {
    component.toggleCantrip('spl-ray');
    component.toggleCantrip('spl-mage-hand');
    component.toggleCantrip('spl-prestidigitation');
    component.toggleCantrip('spl-light');
    fixture.detectChanges();

    expect(component.selectedCantrips().size).toBe(3);
    expect(component.isCantripSelected('spl-light')).toBeFalse();

    component.toggleCantrip('spl-ray');
    component.toggleSpell('spl-magic-missile');
    component.toggleSpell('spl-shield');
    component.toggleSpell('spl-sleep');
    component.toggleSpell('spl-burning-hands');
    component.toggleSpell('spl-charm');
    component.toggleSpell('spl-detect');
    fixture.detectChanges();

    expect(component.selectedSpells().size).toBe(6);
    expect(component.canSelectSpell('spl-magic-missile')).toBeTrue();
    expect(component.canSelectSpell('spl-light')).toBeFalse();
  });

  it('confirm() does nothing when selection is incomplete', () => {
    component.confirm();
    expect(nextStepSpy).not.toHaveBeenCalled();
  });

  it('confirm() persists spellcasting details and advances the wizard', () => {
    for (const id of ['spl-ray', 'spl-mage-hand', 'spl-prestidigitation']) {
      component.toggleCantrip(id);
    }
    for (const id of MOCK_LEVEL1.slice(0, 6).map((s) => s.id)) {
      component.toggleSpell(id);
    }
    fixture.detectChanges();

    component.confirm();
    fixture.detectChanges();

    const details = creationSignal().spellcastingDetails as { cantrips?: unknown[]; spells?: unknown[] };
    expect(details.cantrips?.length).toBe(3);
    expect(details.spells?.length).toBe(6);
    expect(nextStepSpy).toHaveBeenCalled();
  });

  it('loads both caster classes and switches tabs without losing picks', async () => {
    TestBed.resetTestingModule();
    creationSignal = signal(
      wizardCreation({
        secondaryClasses: [
          {
            classId: CLERIC_CLASS_ID,
            className: 'Prêtre',
            subclassId: 'subcls-domaine-de-la-vie',
            subclassName: 'Vie',
            level: 1,
            hitDie: 8,
            hpPerLevelAverage: 5,
            hasSpellcasting: true,
            spellcastingKind: 'cleric',
            spellcastingAbility: 'Sagesse',
            armorProficiencies: [],
            weaponProficiencies: [],
            toolProficiencies: [],
            skillChooseCount: 0,
            skillOptions: [],
            classFeatures: [],
          },
        ],
      }),
    );
    const mixedSpells = [
      ...MOCK_CANTrips,
      ...MOCK_LEVEL1,
      ...MOCK_CANTrips.map((s) => mockSpell(`${s.id}-cleric`, 0, CLERIC_CLASS_ID)),
    ];
    await TestBed.configureTestingModule({
      imports: [MagicStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpells: () => of(mixedSpells),
            getDeities: () => of(MOCK_DEITIES),
            getClassById: (id: string) =>
              of(id === CLERIC_CLASS_ID ? MOCK_CLERIC_CLASS : MOCK_WIZARD_CLASS),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: builderMock(creationSignal),
        },
      ],
    }).compileComponents();

    const mixedFixture = TestBed.createComponent(MagicStep);
    const mixed = mixedFixture.componentInstance;
    mixedFixture.detectChanges();

    expect(mixed.casterSources().length).toBe(2);
    mixed.selectCaster(-1);
    mixed.selectCaster(99);
    mixed.selectCaster(0);
    mixed.toggleCantrip('spl-ray');
    mixed.selectCaster(1);
    mixedFixture.detectChanges();
    expect(mixed.activeCaster()?.classId).toBe(CLERIC_CLASS_ID);
    expect(mixed.selectedCantrips().size).toBe(0);
    mixed.selectCaster(0);
    mixedFixture.detectChanges();
    expect(mixed.isCantripSelected('spl-ray')).toBeTrue();
  });

  it('skips spell picks when the class has no spellcasting', async () => {
    TestBed.resetTestingModule();
    creationSignal = signal(
      wizardCreation({
        classId: 'cls-guerrier',
        hasSpellcasting: false,
        spellcastingKind: null,
        spellcastingAbility: null,
      }),
    );

    await TestBed.configureTestingModule({
      imports: [MagicStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpells: () => of([...MOCK_CANTrips, ...MOCK_LEVEL1]),
            getDeities: () => of([]),
            getClassById: () => of(MOCK_WIZARD_CLASS),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: builderMock(creationSignal),
        },
      ],
    }).compileComponents();

    const noMagicFixture = TestBed.createComponent(MagicStep);
    noMagicFixture.detectChanges();
    expect(noMagicFixture.componentInstance.selectionComplete()).toBeTrue();
  });

  it('requires a deity for clerics before selection is complete', async () => {
    TestBed.resetTestingModule();
    creationSignal = signal(clericCreation());
    const clericSpells = [
      ...MOCK_CANTrips.map((s) => mockSpell(s.id, 0, CLERIC_CLASS_ID)),
      ...MOCK_LEVEL1.map((s) => mockSpell(s.id, 1, CLERIC_CLASS_ID)),
      mockSpell('spl-bless', 1, CLERIC_CLASS_ID),
    ];

    await TestBed.configureTestingModule({
      imports: [MagicStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpells: () => of(clericSpells),
            getDeities: () => of(MOCK_DEITIES),
            getClassById: () => of(MOCK_CLERIC_CLASS),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: builderMock(creationSignal),
        },
      ],
    }).compileComponents();

    const clericFixture = TestBed.createComponent(MagicStep);
    const cleric = clericFixture.componentInstance;
    clericFixture.detectChanges();

    expect(cleric.isCleric()).toBeTrue();
    for (const id of ['spl-ray', 'spl-mage-hand', 'spl-prestidigitation']) {
      cleric.toggleCantrip(id);
    }
    for (const id of ['spl-magic-missile', 'spl-shield', 'spl-sleep']) {
      cleric.toggleSpell(id);
    }
    clericFixture.detectChanges();

    expect(cleric.cantripsRemaining()).toBe(0);
    expect(cleric.spellsRemaining()).toBe(0);
    expect(cleric.selectionComplete()).toBeFalse();

    cleric.selectDeity('deity-life');
    clericFixture.detectChanges();
    expect(cleric.selectionComplete()).toBeTrue();
  });

  it('shows load error when spells fail', async () => {
    TestBed.resetTestingModule();
    const errCreation = signal(wizardCreation());
    await TestBed.configureTestingModule({
      imports: [MagicStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpells: () => throwError(() => new Error('network')),
            getDeities: () => of([]),
            getClassById: () => of(MOCK_WIZARD_CLASS),
          },
        },
        {
          provide: CharacterBuilderService,
          useValue: builderMock(errCreation),
        },
      ],
    }).compileComponents();

    const errFixture = TestBed.createComponent(MagicStep);
    errFixture.detectChanges();
    expect(errFixture.componentInstance.error()).toBe('Impossible de charger les sorts.');
  });
});
