import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import {
  createClericPdfCharacter,
  createMinimalCharacter,
  createRangerPdfCharacter,
  TINY_JPEG_DATA_URL,
} from '@testing/character-fixtures';

describe('PdfGeneratorService', () => {
  let service: PdfGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        PdfGeneratorService,
        {
          provide: DataService,
          useValue: {
            getSpells: () => of([]),
          },
        },
      ],
    });

    service = TestBed.inject(PdfGeneratorService);
    const internal = service as unknown as {
      loadImage: (url: string) => Promise<string>;
      loadBackgroundImages: () => Promise<string[]>;
    };
    spyOn(internal, 'loadImage').and.returnValue(Promise.resolve(TINY_JPEG_DATA_URL));
    spyOn(internal, 'loadBackgroundImages').and.returnValue(
      Promise.resolve([
        TINY_JPEG_DATA_URL,
        TINY_JPEG_DATA_URL,
        TINY_JPEG_DATA_URL,
        TINY_JPEG_DATA_URL,
      ]),
    );
  });

  it('generates a 4-page PDF for a non-caster', async () => {
    const blobUrl = await service.generatePdfBlob(createMinimalCharacter());
    expect(blobUrl).toMatch(/^blob:/);
    URL.revokeObjectURL(blobUrl);
  });

  it('generates grimoire + supp pages for a cleric with spell overflow', async () => {
    const blobUrl = await service.generatePdfBlob(createClericPdfCharacter(22));
    expect(blobUrl).toMatch(/^blob:/);
    URL.revokeObjectURL(blobUrl);
  });

  it('generates the martial grimoire layout for a ranger', async () => {
    const blobUrl = await service.generatePdfBlob(createRangerPdfCharacter());
    expect(blobUrl).toMatch(/^blob:/);
    URL.revokeObjectURL(blobUrl);
  });

  it('generates a PDF for a character with a long class/subclass label and category-wide weapon/armor proficiencies', async () => {
    // Couvre le rétrécissement auto de police (textFit) sur le nom de classe et la
    // priorisation des jetons de catégorie ("toutes les armes") sur la fiche page 2.
    const blobUrl = await service.generatePdfBlob(
      createMinimalCharacter({
        classes: [
          {
            classId: 'cls-magicien',
            classLabel: 'Magicien',
            subclassId: 'subcls-mage-de-guerre',
            subclassLabel: 'Mage de guerre en formation martiale avancée',
            level: 6,
            hitDie: 6,
          },
        ],
        totalLevel: 6,
        proficiencies: {
          armor: ['ar-medium', 'ar-light'],
          weapons: ['wp-dague', 'wp-flechette', 'wp-cat-simple', 'wp-cat-martial', 'wp-lance'],
          tools: [],
          savingThrows: ['Intelligence', 'Sagesse'],
          skills: ['Arcanes'],
          expertiseSkills: [],
          languages: ['Commun'],
          writingSystems: [],
        },
      }),
    );
    expect(blobUrl).toMatch(/^blob:/);
    URL.revokeObjectURL(blobUrl);
  });

  describe('prioritizeCategoryTokens', () => {
    let prioritize: (ids: string[]) => string[];

    beforeEach(() => {
      prioritize = (
        service as unknown as { prioritizeCategoryTokens: (ids: string[]) => string[] }
      ).prioritizeCategoryTokens.bind(service);
    });

    it('moves weapon category tokens to the front while keeping relative order', () => {
      expect(
        prioritize(['wp-dague', 'wp-flechette', 'wp-cat-simple', 'wp-cat-martial', 'wp-lance']),
      ).toEqual(['wp-cat-simple', 'wp-cat-martial', 'wp-dague', 'wp-flechette', 'wp-lance']);
    });

    it('leaves a list untouched when no category token is present', () => {
      expect(prioritize(['ar-light', 'ar-medium'])).toEqual(['ar-light', 'ar-medium']);
    });

    it('handles an empty list', () => {
      expect(prioritize([])).toEqual([]);
    });
  });
});
