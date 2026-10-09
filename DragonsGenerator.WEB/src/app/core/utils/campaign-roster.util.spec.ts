import { canRequestCharacterPick, memberCharacterLoadingKey } from './campaign-roster.util';
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

describe('campaign-roster.util', () => {
  it('allows a pick request when no approved character and not pending', () => {
    expect(canRequestCharacterPick(member({}))).toBe(true);
    expect(canRequestCharacterPick(member({ proposalStatus: 'rejected' }))).toBe(true);
    expect(canRequestCharacterPick(member({ proposalStatus: 'pending' }))).toBe(false);
    expect(canRequestCharacterPick(member({ approvedCharacterId: 'c1' }))).toBe(false);
  });

  it('builds member character loading keys', () => {
    expect(memberCharacterLoadingKey('m1', 'proposed')).toBe('m1-proposed');
    expect(memberCharacterLoadingKey('m1', 'approved')).toBe('m1-approved');
  });
});
