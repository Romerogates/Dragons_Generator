import { TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CharacterBuilderService } from '@core/services/character-builder.service';
import { DataService } from '@core/services/data.service';
import { of } from 'rxjs';
import { seedLettreBuilder } from '@testing/lettre-fixtures';
import {
  formatCharacterExportErrors,
  validateCharacterExport,
} from './character-export-validation.util';
import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';

describe('character-export-validation.util', () => {
  it('accepts a complete Lettré export', () => {
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: {
            getSpecies: () => of([]),
            getClasses: () => of([]),
            getBackgrounds: () => of([]),
          },
        },
        CharacterBuilderService,
      ],
    });

    const builder = TestBed.inject(CharacterBuilderService);
    seedLettreBuilder(builder);
    const result = validateCharacterExport(builder.build());

    expect(result.valid).toBeTrue();
    expect(result.errors).toEqual([]);
  });

  it('accepts weapon category proficiencies on export', () => {
    const ok = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Guerrier',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
      totalLevel: 1,
      proficiencies: {
        weapons: ['wp-cat-simple', 'wp-cat-martial', 'wp-bouclier'],
        tools: [],
        armor: [],
        languages: [],
      },
      equipment: [{ refId: 'wp-epee-longue', name: 'Épée longue', qty: 1 }],
    } as unknown as Character;

    const result = validateCharacterExport(ok);
    expect(result.valid).toBeTrue();
  });

  it('rejects mastered-choice placeholders in proficiencies and equipment', () => {
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Tyrolienne',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [{ classId: 'cls-lettre', classLabel: 'Lettré', level: 1, hitDie: 8 }],
      totalLevel: 1,
      proficiencies: { weapons: ['wp-mastered-choice'], tools: [], armor: [], languages: [] },
      equipment: [{ refId: 'wp-dague', name: 'Dague', qty: 1 }],
    } as unknown as Character;

    const result = validateCharacterExport(broken);
    expect(result.valid).toBeFalse();
    expect(result.errors.some((e) => e.includes('wp-mastered-choice'))).toBeTrue();
  });

  it('rejects category equipment ids', () => {
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Test',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
      totalLevel: 1,
      proficiencies: { weapons: ['wp-epee-longue'], tools: [], armor: [], languages: [] },
      equipment: [{ refId: 'wp-cat-martial', name: 'Arme', qty: 1 }],
    } as unknown as Character;

    const result = validateCharacterExport(broken);
    expect(result.valid).toBeFalse();
    expect(result.errors.some((e) => e.includes('wp-cat-martial'))).toBeTrue();
  });

  it('formats multiple errors for UI', () => {
    const msg = formatCharacterExportErrors(['Nom manquant.', 'Classe manquante.']);
    expect(msg).toContain('Export incomplet');
    expect(msg).toContain('Nom manquant');
  });

  it('formatCharacterExportErrors handles the empty and single-error cases', () => {
    expect(formatCharacterExportErrors([])).toBe('');
    expect(formatCharacterExportErrors(['Seule erreur.'])).toBe('Seule erreur.');
  });

  it('reports every structural error at once (schema version, name, classes, species, level)', () => {
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION - 1,
      name: '   ',
      species: { id: '', label: '' },
      classes: [{ classId: '  ', classLabel: '', level: 1, hitDie: 8 }],
      totalLevel: 0,
      proficiencies: {
        weapons: ['wp-mastered-any-choice-not-that', 'any', 'skill-any', 'wp-epee-longue'],
        tools: ['category-outils', ''],
        armor: [],
        languages: [],
      },
      equipment: [{ refId: '   ', name: '', qty: 1 }],
    } as unknown as Character;

    const result = validateCharacterExport(broken);
    expect(result.valid).toBeFalse();
    expect(result.errors.some((e) => e.includes('schéma'))).toBeTrue();
    expect(result.errors.some((e) => e.includes('nom'))).toBeTrue();
    expect(result.errors.some((e) => e.includes('Classe sans identifiant'))).toBeTrue();
    expect(result.errors.some((e) => e.includes('Espèce manquante'))).toBeTrue();
    expect(result.errors.some((e) => e.includes('Niveau total invalide'))).toBeTrue();
    expect(result.errors.some((e) => e.includes("sans référence"))).toBeTrue();
  });

  it('accepts an empty classes array without a "classe sans identifiant" error but flags the missing class', () => {
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Test',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [],
      totalLevel: 1,
      proficiencies: { weapons: [], tools: [], armor: [], languages: [] },
      equipment: [],
    } as unknown as Character;
    const result = validateCharacterExport(broken);
    expect(result.errors).toContain('Au moins une classe est requise.');
  });
});
