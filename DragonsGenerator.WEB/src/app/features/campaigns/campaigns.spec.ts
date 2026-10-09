import { parseCampaignInviteQuery } from '@core/utils/campaign-invite-query.util';

describe('Campaigns invite highlight', () => {
  it('highlights the invite id from the notification query', () => {
    expect(parseCampaignInviteQuery('inv-42')).toBe('inv-42');
    expect(parseCampaignInviteQuery(null)).toBeNull();
  });
});
