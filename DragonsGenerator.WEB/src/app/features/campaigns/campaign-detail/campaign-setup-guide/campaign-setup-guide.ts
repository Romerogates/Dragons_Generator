import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  buildCampaignSetupGuide,
  type CampaignSetupAction,
  type CampaignSetupGuideInput,
} from './campaign-setup-guide.util';

@Component({
  selector: 'app-campaign-setup-guide',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campaign-setup-guide.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignSetupGuide {
  readonly state = input.required<CampaignSetupGuideInput>();
  readonly action = output<CampaignSetupAction>();

  readonly view = computed(() => buildCampaignSetupGuide(this.state()));

  run(action: CampaignSetupAction): void {
    this.action.emit(action);
  }
}
