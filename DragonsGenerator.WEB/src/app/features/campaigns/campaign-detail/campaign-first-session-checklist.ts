import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import {
  buildFirstSessionChecklist,
  type FirstSessionAction,
  type FirstSessionChecklistInput,
} from './campaign-first-session-checklist.util';

const dismissKey = (campaignId: string) => `dg-first-session-dismiss:${campaignId}`;

@Component({
  selector: 'app-campaign-first-session-checklist',
  standalone: true,
  templateUrl: './campaign-first-session-checklist.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignFirstSessionChecklist {
  readonly state = input.required<FirstSessionChecklistInput>();
  readonly campaignId = input<string | null>(null);
  readonly action = output<FirstSessionAction>();

  readonly view = computed(() => buildFirstSessionChecklist(this.state()));
  private readonly dismissed = signal(false);

  /** Tour terminé : bandeau de bascule vers la prépa (masquable). */
  readonly showCompletion = computed(() => this.view().allDone && !this.dismissed());

  constructor() {
    effect(() => {
      const id = this.campaignId();
      if (!id || typeof localStorage === 'undefined') {
        this.dismissed.set(false);
        return;
      }
      this.dismissed.set(localStorage.getItem(dismissKey(id)) === '1');
    });
  }

  dismissCompletion(): void {
    const id = this.campaignId();
    if (id && typeof localStorage !== 'undefined') {
      localStorage.setItem(dismissKey(id), '1');
    }
    this.dismissed.set(true);
  }
}
