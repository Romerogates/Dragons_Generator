import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CampaignMember, CampaignSession } from '@core/models/Campaign/campaign';

@Component({
  selector: 'app-campaign-player-sheet',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './campaign-player-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'block' },
})
export class CampaignPlayerSheet {
  readonly campaignId = input.required<string>();
  readonly member = input<CampaignMember | null>(null);
  readonly xpEarned = input(0);
  readonly nextSession = input<CampaignSession | null>(null);
  readonly lastHandoutTitle = input<string | null>(null);
  readonly levelUp = output<void>();
}
