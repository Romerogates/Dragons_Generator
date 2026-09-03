import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import type { CampaignActivityItem } from '@core/services/campaign-cloud.service';
import {
  activityDetail,
  activityIcon,
  activityLabel,
  relativeActivityTime,
} from '../campaign-activity.util';

export type ActivityFilter = 'all' | 'handouts' | 'social' | 'sessions' | 'combat';

@Component({
  selector: 'app-campaign-detail-activity',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './campaign-detail-activity.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailActivity {
  readonly loading = input(false);
  readonly items = input<CampaignActivityItem[]>([]);
  readonly itemClick = output<CampaignActivityItem>();

  readonly filter = signal<ActivityFilter>('all');

  readonly filters: { id: ActivityFilter; label: string }[] = [
    { id: 'all', label: 'Tout' },
    { id: 'handouts', label: 'Documents' },
    { id: 'social', label: 'Social' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'combat', label: 'Combat / XP' },
  ];

  readonly filteredItems = computed(() => {
    const f = this.filter();
    const list = this.items();
    if (f === 'all') return list;
    return list.filter((item) => this.matchesFilter(item.kind, f));
  });

  readonly activityLabel = activityLabel;
  readonly activityIcon = activityIcon;
  readonly activityDetail = activityDetail;
  readonly relativeActivityTime = relativeActivityTime;

  private matchesFilter(kind: string, f: ActivityFilter): boolean {
    switch (f) {
      case 'handouts':
        return kind === 'handout_published';
      case 'social':
        return [
          'invite_sent',
          'invite_accepted',
          'member_joined',
          'member_removed',
          'member_left',
          'character_proposed',
          'character_pick_requested',
          'character_approved',
          'character_rejected',
        ].includes(kind);
      case 'sessions':
        return kind === 'session_scheduled' || kind === 'session_updated';
      case 'combat':
        return kind === 'xp_awarded' || kind === 'initiative_collection_opened';
      default:
        return true;
    }
  }
}
