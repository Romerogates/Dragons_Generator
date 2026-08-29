import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { OfflineSyncService } from './offline-sync.service';
import { AuthService } from './auth.service';
import { ConnectivityService } from './connectivity.service';
import { CharacterCloudService } from './character-cloud.service';
import { CampaignCloudService } from './campaign-cloud.service';

describe('OfflineSyncService', () => {
  let service: OfflineSyncService;
  let saveSpy: jasmine.Spy;

  beforeEach(() => {
    saveSpy = jasmine.createSpy('save').and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Données invalides' } })));

    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        OfflineSyncService,
        { provide: AuthService, useValue: { isLoggedIn: () => true } },
        { provide: ConnectivityService, useValue: { isOnline: () => true } },
        { provide: CharacterCloudService, useValue: { save: saveSpy } },
        { provide: CampaignCloudService, useValue: { create: () => of({}), update: () => of({}) } },
      ],
    });

    service = TestBed.inject(OfflineSyncService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('keeps failed queue items instead of dropping them on client errors', (done) => {
    const character = {
      id: 'local-1',
      name: 'Testeur',
      cloudSynced: false,
    } as any;

    service.queueCharacterSave(character);
    expect(service.pendingCount()).toBe(1);

    service.flushIfPossible();

    setTimeout(() => {
      expect(saveSpy).toHaveBeenCalled();
      expect(service.pendingCount()).toBe(1);
      expect(service.lastSyncError()).toContain('Testeur');
      expect(service.lastSyncError()).toContain('conservé');
      done();
    }, 50);
  });
});
