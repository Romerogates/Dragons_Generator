import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import type { CampaignMember, CampaignSession } from '@core/models/Campaign/campaign';

@Component({
  selector: 'app-campaign-player-sheet',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './campaign-player-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignPlayerSheet {
  readonly member = input<CampaignMember | null>(null);
  readonly xpEarned = input(0);
  readonly nextSession = input<CampaignSession | null>(null);
  readonly lastHandoutTitle = input<string | null>(null);
}
