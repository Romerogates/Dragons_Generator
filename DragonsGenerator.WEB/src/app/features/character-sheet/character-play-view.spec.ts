import { ComponentFixture, TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';
import { CharacterPlayView } from './character-play-view';

function sampleCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: 'Aria',
    species: { id: 'spc-elfe', label: 'Elfe' },
    size: 'M',
    civilization: { id: 'civ-nordique', label: 'Nordique' },
    backgroundRef: { id: 'bg-acolyte', label: 'Acolyte' },
    privilegeRef: null,
    classes: [
      {
        classId: 'cls-magicien',
        classLabel: 'Magicien',
        subclassLabel: 'Évocation',
        level: 5,
        hitDie: 6,
      },
    ],
    totalLevel: 5,
    experience: 0,
    abilities: {
      force: 8,
      dexterite: 14,
      constitution: 12,
      intelligence: 16,
      sagesse: 10,
      charisme: 10,
    },
    abilityModifiers: {
      force: -1,
      dexterite: 2,
      constitution: 1,
      intelligence: 3,
      sagesse: 0,
      charisme: 0,
    },
    proficiencyBonus: 3,
    vitality: {
      hitPointsMax: 28,
      hitPointsCurrent: 22,
      hitPointsTemporary: 4,
      woundThreshold: 14,
      hitDice: [{ dieType: 6, total: 5, used: 0 }],
      fatigue: 0,
      deathSaves: { successes: 0, failures: 0 },
      inspiration: false,
    },
    defense: {
      armorClass: 13,
      armorType: 'Aucune',
      hasShield: false,
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: [],
      harmfulStates: [],
    },
    initiative: 2,
    attacks: [],
    movement: { walk: 9, climb: 4, swim: 4, jumpHeight: 3, jumpLength: 3 },
    senses: { passivePerception: 12, hasDarkvision: true, darkvisionRadius: 18 },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      savingThrows: ['Intelligence', 'Sagesse'],
      skills: ['skill-arcana'],
      expertiseSkills: [],
      languages: ['Commun'],
      writingSystems: [],
    },
    features: [],
    equipment: [],
    currency: { cuivre: 0, argent: 0, or: 10, platine: 0 },
    carryCapacity: {
      currentKg: 0,
      maxKg: 60,
      encumberedAtKg: 40,
      heavilyEncumberedAtKg: 50,
      status: 'normal',
    },
    spellcasting: {
      kind: 'wizard',
      ability: 'Intelligence',
      spellSaveDC: 14,
      spellAttackBonus: 6,
      focus: null,
      spellSlots: [
        { level: 1, max: 4, used: 1 },
        { level: 2, max: 2, used: 0 },
      ],
      cantrips: { max: 4, used: 0 },
      arcaneTradition: 'Évocation',
      spellMastery: [],
      signatureSpells: [],
    },
    knownSpells: [
      { refId: 'spl-light', name: 'Lumière', level: 0, prepared: true },
      { refId: 'spl-shield', name: 'Bouclier', level: 1, prepared: true },
      { refId: 'spl-sleep', name: 'Sommeil', level: 1, prepared: false },
    ],
    classResources: {
      arcane_points: 0,
      cantrips_known: 4,
      spells_known: 6,
      rage: 2,
    },
    ammunition: [],
    notes: '',
    personality: {
      description: '',
      sex: 'F',
      background: '',
      story: '',
      awakened: false,
      ideal: '',
      traits: '',
      alignment: '',
      bonds: '',
      flaws: '',
      handicap: '',
      madness: '',
      corruption: { stage1: 0, stage2: 0, stage3: 0, stage4: 0 },
      backgroundId: null,
    },
    ...overrides,
  };
}

describe('CharacterPlayView', () => {
  let component: CharacterPlayView;
  let fixture: ComponentFixture<CharacterPlayView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterPlayView],
      providers: [...zonelessTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterPlayView);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('character', sampleCharacter());
    fixture.detectChanges();
  });

  it('formats class line with subclass and level', () => {
    expect(component.classLine()).toBe('Magicien — Évocation (niv. 5)');
  });

  it('hides spellcasting duplicate resources when spellcasting is present', () => {
    const keys = component.resourceChips().map((r) => r.key);
    expect(keys).toContain('rage');
    expect(keys).not.toContain('cantrips_known');
    expect(keys).not.toContain('spells_known');
  });

  it('keeps spellcasting resource keys when there is no spellcasting block', () => {
    fixture.componentRef.setInput(
      'character',
      sampleCharacter({
        spellcasting: null,
        knownSpells: [],
        classResources: { cantrips_known: 3, rage: 2 },
      }),
    );
    fixture.detectChanges();
    const keys = component.resourceChips().map((r) => r.key);
    expect(keys).toContain('cantrips_known');
    expect(keys).toContain('rage');
  });

  it('groups spells by level and counts prepared leveled spells', () => {
    expect(component.spellsByLevel().map((g) => g.title)).toEqual([
      'Tours de magie',
      'Sorts de niveau 1',
    ]);
    expect(component.preparedSpellCount()).toBe(1);
  });

  it('computes remaining spell slots', () => {
    expect(component.slotRemaining(4, 1)).toBe(3);
    expect(component.slotRemaining(2, 5)).toBe(0);
  });

  it('marks saving throw abilities', () => {
    expect(component.isSave('intelligence')).toBeTrue();
    expect(component.isSave('force')).toBeFalse();
  });

  it('links spells and skills to Codex pages in a new tab', () => {
    const root = fixture.nativeElement as HTMLElement;
    const spellLink = root.querySelector('a[href="/spells/spl-shield"]') as HTMLAnchorElement | null;
    expect(spellLink).toBeTruthy();
    expect(spellLink!.textContent?.trim()).toBe('Bouclier');
    expect(spellLink!.target).toBe('_blank');
    expect(spellLink!.rel).toContain('noopener');

    const skillLink = root.querySelector(
      'a[href="/skills/skill-arcana"]',
    ) as HTMLAnchorElement | null;
    expect(skillLink).toBeTruthy();
    expect(skillLink!.target).toBe('_blank');
  });
});
