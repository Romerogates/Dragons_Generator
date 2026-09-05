import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';
import { AuthService } from '@core/services/auth.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import { PendingCharacterSaveService } from '@core/services/pending-character-save.service';
import { Characters } from './characters';

function sampleCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    cloudSynced: true,
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
        subclassId: 'sub-evoc',
        subclassLabel: 'Évocation',
        level: 3,
        hitDie: 6,
      },
    ],
    totalLevel: 3,
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
      hitPointsMax: 18,
      hitPointsCurrent: 18,
      hitPointsTemporary: 0,
      woundThreshold: 9,
      hitDice: [{ dieType: 6, total: 3, used: 0 }],
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
      savingThrows: [],
      skills: [],
      expertiseSkills: [],
      languages: [],
      writingSystems: [],
    },
    features: [],
    equipment: [],
    currency: { cuivre: 0, argent: 0, or: 0, platine: 0 },
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

describe('Characters', () => {
  let component: Characters;
  let fixture: ComponentFixture<Characters>;
  let isLoggedInSignal: ReturnType<typeof signal<boolean>>;
  let router: Router;
  let pdfGenerateSpy: jasmine.Spy;
  let cloudDeleteSpy: jasmine.Spy;
  let cloudSaveSpy: jasmine.Spy;
  let cloudLoadAllSpy: jasmine.Spy;
  let handoffSetCurrentSpy: jasmine.Spy;
  let handoffStashEditSpy: jasmine.Spy;
  let getPendingSpy: jasmine.Spy;

  beforeEach(async () => {
    isLoggedInSignal = signal(false);
    pdfGenerateSpy = jasmine.createSpy('generatePdf');
    cloudDeleteSpy = jasmine.createSpy('delete').and.returnValue(of(void 0));
    cloudSaveSpy = jasmine.createSpy('save').and.returnValue(of('char-dup'));
    cloudLoadAllSpy = jasmine.createSpy('loadAll').and.returnValue(of([]));
    handoffSetCurrentSpy = jasmine.createSpy('setCurrent');
    handoffStashEditSpy = jasmine.createSpy('stashEdit');
    getPendingSpy = jasmine.createSpy('getPendingCharacters').and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [Characters],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn: isLoggedInSignal },
        },
        {
          provide: CharacterCloudService,
          useValue: {
            lastSyncError: signal<string | null>(null),
            loadAll: cloudLoadAllSpy,
            save: cloudSaveSpy,
            delete: cloudDeleteSpy,
          },
        },
        {
          provide: PdfGeneratorService,
          useValue: { generatePdf: pdfGenerateSpy },
        },
        {
          provide: PendingCharacterSaveService,
          useValue: { flushIfPossible: () => of(void 0) },
        },
        {
          provide: OfflineSyncService,
          useValue: {
            pendingCount: signal(0),
            flushIfPossible: () => undefined,
            getPendingCharacters: getPendingSpy,
          },
        },
        {
          provide: ConnectivityService,
          useValue: { isOnline: signal(true) },
        },
        {
          provide: CharacterHandoffService,
          useValue: {
            setCurrent: handoffSetCurrentSpy,
            stashEdit: handoffStashEditSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Characters);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('clears list when not logged in', () => {
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(component.characters()).toEqual([]);
    expect(cloudLoadAllSpy).not.toHaveBeenCalled();
  });

  it('loads cloud list when logged in', () => {
    const hero = sampleCharacter();
    isLoggedInSignal.set(true);
    cloudLoadAllSpy.and.returnValue(of([hero]));
    fixture.detectChanges();
    expect(cloudLoadAllSpy).toHaveBeenCalled();
    expect(component.characters().length).toBe(1);
    expect(component.characters()[0].name).toBe('Aria');
    expect(component.loading()).toBe(false);
  });

  it('clears list on cloud load error', () => {
    isLoggedInSignal.set(true);
    cloudLoadAllSpy.and.returnValue(throwError(() => new Error('network')));
    fixture.detectChanges();
    expect(component.characters()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('sorts characters by updatedAt descending', () => {
    isLoggedInSignal.set(true);
    const older = sampleCharacter({
      id: 'old',
      name: 'Old',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = sampleCharacter({
      id: 'new',
      name: 'New',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    cloudLoadAllSpy.and.returnValue(of([older, newer]));
    fixture.detectChanges();
    expect(component.characters().map((c) => c.name)).toEqual(['New', 'Old']);
  });

  it('merges pending offline characters into the list', () => {
    const cloud = sampleCharacter({ id: 'cloud-1', name: 'Cloud' });
    const pending = sampleCharacter({
      id: 'pending-1',
      name: 'Pending',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    isLoggedInSignal.set(true);
    cloudLoadAllSpy.and.returnValue(of([cloud]));
    getPendingSpy.and.returnValue([pending]);
    fixture.detectChanges();
    expect(component.characters().map((c) => c.id)).toEqual(['pending-1', 'cloud-1']);
  });

  describe('getters (Character + legacy)', () => {
    beforeEach(() => fixture.detectChanges());

    it('reads modern Character fields', () => {
      const c = sampleCharacter();
      expect(component.getCharName(c)).toBe('Aria');
      expect(component.getCharLevel(c)).toBe(3);
      expect(component.getCharSpecies(c)).toBe('Elfe');
      expect(component.getCharClass(c)).toBe('Magicien — Évocation');
      expect(component.getCharSubclass(c)).toBe('Évocation');
      expect(component.getCharHp(c)).toBe(18);
      expect(component.getCharAc(c)).toBe(13);
    });

    it('falls back for empty / legacy shapes', () => {
      expect(component.getCharName({ ...sampleCharacter(), name: '' })).toBe('Héros Inconnu');
      expect(
        component.getCharLevel({ ...sampleCharacter(), totalLevel: 0, level: 5 } as Character & {
          level?: number;
        }),
      ).toBe(5);
      expect(
        component.getCharSpecies({
          ...sampleCharacter(),
          species: { id: '', label: '' },
        }),
      ).toBe('Espèce inconnue');
      expect(
        component.getCharSpecies({
          ...sampleCharacter(),
          species: 'Nain' as unknown as Character['species'],
        }),
      ).toBe('Nain');
      expect(
        component.getCharClass({ ...sampleCharacter(), classes: [] }),
      ).toBe('Classe inconnue');
      expect(
        component.getCharClass({
          ...sampleCharacter(),
          classes: [],
          className: 'Barbare',
        } as Character & { className?: string }),
      ).toBe('Barbare');
      expect(component.getCharSubclass({ ...sampleCharacter(), classes: [] })).toBe('');
      expect(
        component.getCharClass({
          ...sampleCharacter(),
          classes: [{ classId: 'cls-x', classLabel: '', level: 1, hitDie: 8 }],
        }),
      ).toBe('Classe inconnue');
      expect(
        component.getCharHp({
          ...sampleCharacter(),
          vitality: { ...sampleCharacter().vitality, hitPointsMax: 0 },
          hitPointsMax: 22,
        } as Character & { hitPointsMax?: number }),
      ).toBe(22);
      expect(
        component.getCharAc({
          ...sampleCharacter(),
          defense: { ...sampleCharacter().defense, armorClass: 0 },
          armorClass: 16,
        } as Character & { armorClass?: number }),
      ).toBe(16);
    });
  });

  describe('icons and date', () => {
    beforeEach(() => fixture.detectChanges());

    it('maps class and species icons', () => {
      expect(component.getClassIcon('')).toBe('fluent-emoji:crossed-swords');
      expect(component.getClassIcon('Barbare')).toBe('fluent-emoji:axe');
      expect(component.getClassIcon('Barde')).toBe('fluent-emoji:musical-note');
      expect(component.getClassIcon('Druide')).toBe('fluent-emoji:herb');
      expect(component.getClassIcon('Ensorceleur')).toBe('fluent-emoji:sparkles');
      expect(component.getClassIcon('Magicien')).toBe('fluent-emoji:crystal-ball');
      expect(component.getClassIcon('Lettré')).toBe('fluent-emoji:crystal-ball');
      expect(component.getClassIcon('Moine')).toBe('fluent-emoji:oncoming-fist');
      expect(component.getClassIcon('Paladin')).toBe('fluent-emoji:shield');
      expect(component.getClassIcon('Prêtre')).toBe('fluent-emoji:latin-cross');
      expect(component.getClassIcon('Rôdeur')).toBe('fluent-emoji:bow-and-arrow');
      expect(component.getClassIcon('Roublard')).toBe('fluent-emoji:dagger');
      expect(component.getClassIcon('Sorcier')).toBe('fluent-emoji:eye');
      expect(component.getClassIcon('Guerrier')).toBe('fluent-emoji:crossed-swords');

      expect(component.getSpeciesIcon('')).toBe('fluent-emoji:bust-in-silhouette');
      expect(component.getSpeciesIcon('Elfe')).toBe('fluent-emoji:elf');
      expect(component.getSpeciesIcon('Nain')).toBe('fluent-emoji:pick');
      expect(component.getSpeciesIcon('Halfelin')).toBe('fluent-emoji:four-leaf-clover');
      expect(component.getSpeciesIcon('Gnome')).toBe('fluent-emoji:wrench');
      expect(component.getSpeciesIcon('Drakéide')).toBe('fluent-emoji:dragon-face');
      expect(component.getSpeciesIcon('Tieffelin')).toBe('fluent-emoji:smiling-face-with-horns');
      expect(component.getSpeciesIcon('Mélancolia')).toBe('fluent-emoji:smiling-face-with-horns');
      expect(component.getSpeciesIcon('Demi-orc')).toBe('fluent-emoji:ogre');
      expect(component.getSpeciesIcon('Humain')).toBe('fluent-emoji:bust-in-silhouette');
    });

    it('formats dates and rejects invalid ones', () => {
      expect(component.formatDate('')).toBe('Récemment');
      expect(component.formatDate('not-a-date')).toBe('Récemment');
      expect(component.formatDate('2026-01-15T12:00:00.000Z')).toContain('2026');
    });
  });

  describe('actions', () => {
    beforeEach(() => fixture.detectChanges());

    it('views, edits and downloads PDF', () => {
      const c = sampleCharacter();
      const ev = new Event('click');
      spyOn(ev, 'stopPropagation');

      component.viewCharacter(c);
      expect(handoffSetCurrentSpy).toHaveBeenCalledWith(c);
      expect(router.navigate).toHaveBeenCalledWith(['/character-sheet']);

      component.editCharacter(c, ev);
      expect(ev.stopPropagation).toHaveBeenCalled();
      expect(handoffStashEditSpy).toHaveBeenCalledWith(c);
      expect(router.navigate).toHaveBeenCalledWith(['/create']);

      component.downloadPdf(c, ev);
      expect(pdfGenerateSpy).toHaveBeenCalledWith(c);
    });

    it('duplicates when logged in', () => {
      isLoggedInSignal.set(true);
      const c = sampleCharacter();
      const ev = new Event('click');
      component.characters.set([c]);
      component.duplicateCharacter(c, ev);
      expect(component.characters().length).toBe(2);
      expect(component.characters()[0].name).toBe('Aria (copie)');
      expect(cloudSaveSpy).toHaveBeenCalled();
    });

    it('confirms delete only when names match', () => {
      const c = sampleCharacter();
      const ev = new Event('click');
      expect(component.canConfirmDelete()).toBe(false);

      component.confirmDelete(c, ev);
      expect(component.characterToDelete()).toBe(c);
      expect(component.canConfirmDelete()).toBe(false);

      component.deleteConfirmName.set('Aria');
      expect(component.canConfirmDelete()).toBe(true);

      component.onDeleteConfirmNameInput({
        target: { value: ' Aria ' },
      } as unknown as Event);
      expect(component.deleteConfirmName()).toBe(' Aria ');
      expect(component.canConfirmDelete()).toBe(true);

      component.cancelDelete();
      expect(component.characterToDelete()).toBeNull();
    });

    it('deletes locally when not logged in', () => {
      const c = sampleCharacter();
      component.characters.set([c]);
      component.characterToDelete.set(c);
      component.deleteConfirmName.set('Aria');
      component.deleteCharacter();
      expect(component.characters()).toEqual([]);
      expect(cloudDeleteSpy).not.toHaveBeenCalled();
    });

    it('deletes via cloud when logged in', () => {
      isLoggedInSignal.set(true);
      const c = sampleCharacter();
      component.characters.set([c]);
      component.characterToDelete.set(c);
      component.deleteConfirmName.set('Aria');
      component.deleteCharacter();
      expect(cloudDeleteSpy).toHaveBeenCalledWith('char-1');
      expect(component.characters()).toEqual([]);
      expect(component.deleting()).toBe(false);
    });

    it('surfaces cloud delete errors', () => {
      isLoggedInSignal.set(true);
      cloudDeleteSpy.and.returnValue(throwError(() => new Error('fail')));
      const c = sampleCharacter();
      component.characters.set([c]);
      component.characterToDelete.set(c);
      component.deleteConfirmName.set('Aria');
      component.deleteCharacter();
      expect(component.deleteError()).toContain('Échec de la suppression');
      expect(component.characters().length).toBe(1);
      expect(component.deleting()).toBe(false);
    });
  });
});
