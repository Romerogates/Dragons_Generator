import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { emptyCampaignData, type CampaignDetail } from '@core/models/Campaign/campaign';
import { CampaignHubNavService } from './campaign-hub-nav.service';

function campaign(over: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 'c1',
    title: 'Hub',
    role: 'dm',
    isOwner: true,
    updatedAt: '',
    members: [],
    data: emptyCampaignData(),
    ...over,
  };
}

describe('CampaignHubNavService', () => {
  let svc: CampaignHubNavService;
  let navigate: jasmine.Spy;
  let current: CampaignDetail | null;
  let flushed = 0;
  let activity = 0;
  let handouts = 0;
  let notebook = 0;
  const query = new Map<string, string>();

  beforeEach(() => {
    current = campaign();
    flushed = 0;
    activity = 0;
    handouts = 0;
    notebook = 0;
    query.clear();
    query.set('tab', 'overview');
    navigate = jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignHubNavService,
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (k: string) => query.get(k) ?? null } },
          },
        },
      ],
    });
    svc = TestBed.inject(CampaignHubNavService);
    svc.configure({
      campaign: () => current,
      flushMaps: () => {
        flushed += 1;
      },
      loadActivity: () => {
        activity += 1;
      },
      onHandoutsOpened: () => {
        handouts += 1;
      },
      ensureNotebook: () => {
        notebook += 1;
      },
    });
  });

  it('ouvre Documents et charge le pack MJ', () => {
    svc.setTab('handouts');
    expect(svc.tab()).toBe('handouts');
    expect(handouts).toBe(1);
    expect(navigate).toHaveBeenCalled();
  });

  it('bloque Préparation joueur sans pré-tirés', () => {
    current = campaign({ isOwner: false, role: 'player' });
    svc.setTab('prep');
    expect(svc.tab()).toBe('overview');
  });

  it('applique un deep-link carte et un mapsAction', () => {
    svc.applyDeepLink('overview', null, 'map-1');
    expect(svc.tab()).toBe('prep');
    expect(svc.prepSub()).toBe('maps');
    expect(svc.focusDungeonMapId()).toBe('map-1');
    svc.applyDeepLink('prep', null, null, null, null, 'import');
    expect(svc.mapsAutoAction()).toBe('import');
  });

  it('clampAfterLoad ramène le joueur hors des sous-onglets MJ', () => {
    svc.tab.set('prep');
    svc.prepSub.set('creatures');
    svc.clampAfterLoad(false, 2);
    expect(svc.tab()).toBe('prep');
    expect(svc.prepSub()).toBe('pregens');
  });

  it('ouvre le carnet et flush la carte en quittant les maps', () => {
    svc.setTab('maps');
    expect(svc.isOnMapsView()).toBeTrue();
    svc.setPrepSub('notebook');
    expect(flushed).toBeGreaterThan(0);
    expect(notebook).toBe(1);
    expect(svc.prepSub()).toBe('notebook');
  });

  it('applique session, event, prep, activity et primary', () => {
    svc.applyDeepLink('overview', null, null, 'sess-1');
    expect(svc.tab()).toBe('sessions');
    expect(svc.editingSessionId()).toBe('sess-1');
    svc.applyDeepLink('overview', null, null, null, 'ev-1');
    expect(svc.tab()).toBe('calendar');
    expect(svc.focusScheduleEventId()).toBe('ev-1');
    svc.applyDeepLink('prep', null, null, null, null, null, 'creatures');
    expect(svc.tab()).toBe('prep');
    expect(svc.prepSub()).toBe('creatures');
    svc.applyDeepLink('activity', null);
    expect(svc.tab()).toBe('overview');
    expect(activity).toBeGreaterThan(0);
    svc.applyDeepLink('handouts', 'h9');
    expect(svc.tab()).toBe('handouts');
    expect(svc.focusHandoutId()).toBe('h9');
    svc.applyDeepLink('encounters', null);
    expect(svc.tab()).toBe('prep');
    expect(svc.prepSub()).toBe('encounters');
    svc.applyDeepLink('nope', null);
    expect(svc.tab()).toBe('prep');
  });

  it('setTab activity charge le fil et clampAfterLoad MJ laisse tel quel', () => {
    svc.setTab('activity');
    expect(svc.tab()).toBe('overview');
    svc.tab.set('prep');
    svc.prepSub.set('maps');
    svc.clampAfterLoad(true, 0);
    expect(svc.tab()).toBe('prep');
    expect(svc.prepSub()).toBe('maps');
  });
});
