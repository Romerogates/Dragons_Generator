import type { CampaignMember } from '@core/models/Campaign/campaign';

export function canRequestCharacterPick(member: CampaignMember): boolean {
  return !member.approvedCharacterId && member.proposalStatus !== 'pending';
}

export function memberCharacterLoadingKey(
  memberId: string,
  scope: 'proposed' | 'approved',
): string {
  return `${memberId}-${scope}`;
}
