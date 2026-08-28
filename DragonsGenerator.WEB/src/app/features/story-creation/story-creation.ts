import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { SelectCreaturesStep } from './steps/select-creatures-step/select-creatures-step';
import { CustomizeCreaturesStep } from './steps/customize-creatures-step/customize-creatures-step';
import { AdventureStep } from './steps/adventure-step/adventure-step';
import { StorySummaryStep } from './steps/story-summary-step/story-summary-step';

@Component({
  selector: 'app-story-creation',
  standalone: true,
  imports: [
    CommonModule,
    SelectCreaturesStep,
    CustomizeCreaturesStep,
    AdventureStep,
    StorySummaryStep,
  ],
  templateUrl: './story-creation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class StoryCreation implements OnInit {
  readonly builder = inject(StoryBuilderService);
  readonly showDraftPrompt = signal(false);

  ngOnInit(): void {
    if (this.builder.isEditingCampaign()) {
      return;
    }
    if (this.builder.hasPendingDraft() && this.builder.currentStep() > 1) {
      this.showDraftPrompt.set(true);
    }
  }

  resumeDraft(): void {
    this.showDraftPrompt.set(false);
  }

  startFresh(): void {
    this.showDraftPrompt.set(false);
    this.builder.reset();
  }
}
