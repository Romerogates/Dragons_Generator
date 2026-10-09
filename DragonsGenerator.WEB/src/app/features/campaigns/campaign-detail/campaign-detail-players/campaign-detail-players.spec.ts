import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignDetailPlayers } from './campaign-detail-players';
import type { CampaignMember } from '@core/models/Campaign/campaign';

function member(partial: Partial<CampaignMember>): CampaignMember {
  return {
    id: 'm1',
    userId: 'u1',
    displayName: 'Aude',
    role: 'player',
    proposalStatus: 'none',
    xpEarnedInCampaign: 0,
    ...partial,
  };
}

describe('CampaignDetailPlayers', () => {
  let component: CampaignDetailPlayers;
  let fixture: ComponentFixture<CampaignDetailPlayers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampaignDetailPlayers],
      providers: [...zonelessTestProviders, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignDetailPlayers);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('campaignId', 'camp-1');
    fixture.componentRef.setInput('isOwner', true);
    fixture.componentRef.setInput('players', [member({ proposalStatus: 'pending' })]);
    fixture.detectChanges();
  });

  it('delegates pick eligibility and loading keys', () => {
    expect(component.canRequestPick(member({}))).toBe(true);
    expect(component.canRequestPick(member({ proposalStatus: 'pending' }))).toBe(false);
    fixture.componentRef.setInput('characterRequestLoadingId', 'm1');
    expect(component.isCharacterRequestLoading('m1')).toBe(true);
    fixture.componentRef.setInput('memberCharacterLoadingKey', 'm1-proposed');
    expect(component.isMemberCharacterLoading('m1', 'proposed')).toBe(true);
  });

  it('shows join-link copy for the GM', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="copy-join-link"]')).toBeTruthy();
  });
});
