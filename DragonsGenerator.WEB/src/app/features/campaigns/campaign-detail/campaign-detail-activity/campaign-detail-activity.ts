import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import type { CampaignActivityItem } from '@core/services/campaign-cloud.service';
import {
  activityDetail,
  activityIcon,
  activityLabel,
  relativeActivityTime,
} from '../campaign-activity.util';

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

  readonly activityLabel = activityLabel;
  readonly activityIcon = activityIcon;
  readonly activityDetail = activityDetail;
  readonly relativeActivityTime = relativeActivityTime;
}
