import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { DungeonCloudService } from '@core/services/dungeon-cloud.service';
import { DungeonGalleryPage } from './dungeon-gallery';

describe('DungeonGalleryPage', () => {
  let fixture: ComponentFixture<DungeonGalleryPage>;
  let cloud: jasmine.SpyObj<DungeonCloudService>;

  beforeEach(async () => {
    cloud = jasmine.createSpyObj('DungeonCloudService', ['listGallery']);
    cloud.listGallery.and.returnValue(
      of([
        {
          token: 'tok-1',
          name: 'Donjon test',
          ownerDisplayName: 'MJ',
          updatedAt: '2026-09-27T10:00:00.000Z',
        },
      ]),
    );

    await TestBed.configureTestingModule({
      imports: [DungeonGalleryPage],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        { provide: DungeonCloudService, useValue: cloud },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DungeonGalleryPage);
  });

  it('loads gallery items', () => {
    fixture.detectChanges();
    expect(cloud.listGallery).toHaveBeenCalled();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Galerie de donjons');
    expect(el.textContent).toContain('Donjon test');
    expect(el.textContent).toContain('Voir / copier');
  });

  it('shows empty state', () => {
    cloud.listGallery.and.returnValue(of([]));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Aucun donjon public');
  });

  it('shows error state', () => {
    cloud.listGallery.and.returnValue(throwError(() => new Error('fail')));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Impossible de charger la galerie',
    );
  });
});
