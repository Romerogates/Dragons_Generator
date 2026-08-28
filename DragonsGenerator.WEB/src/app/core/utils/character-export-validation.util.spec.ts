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
});
