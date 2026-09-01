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
});
