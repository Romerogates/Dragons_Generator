import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type CampaignStatsNav =
  | 'creatures'
  | 'encounters'
  | 'players'
  | 'handouts'
  | 'sessions'
  | 'prep';

@Component({
  selector: 'app-campaign-detail-stats',
  standalone: true,
  templateUrl: './campaign-detail-stats.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetailStats {
  readonly isOwner = input.required<boolean>();
  readonly creatureCount = input(0);
  readonly encounterCount = input(0);
  readonly playerCount = input(0);
  readonly plannedSessionCount = input(0);
  readonly playedSessionCount = input(0);
  readonly documentCount = input(0);
  readonly totalXpAwarded = input(0);
  readonly myXpEarned = input(0);
  readonly approvedCharacterName = input<string | null | undefined>(null);

  readonly navigate = output<CampaignStatsNav>();
}
