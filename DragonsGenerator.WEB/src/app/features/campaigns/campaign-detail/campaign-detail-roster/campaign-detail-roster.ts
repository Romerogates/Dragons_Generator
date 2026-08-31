import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
} from '@angular/core';
import type { CampaignMember } from '@core/models/Campaign/campaign';

export type MemberCharacterScope = 'proposed' | 'approved';

export interface MemberCharacterAction {
  member: CampaignMember;
  scope: MemberCharacterScope;
}

@Component({
  selector: 'app-campaign-detail-roster',
  standalone: true,
  templateUrl: './campaign-detail-roster.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailRoster {
  readonly visible = input(false);
  readonly feedback = input<string | null>(null);
  readonly playersNeedingCharacter = input<CampaignMember[]>([]);
  readonly pendingProposals = input<CampaignMember[]>([]);
  readonly approvedPlayers = input<CampaignMember[]>([]);
  readonly characterRequestLoadingId = input<string | null>(null);
  readonly memberCharacterLoadingKey = input<string | null>(null);

  readonly requestCharacterPick = output<CampaignMember>();
  readonly removeMember = output<CampaignMember>();
  readonly approveMember = output<CampaignMember>();
  readonly rejectMember = output<CampaignMember>();
  readonly viewMemberCharacter = output<MemberCharacterAction>();
  readonly printMemberFullSheet = output<MemberCharacterAction>();

  isMemberCharacterLoading(memberId: string, scope: MemberCharacterScope): boolean {
    return this.memberCharacterLoadingKey() === `${memberId}-${scope}`;
  }
}
