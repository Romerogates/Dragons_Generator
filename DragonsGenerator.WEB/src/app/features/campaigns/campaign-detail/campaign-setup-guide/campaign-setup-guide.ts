import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  buildCampaignSetupGuide,
  type CampaignSetupAction,
  type CampaignSetupGuideInput,
} from './campaign-setup-guide.util';
import {
  UI_BANNER_IDS,
  UiBannerPreferencesService,
} from '@core/services/ui-banner-preferences.service';

@Component({
  selector: 'app-campaign-setup-guide',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './campaign-setup-guide.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignSetupGuide {
  private readonly banners = inject(UiBannerPreferencesService);

  readonly state = input.required<CampaignSetupGuideInput>();
  readonly action = output<CampaignSetupAction>();

  readonly view = computed(() => buildCampaignSetupGuide(this.state()));
  readonly visible = computed(
    () => this.banners.hydrated() && this.banners.isVisible(UI_BANNER_IDS.setupGuide),
  );

  run(action: CampaignSetupAction): void {
    this.action.emit(action);
  }

  dismiss(): void {
    this.banners.dismiss(UI_BANNER_IDS.setupGuide);
  }
}
