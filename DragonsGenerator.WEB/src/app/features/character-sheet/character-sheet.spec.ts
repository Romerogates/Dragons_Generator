import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { NotificationService } from '@core/services/notification.service';
import { CharacterSheet } from './character-sheet';

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
      hitPointsTemporary: 0,
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
    senses: { passivePerception: 13, hasDarkvision: true, darkvisionRadius: 18 },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      savingThrows: ['Intelligence', 'Sagesse'],
      skills: ['skill-arcanes'],
      expertiseSkills: [],
      languages: ['Commun'],
      writingSystems: [],
    },
    features: [],
    equipment: [],
    currency: { cuivre: 0, argent: 0, or: 10, platine: 0 },
    knownSpells: [],
    spellcasting: null,
    personality: { alignment: 'NB', traits: '', ideals: '', bonds: '', flaws: '', appearance: '', backstory: '' },
    notes: '',
    ...overrides,
  } as Character;
}

describe('CharacterSheet', () => {
  let fixture: ComponentFixture<CharacterSheet>;
  let component: CharacterSheet;
  let handoff: jasmine.SpyObj<CharacterHandoffService>;
  let pdf: jasmine.SpyObj<PdfGeneratorService>;

  beforeEach(async () => {
    handoff = jasmine.createSpyObj('CharacterHandoffService', [
      'peekCurrent',
      'peekMode',
      'peekSourceLabel',
      'peekReturnUrl',
      'peekProposalReview',
      'setCurrent',
      'clearCurrent',
    ]);
    pdf = jasmine.createSpyObj('PdfGeneratorService', ['generatePdfBlob', 'downloadPdf']);
    handoff.peekMode.and.returnValue('own');
    handoff.peekSourceLabel.and.returnValue(null);
    handoff.peekReturnUrl.and.returnValue(null);
    handoff.peekProposalReview.and.returnValue(null);
    pdf.generatePdfBlob.and.resolveTo('blob:mock');

    await TestBed.configureTestingModule({
      imports: [CharacterSheet],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: CharacterHandoffService, useValue: handoff },
        { provide: PdfGeneratorService, useValue: pdf },
        { provide: CharacterCloudService, useValue: { get: () => of(null), update: () => of(null) } },
        { provide: CampaignCloudService, useValue: {} },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterSheet);
    component = fixture.componentInstance;
  });

  it('shows empty handoff error', async () => {
    handoff.peekCurrent.and.returnValue(null);
    await component.ngOnInit();
    expect(component.error()).toBe('Aucun personnage sélectionné.');
    expect(component.loading()).toBeFalse();
  });

  it('loads consult mode without forcing illustrated view', async () => {
    handoff.peekCurrent.and.returnValue(sampleCharacter());
    handoff.peekMode.and.returnValue('consult');
    component.setViewMode('ui');
    await component.ngOnInit();
    expect(component.isConsult()).toBeTrue();
    expect(component.viewMode()).toBe('ui');
    expect(component.compactEditable()).toBeFalse();
  });

  it('falls back to JPEG overlay when PDF generation fails in illustrated mode', async () => {
    handoff.peekCurrent.and.returnValue(sampleCharacter());
    pdf.generatePdfBlob.and.rejectWith(new Error('pdf fail'));
    component.setViewMode('illustrated');
    await component.ngOnInit();
    expect(component.pdfFailed()).toBeTrue();
    expect(component.viewMode()).toBe('illustrated');
  });
});
