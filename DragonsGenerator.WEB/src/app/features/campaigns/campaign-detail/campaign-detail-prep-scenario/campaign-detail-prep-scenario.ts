import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdventureSynopsisView } from '@shared/components/adventure-synopsis-view/adventure-synopsis-view';

@Component({
  selector: 'app-campaign-detail-prep-scenario',
  standalone: true,
  imports: [FormsModule, AdventureSynopsisView],
  templateUrl: './campaign-detail-prep-scenario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetailPrepScenario {
  readonly isOwner = input.required<boolean>();
  readonly title = input.required<string>();
  readonly adventure = input('');

  readonly editScenario = output<void>();
  readonly titleChange = output<string>();
}
