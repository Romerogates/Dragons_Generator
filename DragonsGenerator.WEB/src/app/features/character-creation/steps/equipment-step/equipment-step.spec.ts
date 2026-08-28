import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { DataService } from '@core/services/data.service';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import type { Equipment } from '@core/models/Equipments/equipment';
import { EquipmentStep } from './equipment-step';

function mockEquipment(
  id: string,
  name: string,
  type: string,
  subtype: string | null,
  data: Record<string, unknown> = {},
): Equipment {
  return {
    id,
    name,
    type: type as Equipment['type'],
    subtype: subtype as Equipment['subtype'],
    cost: { v: 1, u: 'po' },
    wKg: 1,
    data: data as unknown as Equipment['data'],
  };
}

const MOCK_CATALOG: Equipment[] = [
  mockEquipment('ar-armure-de-cuir', 'Armure de cuir', 'armor', 'light', { ac: 11 }),
  mockEquipment('wp-dague', 'Dague', 'weapon', 'simple_melee', {
    damage_dice: '1d4',
    damage_type: 'perforant',
    properties: ['prop-finesse'],
  }),
  mockEquipment('wp-baton-de-combat', 'Bâton de combat', 'weapon', 'simple_melee', {
    damage_dice: '1d6',
    damage_type: 'contondant',
  }),
  mockEquipment('tl-lyre', 'Lyre', 'tool', 'musical_instrument'),
  mockEquipment('tl-des', 'Dés', 'tool', 'gaming_set'),
  mockEquipment('tl-necessaire-dherboristerie', "Nécessaire d'herboristerie", 'tool', 'artisan_tools'),
  mockEquipment('gr-sac-derudit', "Sac d'érudit", 'gear', null),
  mockEquipment('gr-sac-daventurier', "Sac d'aventurier", 'gear', null),
  mockEquipment('gr-livre-de-prieres', 'Livre de prières', 'gear', null),
  mockEquipment('gr-moulin-a-prieres', 'Moulin à prières', 'gear', null),
  mockEquipment('it-carreaux', 'Carreaux (20)', 'gear', null),
  mockEquipment('it-sacoche-a-composantes', 'Sacoche à composantes', 'gear', null),
  mockEquipment('wp-arbalete-legere', 'Arbalète légère', 'weapon', 'simple_ranged', {
    damage_dice: '1d8',
    damage_type: 'perforant',
  }),
];

const LETTRE_SLOTS = [
  { slot: 1, fixed: [{ id: 'ar-armure-de-cuir', qty: 1 }] },
  {
    slot: 2,
    description: 'Équipement (slot 2)',
    alternatives: [
      [{ id: 'tl-mastered-choice', qty: 1 }],
      [{ id: 'wp-mastered-choice', qty: 1 }],
    ],
  },
  {
    slot: 3,
    alternatives: [
      [{ id: 'gr-sac-derudit', qty: 1 }],
      [{ id: 'gr-sac-daventurier', qty: 1 }],
    ],
  },
];

function lettreCreation(overrides: Record<string, unknown> = {}) {
  return {
    className: 'Lettré',
    weaponProficiencies: ['wp-dague', 'wp-baton-de-combat'],
    toolProficiencies: ['tl-lyre', 'tl-des'],
    backgroundTools: [] as string[],
    startingEquipmentSlots: LETTRE_SLOTS,
    backgroundEquipmentSlots: [],
    ...overrides,
  };
}

describe('EquipmentStep', () => {
  let component: EquipmentStep;
  let fixture: ComponentFixture<EquipmentStep>;
  let creationSignal: ReturnType<typeof signal<ReturnType<typeof lettreCreation>>>;
  let setEquipmentSpy: jasmine.Spy;
  let nextStepSpy: jasmine.Spy;

  beforeEach(async () => {
    creationSignal = signal(lettreCreation());
    setEquipmentSpy = jasmine.createSpy('setEquipment');
    nextStepSpy = jasmine.createSpy('nextStep');

    await TestBed.configureTestingModule({
      imports: [EquipmentStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: { getEquipments: () => of(MOCK_CATALOG) },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: creationSignal,
            setEquipment: setEquipmentSpy,
            nextStep: nextStepSpy,
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EquipmentStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function expectCatalogLoaded(): void {
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.catalog().length).toBe(MOCK_CATALOG.length);
  }

  it('loads equipment catalog on init', () => {
    expectCatalogLoaded();
    expect(component.resolvedSlots().length).toBe(3);
  });

  it('resolves fixed Lettré slot 1 as concrete armor', () => {
    expectCatalogLoaded();
    const slot1 = component.resolvedSlots()[0];
    expect(slot1.isFixed).toBeTrue();
    expect(slot1.fixedItems[0].isCategory).toBeFalse();
    expect(slot1.fixedItems[0].equipment?.name).toBe('Armure de cuir');
  });

  it('resolves wp-mastered-choice from weapon proficiencies, not as generic object', () => {
    expectCatalogLoaded();
    component.activeSlotIndex.set(1);
    component.selectAlternative(1);
    fixture.detectChanges();

    const slot2 = component.resolvedSlots()[1];
    const mastered = slot2.alternatives[1].items[0];
    expect(mastered.isCategory).toBeTrue();
    expect(mastered.categoryLabel).toBe('Arme maîtrisée (au choix)');
    expect(component.itemName(mastered)).toBe('Arme maîtrisée (au choix)');
    expect(mastered.categoryItems.map((e) => e.id)).toEqual(['wp-baton-de-combat', 'wp-dague']);
    expect(component.getIconForItem(mastered)).toBe('fluent-emoji:crossed-swords');
  });

  it('resolves tl-mastered-choice from tool and background tool proficiencies', () => {
    creationSignal.set(
      lettreCreation({ backgroundTools: ['tl-necessaire-dherboristerie'] }),
    );
    fixture.detectChanges();

    component.activeSlotIndex.set(1);
    component.selectAlternative(0);
    fixture.detectChanges();

    const mastered = component.resolvedSlots()[1].alternatives[0].items[0];
    expect(mastered.categoryLabel).toBe('Outil maîtrisé (au choix)');
    expect(mastered.categoryItems.map((e) => e.id)).toEqual([
      'tl-des',
      'tl-lyre',
      'tl-necessaire-dherboristerie',
    ]);
    expect(component.getIconForItem(mastered)).toBe('fluent-emoji:hammer-and-wrench');
  });

  it('tracks selectionComplete until alternatives and category picks are done', () => {
    expectCatalogLoaded();
    expect(component.selectionComplete()).toBeFalse();

    component.activeSlotIndex.set(1);
    component.selectAlternative(1);
    fixture.detectChanges();
    expect(component.selectionComplete()).toBeFalse();

    component.selectFromCategory(0, 'wp-dague');
    component.activeSlotIndex.set(2);
    fixture.detectChanges();
    expect(component.selectionComplete()).toBeFalse();

    component.selectAlternative(0);
    fixture.detectChanges();
    expect(component.selectionComplete()).toBeTrue();
  });

  it('confirm builds weapon, armor and gear instances for Lettré choices', () => {
    expectCatalogLoaded();

    component.activeSlotIndex.set(1);
    component.selectAlternative(1);
    component.selectFromCategory(0, 'wp-dague');
    component.activeSlotIndex.set(2);
    component.selectAlternative(0);
    fixture.detectChanges();

    component.confirm();

    expect(setEquipmentSpy).toHaveBeenCalledTimes(1);
    expect(nextStepSpy).toHaveBeenCalledTimes(1);

    const items = setEquipmentSpy.calls.mostRecent().args[0];
    expect(items.length).toBe(3);
    expect(items.map((i: { refId: string }) => i.refId)).toEqual([
      'ar-armure-de-cuir',
      'wp-dague',
      'gr-sac-derudit',
    ]);

    const dague = items.find((i: { refId: string }) => i.refId === 'wp-dague');
    expect(dague.equipped).toBeFalse();
    expect(dague.location).toBe('at_hand');
    expect(dague.customData?.['isWeapon']).toBeTrue();
    expect(dague.customData?.['damage']).toBe('1d4');

    const armor = items.find((i: { refId: string }) => i.refId === 'ar-armure-de-cuir');
    expect(armor.equipped).toBeTrue();
    expect(armor.location).toBe('equipped');
    expect(armor.customData?.['isArmor']).toBeTrue();
  });

  it('isAlreadyPicked prevents choosing the same mastered item twice', () => {
    expectCatalogLoaded();
    component.activeSlotIndex.set(1);
    component.selectAlternative(1);
    component.pickedCategory.update((m) => new Map(m).set('2-1-0', 'wp-dague'));
    fixture.detectChanges();

    expect(component.isAlreadyPicked(2, 1, 0, 'wp-dague')).toBeFalse();
    expect(component.isAlreadyPicked(2, 1, 0, 'wp-baton-de-combat')).toBeFalse();

    component.pickedCategory.update((m) => new Map(m).set('3-0-0', 'wp-dague'));
    expect(component.isAlreadyPicked(3, 0, 0, 'wp-dague')).toBeTrue();
    expect(component.isAlreadyPicked(3, 0, 0, 'wp-baton-de-combat')).toBeFalse();
  });

  it('clears category picks when changing alternative on a slot', () => {
    expectCatalogLoaded();
    component.activeSlotIndex.set(1);
    component.selectAlternative(1);
    component.pickedCategory.update((m) => new Map(m).set('2-1-0', 'wp-dague'));
    component.selectAlternative(0);
    fixture.detectChanges();

    expect(component.pickedCategory().has('2-1-0')).toBeFalse();
    expect(component.pickedAlt().get(2)).toBe(0);
  });

  it('selectFromFixedCategory resolves fixed category slots', () => {
    creationSignal.set({
      ...lettreCreation(),
      startingEquipmentSlots: [
        {
          slot: 1,
          fixed: [{ id: 'category-simple-weapons', qty: 1 }],
        },
      ],
    });
    fixture.detectChanges();

    component.selectFromFixedCategory(1, 0, 'wp-dague');
    expect(component.pickedCategory().get('1-fixed-0')).toBe('wp-dague');
    expect(component.selectionComplete()).toBeTrue();
  });

  it('resolves acolyte background prayer item alternatives by catalog name', () => {
    creationSignal.set(
      lettreCreation({
        startingEquipmentSlots: [],
        backgroundEquipmentSlots: [
          {
            slot: 100,
            description: 'Livre de prières ou moulin à prières',
            alternatives: [
              [{ id: 'gr-livre-de-prieres', qty: 1 }],
              [{ id: 'gr-moulin-a-prieres', qty: 1 }],
            ],
          },
        ],
      }),
    );
    fixture.detectChanges();

    const slot = component.resolvedSlots()[0];
    expect(slot.alternatives[0].items[0].equipment?.name).toBe('Livre de prières');
    expect(slot.alternatives[1].items[0].equipment?.name).toBe('Moulin à prières');
    expect(component.itemName(slot.alternatives[1].items[0])).toBe('Moulin à prières');
  });

  it('resolves ensorceleur starting equipment refs by catalog name', () => {
    creationSignal.set(
      lettreCreation({
        className: 'Ensorceleur',
        startingEquipmentSlots: [
          {
            slot: 2,
            description: 'Arme à distance ou arme courante au choix',
            alternatives: [
              [
                { id: 'wp-arbalete-legere', qty: 1 },
                { id: 'gr-carreau', qty: 20 },
              ],
              [{ id: 'category-arme-courante', qty: 1 }],
            ],
          },
          {
            slot: 3,
            description: 'Focaliseur arcanique ou sacoche à composantes',
            alternatives: [
              [{ id: 'tl-sacoche-a-composantes', qty: 1 }],
              [{ id: 'tl-focaliseur-arcanique', qty: 1 }],
            ],
          },
        ],
      }),
    );
    fixture.detectChanges();

    const weaponSlot = component.resolvedSlots()[0];
    expect(component.itemName(weaponSlot.alternatives[0].items[0])).toBe('Arbalète légère');
    expect(component.itemName(weaponSlot.alternatives[0].items[1])).toBe('Carreaux (20)');

    const focusSlot = component.resolvedSlots()[1];
    expect(component.itemName(focusSlot.alternatives[0].items[0])).toBe('Sacoche à composantes');
    expect(component.itemName(focusSlot.alternatives[1].items[0])).toBe('Focaliseur arcanique');
  });

  it('shows load error when catalog request fails', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EquipmentStep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: { getEquipments: () => throwError(() => new Error('network')) },
        },
        {
          provide: CharacterBuilderService,
          useValue: {
            creation: signal(lettreCreation()),
            setEquipment: jasmine.createSpy(),
            nextStep: jasmine.createSpy(),
            previousStep: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();

    const errFixture = TestBed.createComponent(EquipmentStep);
    errFixture.detectChanges();

    expect(errFixture.componentInstance.loading()).toBeFalse();
    expect(errFixture.componentInstance.error()).toBe('Erreur de chargement du catalogue.');
  });
});
