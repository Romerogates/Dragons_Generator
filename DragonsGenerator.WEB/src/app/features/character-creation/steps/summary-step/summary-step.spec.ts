import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { PendingCharacterSaveService } from '@core/services/pending-character-save.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { SummaryStep } from './summary-step';

function sampleCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    cloudSynced: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: 'Aria',
    species: { id: 'spc-elfe', label: 'Elfe' },
    size: 'M',
    civilization: { id: 'civ-nordique', label: 'Nordique' },
    backgroundRef: { id: 'bg-acolyte', label: 'Acolyte' },
    privilegeRef: null,
    classes: [{ classId: 'cls-magicien', classLabel: 'Magicien', level: 1, hitDie: 6 }],
    totalLevel: 1,
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
    proficiencyBonus: 2,
    vitality: {
      hitPointsMax: 8,
      hitPointsCurrent: 8,
      hitPointsTemporary: 0,
      woundThreshold: 4,
      hitDice: [{ dieType: 6, total: 1, used: 0 }],
      fatigue: 0,
      deathSaves: { successes: 0, failures: 0 },
      inspiration: false,
    },
    defense: {
      armorClass: 12,
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
    senses: { passivePerception: 10, hasDarkvision: true, darkvisionRadius: 18 },
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      savingThrows: [],
      skills: [],
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
    spellcasting: null,
    knownSpells: [],
    ammunition: [],
    notes: '',
    personality: {
      description: '',
      sex: 'X',
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

describe('SummaryStep', () => {
  let component: SummaryStep;
  let fixture: ComponentFixture<SummaryStep>;
  let router: Router;
  let cloudSaveSpy: jasmine.Spy;
  let queueSaveSpy: jasmine.Spy;
  let resetSpy: jasmine.Spy;
  let isOnlineSignal: ReturnType<typeof signal<boolean>>;
  let isLoggedInSignal: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    cloudSaveSpy = jasmine.createSpy('save').and.returnValue(of('server-id'));
    queueSaveSpy = jasmine.createSpy('queueCharacterSave');
    resetSpy = jasmine.createSpy('reset');
    isOnlineSignal = signal(true);
    isLoggedInSignal = signal(true);

    await TestBed.configureTestingModule({
      imports: [SummaryStep],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        {
          provide: CharacterBuilderService,
          useValue: {
            build: () => sampleCharacter(),
            creation: signal({
              speciesName: 'Elfe',
              subspeciesName: 'Haut-elfe',
              className: 'Magicien',
              subclassName: 'Évocation',
            }),
            isEditMode: false,
            reset: resetSpy,
            goToStep: jasmine.createSpy('goToStep'),
            previousStep: jasmine.createSpy('previousStep'),
          },
        },
        {
          provide: PdfGeneratorService,
          useValue: {
            generatePdfBlob: () => Promise.resolve('blob:preview'),
            generatePdf: jasmine.createSpy('generatePdf'),
          },
        },
        {
          provide: CharacterCloudService,
          useValue: {
            save: cloudSaveSpy,
            list: () => of([]),
          },
        },
        {
          provide: AuthService,
          useValue: { isLoggedIn: isLoggedInSignal },
        },
        {
          provide: PendingCharacterSaveService,
          useValue: {
            stash: jasmine.createSpy('stash'),
            clear: jasmine.createSpy('clear'),
          },
        },
        {
          provide: ConnectivityService,
          useValue: { isOnline: isOnlineSignal },
        },
        {
          provide: OfflineCodexService,
          useValue: { isDownloaded: () => true },
        },
        {
          provide: OfflineSyncService,
          useValue: { queueCharacterSave: queueSaveSpy },
        },
        {
          provide: CharacterHandoffService,
          useValue: { setCurrent: jasmine.createSpy('setCurrent') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryStep);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('builds species and class labels', () => {
    expect(component.speciesLabel()).toBe('Elfe (Haut-elfe)');
    expect(component.classLabel()).toBe('Magicien — Évocation');
  });

  it('keeps the player on the step when cloud save fails', () => {
    cloudSaveSpy.and.returnValue(throwError(() => new Error('network')));
    component.saveCharacter();
    expect(queueSaveSpy).toHaveBeenCalled();
    expect(component.saveError()).toContain('sauvegarde cloud a échoué');
    expect(resetSpy).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.saving()).toBeFalse();
  });

  it('navigates to the sheet after a successful cloud save', () => {
    component.saveCharacter();
    expect(cloudSaveSpy).toHaveBeenCalled();
    expect(resetSpy).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/character-sheet']);
  });
});
