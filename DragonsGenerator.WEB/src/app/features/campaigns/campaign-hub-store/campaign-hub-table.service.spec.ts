import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { emptyCampaignData, type CampaignDetail } from '@core/models/Campaign/campaign';
import { CampaignHubTableService } from './campaign-hub-table.service';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubMembersService } from './campaign-hub-members.service';
import { CampaignHubSyncService } from './campaign-hub-sync.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubPdfService } from './campaign-hub-pdf.service';
import { CampaignHubBootService } from './campaign-hub-boot.service';

describe('CampaignHubTableService', () => {
  let svc: CampaignHubTableService;
  const campaign = signal<CampaignDetail | null>({
    id: 'c1',
    title: 'Hub',
    role: 'dm',
    isOwner: true,
    updatedAt: '',
    members: [],
    data: emptyCampaignData(),
  });
  let addBlankSession: jasmine.Spy;
  let setTab: jasmine.Spy;

  beforeEach(() => {
    addBlankSession = jasmine.createSpy('addBlankSession').and.returnValue({ id: 's1', title: 'S', scheduledAt: '', status: 'planned' });
    setTab = jasmine.createSpy('setTab');
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignHubTableService,
        {
          provide: CampaignHubStore,
          useValue: {
            campaign,
            addBlankSession,
            addBlankHandout: () => ({ id: 'h1' }),
            flushHandoutSave: () => undefined,
            flushSessionSave: () => undefined,
            saveData: () => undefined,
          },
        },
        {
          provide: CampaignHubNavService,
          useValue: { setTab, editingSessionId: signal<string | null>(null), focusHandoutId: signal(null), focusDungeonMapId: signal(null) },
        },
        { provide: CampaignHubMembersService, useValue: { applyScheduleRsvp: () => undefined, convertScheduleEventToSession: () => null } },
        { provide: CampaignHubSyncService, useValue: { loadActivity: () => undefined } },
        { provide: CampaignHubPdfService, useValue: {} },
        { provide: CampaignHubBootService, useValue: { askConfirm: () => undefined, flushMaps: () => undefined } },
        { provide: CampaignSessionDockService, useValue: { bindCampaign: () => undefined, open: () => undefined, close: () => undefined } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });
    svc = TestBed.inject(CampaignHubTableService);
  });

  it('crée une session et ouvre l’éditeur', () => {
    svc.addSession();
    expect(addBlankSession).toHaveBeenCalled();
    expect(setTab).toHaveBeenCalledWith('sessions');
  });

  it('filtre les documents', () => {
    svc.setHandoutKindFilter('map');
    expect(svc.handoutKindFilter()).toBe('map');
  });
});
