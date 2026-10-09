import { ComponentFixture, TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignDetailRoster } from './campaign-detail-roster';

describe('CampaignDetailRoster', () => {
  let component: CampaignDetailRoster;
  let fixture: ComponentFixture<CampaignDetailRoster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampaignDetailRoster],
      providers: [...zonelessTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignDetailRoster);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('memberCharacterLoadingKey', 'm1-approved');
    fixture.detectChanges();
  });

  it('matches member loading keys from the shared util', () => {
    expect(component.isMemberCharacterLoading('m1', 'approved')).toBe(true);
    expect(component.isMemberCharacterLoading('m1', 'proposed')).toBe(false);
  });
});
