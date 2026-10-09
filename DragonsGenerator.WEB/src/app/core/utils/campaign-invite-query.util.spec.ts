import { parseCampaignInviteQuery } from './campaign-invite-query.util';

describe('parseCampaignInviteQuery', () => {
  it('returns a trimmed invite id', () => {
    expect(parseCampaignInviteQuery('  inv-1  ')).toBe('inv-1');
  });

  it('returns null when empty', () => {
    expect(parseCampaignInviteQuery(null)).toBeNull();
    expect(parseCampaignInviteQuery('')).toBeNull();
    expect(parseCampaignInviteQuery('   ')).toBeNull();
  });
});
