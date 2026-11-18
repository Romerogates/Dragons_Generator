import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { emptyCampaignData, type CampaignDetail } from '@core/models/Campaign/campaign';
import { CampaignPlayPersistService } from './campaign-play-persist.service';

function detail(): CampaignDetail {
  return {
    id: 'c1',
    title: 'Table',
    role: 'dm',
    isOwner: true,
    updatedAt: '2026-01-01T00:00:00Z',
    members: [],
    data: emptyCampaignData(),
  };
}

describe('CampaignPlayPersistService', () => {
  it('applique updatedAt après PUT et signale une erreur', async () => {
    const update = jasmine
      .createSpy('update')
      .and.returnValues(
        of({ id: 'c1', updatedAt: '2026-02-01T00:00:00Z' }),
        throwError(() => new Error('fail')),
      );
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignPlayPersistService,
        { provide: CampaignCloudService, useValue: { update, patchLiveTable: update } },
      ],
    });
    const persist = TestBed.inject(CampaignPlayPersistService);
    let campaign = detail();
    let saving = false;
    let errors = 0;
    persist.attach({
      getCampaign: () => campaign,
      applyCampaign: (next) => {
        campaign = next;
      },
      setSaving: (v) => {
        saving = v;
      },
      onPersistError: () => {
        errors++;
      },
    });

    persist.persistFull(campaign.title, campaign.data);
    await persist.whenIdle();
    expect(campaign.updatedAt).toBe('2026-02-01T00:00:00Z');
    expect(saving).toBeFalse();

    persist.persistFull(campaign.title, campaign.data);
    await persist.whenIdle();
    expect(errors).toBe(1);
  });
});
