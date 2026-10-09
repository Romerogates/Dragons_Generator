import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { emptyCampaignData, type CampaignDetail } from '@core/models/Campaign/campaign';
import { CampaignHubPrepService } from './campaign-hub-prep.service';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubContentService } from './campaign-hub-content.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubSheetsService } from './campaign-hub-sheets.service';
import { CampaignHubPdfService } from './campaign-hub-pdf.service';
import { CampaignHubBootService } from './campaign-hub-boot.service';

describe('CampaignHubPrepService', () => {
  let svc: CampaignHubPrepService;
  const campaign = signal<CampaignDetail | null>({
    id: 'c1',
    title: 'Hub',
    role: 'dm',
    isOwner: true,
    updatedAt: '',
    members: [],
    data: emptyCampaignData(),
  });
  let saveData: jasmine.Spy;

  beforeEach(() => {
    saveData = jasmine.createSpy('saveData');
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignHubPrepService,
        {
          provide: CampaignHubStore,
          useValue: {
            campaign,
            saveData,
            saveTitle: () => undefined,
          },
        },
        {
          provide: CampaignHubContentService,
          useValue: {
            canAddPregen: () => true,
            pregenCapMessage: () => 'cap',
            pregenCapLabel: () => '10',
          },
        },
        { provide: CampaignHubNavService, useValue: { setTab: () => undefined, focusDungeonMapId: signal(null) } },
        { provide: CampaignHubSheetsService, useValue: { myAssignedPregens: () => [], readyPregensForPlayers: () => [] } },
        { provide: CampaignHubPdfService, useValue: { openBestiaryFullscreen: () => undefined } },
        { provide: CampaignHubBootService, useValue: { creatureXpMap: () => ({}), askConfirm: () => undefined, flushMaps: () => undefined, reload: () => undefined } },
        { provide: StoryBuilderService, useValue: { loadCampaignIntoBuilder: () => undefined } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });
    svc = TestBed.inject(CampaignHubPrepService);
  });

  it('expose le plafond pré-tirés du store', () => {
    expect(svc.canAddPregen()).toBeTrue();
    expect(svc.pregenCapLabel()).toBe('10');
  });

  it('liste les options de cartes vides', () => {
    expect(svc.dungeonMapOptions()).toEqual([]);
  });
});
