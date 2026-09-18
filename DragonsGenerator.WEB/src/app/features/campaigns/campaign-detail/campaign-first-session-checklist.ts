import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import {
  buildFirstSessionChecklist,
  type FirstSessionAction,
  type FirstSessionChecklistInput,
} from './campaign-first-session-checklist.util';
import {
  UI_BANNER_IDS,
  UiBannerPreferencesService,
} from '@core/services/ui-banner-preferences.service';

@Component({
  selector: 'app-campaign-first-session-checklist',
  standalone: true,
  templateUrl: './campaign-first-session-checklist.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignFirstSessionChecklist {
  private readonly banners = inject(UiBannerPreferencesService);

  readonly state = input.required<FirstSessionChecklistInput>();
  readonly campaignId = input<string | null>(null);
  readonly action = output<FirstSessionAction>();

  readonly view = computed(() => buildFirstSessionChecklist(this.state()));

  /** Tour terminé : bandeau de bascule vers la prépa (masquable). */
  readonly showCompletion = computed(
    () =>
      this.view().allDone &&
      this.banners.hydrated() &&
      this.banners.isVisible(UI_BANNER_IDS.firstSessionComplete),
  );

  dismissCompletion(): void {
    this.banners.dismiss(UI_BANNER_IDS.firstSessionComplete);
  }
}
