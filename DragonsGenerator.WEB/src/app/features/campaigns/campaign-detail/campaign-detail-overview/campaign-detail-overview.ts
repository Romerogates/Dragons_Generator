import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
} from '@angular/core';
import type { CampaignMember, CampaignSession } from '@core/models/Campaign/campaign';
import type { CampaignActivityItem } from '@core/services/campaign-cloud.service';
import { CampaignDetailStats, type CampaignStatsNav } from '../campaign-detail-stats/campaign-detail-stats';
import {
  CampaignDetailRoster,
  type MemberCharacterAction,
} from '../campaign-detail-roster/campaign-detail-roster';
import { CampaignDetailActivity } from '../campaign-detail-activity/campaign-detail-activity';
import { CampaignPlayerSheet } from '../../campaign-player-sheet/campaign-player-sheet';

@Component({
  selector: 'app-campaign-detail-overview',
  standalone: true,
  imports: [
    CampaignDetailStats,
    CampaignDetailRoster,
    CampaignDetailActivity,
    CampaignPlayerSheet,
  ],
  templateUrl: './campaign-detail-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailOverview {
  readonly isOwner = input.required<boolean>();
  readonly liveSession = input<CampaignSession | null>(null);
  readonly nextSession = input<CampaignSession | null>(null);
  readonly liveSessionDateLabel = input('');
  readonly liveSessionModeLabel = input('');
  readonly nextSessionDateLabel = input('');
  readonly nextSessionModeLabel = input('');

  readonly creatureCount = input(0);
  readonly encounterCount = input(0);
  readonly playerCount = input(0);
  readonly plannedSessionCount = input(0);
  readonly playedSessionCount = input(0);
  readonly documentCount = input(0);
  readonly totalXpAwarded = input(0);
  readonly myXpEarned = input(0);
  readonly approvedCharacterName = input<string | null | undefined>(null);

  readonly adventureExcerpt = input('');
  readonly showRoster = input(false);
  readonly rosterFeedback = input<string | null>(null);
  readonly playersNeedingCharacter = input<CampaignMember[]>([]);
  readonly pendingProposals = input<CampaignMember[]>([]);
  readonly approvedPlayers = input<CampaignMember[]>([]);
  readonly characterRequestLoadingId = input<string | null>(null);
  readonly memberCharacterLoadingKey = input<string | null>(null);

  readonly myPlayerMember = input<CampaignMember | null>(null);
  readonly lastHandoutTitle = input<string | null>(null);
  readonly publishedHandoutsCount = input(0);
  readonly campaignId = input.required<string>();

  readonly activityLoading = input(false);
  readonly activity = input<CampaignActivityItem[]>([]);

  readonly openPlayFullscreen = output<void>();
  readonly startPlaySession = output<string>();
  readonly goSessions = output<void>();
  readonly openPrepScenario = output<void>();
  readonly statsNavigate = output<CampaignStatsNav>();
  readonly requestCharacterPick = output<CampaignMember>();
  readonly removeMember = output<CampaignMember>();
  readonly approveMember = output<CampaignMember>();
  readonly rejectMember = output<CampaignMember>();
  readonly viewMemberCharacter = output<MemberCharacterAction>();
  readonly printMemberFullSheet = output<MemberCharacterAction>();
  readonly activityItemClick = output<CampaignActivityItem>();
  readonly goHandouts = output<void>();
}
