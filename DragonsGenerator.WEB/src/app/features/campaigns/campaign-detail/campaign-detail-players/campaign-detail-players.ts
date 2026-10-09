import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CampaignMember, FriendUser } from '@core/models/Campaign/campaign';
import { ProfileAvatarComponent } from '@shared/components/profile-avatar/profile-avatar';
import {
  canRequestCharacterPick,
  memberCharacterLoadingKey,
} from '@core/utils/campaign-roster.util';

export type PlayersCharacterScope = 'proposed' | 'approved';

@Component({
  selector: 'app-campaign-detail-players',
  standalone: true,
  imports: [RouterLink, ProfileAvatarComponent],
  templateUrl: './campaign-detail-players.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailPlayers {
  readonly isOwner = input(false);
  readonly campaignId = input.required<string>();
  readonly rosterFeedback = input<string | null>(null);
  readonly joinLink = input<{ token: string | null; enabled: boolean } | null>(null);
  readonly joinLinkBusy = input(false);
  readonly canNativeShare = input(false);
  readonly invitableFriends = input<FriendUser[]>([]);
  readonly pendingInvites = input<{ id: string; userId: string; displayName: string; createdAt: string }[]>(
    [],
  );
  readonly players = input<CampaignMember[]>([]);
  readonly spectators = input<CampaignMember[]>([]);
  readonly myPlayerMember = input<CampaignMember | null>(null);
  readonly myCharacters = input<{ id: string; name: string }[]>([]);
  readonly otherPlayers = input<CampaignMember[]>([]);
  readonly characterRequestLoadingId = input<string | null>(null);
  readonly memberCharacterLoadingKey = input<string | null>(null);

  readonly copyJoinLink = output<void>();
  readonly shareJoinLink = output<void>();
  readonly regenerateJoinLink = output<void>();
  readonly revokeJoinLink = output<void>();
  readonly copyFriendsInviteLink = output<void>();
  readonly inviteFriend = output<string>();
  readonly viewMemberCharacter = output<{ member: CampaignMember; scope: PlayersCharacterScope }>();
  readonly approveMember = output<CampaignMember>();
  readonly rejectMember = output<CampaignMember>();
  readonly requestCharacterPick = output<CampaignMember>();
  readonly setMemberAsSpectator = output<CampaignMember>();
  readonly removeMember = output<CampaignMember>();
  readonly proposeCharacter = output<string>();

  canRequestPick(member: CampaignMember): boolean {
    return canRequestCharacterPick(member);
  }

  isCharacterRequestLoading(memberId: string): boolean {
    return this.characterRequestLoadingId() === memberId;
  }

  isMemberCharacterLoading(memberId: string, scope: PlayersCharacterScope): boolean {
    return this.memberCharacterLoadingKey() === memberCharacterLoadingKey(memberId, scope);
  }
}
