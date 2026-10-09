import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { AuthService } from '@core/services/auth.service';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { DataService } from '@core/services/data.service';
import { FriendsService } from '@core/services/friends.service';
import { UiBannerPreferencesService } from '@core/services/ui-banner-preferences.service';
import { CampaignHubBootService } from './campaign-hub-boot.service';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubSyncService } from './campaign-hub-sync.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubPdfService } from './campaign-hub-pdf.service';

describe('CampaignHubBootService', () => {
  let svc: CampaignHubBootService;
  let applyDeepLink: jasmine.Spy;
  let reload: jasmine.Spy;

  beforeEach(() => {
    applyDeepLink = jasmine.createSpy('applyDeepLink');
    reload = jasmine.createSpy('reload');
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignHubBootService,
        { provide: CampaignHubStore, useValue: { loading: { set: () => undefined }, campaign: () => null, destroy: () => undefined, initiativeBoard: { set: () => undefined } } },
        { provide: CampaignHubSyncService, useValue: { reload, startFallbackPoll: () => undefined, softReload: () => undefined, refreshInitiativeBoard: () => undefined } },
        { provide: CampaignHubNavService, useValue: { applyDeepLink, clampAfterLoad: () => undefined } },
        { provide: CampaignHubPdfService, useValue: { destroy: () => undefined } },
        { provide: AuthService, useValue: { isLoggedIn: () => true } },
        { provide: CampaignLiveService, useValue: { connected: () => true, fallbackPollMs: () => 8000 } },
        { provide: FriendsService, useValue: { listFriends: () => of([]) } },
        { provide: CharacterCloudService, useValue: { list: () => of([]) } },
        { provide: DataService, useValue: { getCreaturesSummary: () => of([]) } },
        { provide: UiBannerPreferencesService, useValue: { dismiss: () => undefined } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (k: string) => (k === 'id' ? 'c1' : null) },
              queryParamMap: { get: () => null },
            },
            queryParamMap: of({ get: () => null }),
          },
        },
      ],
    });
    svc = TestBed.inject(CampaignHubBootService);
  });

  it('ouvre et ferme une confirmation', () => {
    let ran = false;
    svc.askConfirm('T', 'B', () => {
      ran = true;
    });
    expect(svc.confirmDialog()?.title).toBe('T');
    svc.runConfirmDialog();
    expect(ran).toBeTrue();
    expect(svc.confirmDialog()).toBeNull();
  });

  it('charge la campagne au start', () => {
    svc.start();
    expect(reload).toHaveBeenCalledWith('c1');
  });
});
