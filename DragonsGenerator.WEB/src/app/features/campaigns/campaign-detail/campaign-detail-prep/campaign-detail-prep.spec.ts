import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { campaignPrepSubTabs } from '@core/utils/campaign-detail-tabs.util';
import { UiBannerPreferencesService } from '@core/services/ui-banner-preferences.service';
import { CampaignDetailPrep } from './campaign-detail-prep';

describe('CampaignDetailPrep', () => {
  let fixture: ComponentFixture<CampaignDetailPrep>;
  let component: CampaignDetailPrep;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampaignDetailPrep],
      providers: [
        ...zonelessTestProviders,
        {
          provide: UiBannerPreferencesService,
          useValue: {
            hydrated: signal(true),
            isVisible: () => false,
            dismiss: jasmine.createSpy('dismiss'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignDetailPrep);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isMj', true);
    fixture.componentRef.setInput('prepSub', 'scenario');
    fixture.componentRef.setInput('tabs', campaignPrepSubTabs(true));
    fixture.componentRef.setInput('guideState', {
      hasAdventure: true,
      creatureCount: 0,
      mapCount: 0,
      encounterCount: 0,
      approvedPlayerCount: 0,
      playerCount: 0,
      readyPregenCount: 0,
      hasPlannedSession: false,
      hasActiveSession: false,
      nextSessionTitle: null,
      mapsSkipped: false,
    });
    fixture.detectChanges();
  });

  it('emits prep sub changes from the nav', () => {
    const spy = jasmine.createSpy('sub');
    component.prepSubChange.subscribe(spy);
    const buttons = fixture.nativeElement.querySelectorAll('nav button') as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(6);
    buttons[2]!.click();
    expect(spy).toHaveBeenCalledWith('maps');
  });
});
