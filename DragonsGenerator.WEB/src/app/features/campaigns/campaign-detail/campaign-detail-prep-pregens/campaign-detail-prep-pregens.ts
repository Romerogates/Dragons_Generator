import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PREGEN_STATUS_LABELS,
  type CampaignMember,
  type CampaignPregen,
} from '@core/models/Campaign/campaign';
import { AiGenerationProgressBar } from '@shared/components/ai-generation-progress-bar/ai-generation-progress-bar';

export interface PregenPatchEvent {
  pregenId: string;
  patch: Partial<CampaignPregen>;
}

export interface AssignPregenEvent {
  pregen: CampaignPregen;
  member: CampaignMember;
}

@Component({
  selector: 'app-campaign-detail-prep-pregens',
  standalone: true,
  imports: [FormsModule, RouterLink, AiGenerationProgressBar],
  templateUrl: './campaign-detail-prep-pregens.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailPrepPregens {
  readonly isOwner = input.required<boolean>();
  readonly campaignId = input.required<string>();
  readonly pregens = input<CampaignPregen[]>([]);
  readonly players = input<CampaignMember[]>([]);
  readonly readyPregens = input<CampaignPregen[]>([]);
  readonly myAssignedPregens = input<CampaignPregen[]>([]);
  readonly dmCharacters = input<{ id: string; name: string }[]>([]);
  readonly feedback = input<string | null>(null);
  readonly undoAvailable = input(false);
  readonly importing = input(false);
  readonly generating = input(false);
  readonly pdfLoadingId = input<string | null>(null);
  readonly aiForegroundActive = input(false);
  readonly aiActive = input(false);
  readonly aiBackground = input(false);

  readonly runUndo = output<void>();
  readonly viewCharacter = output<CampaignPregen>();
  readonly useAtTable = output<string>();
  readonly claim = output<string>();
  readonly printFullSheet = output<CampaignPregen>();
  readonly generateAuto = output<void>();
  readonly importFromCharacter = output<string>();
  readonly remove = output<string>();
  readonly patch = output<PregenPatchEvent>();
  readonly markReady = output<string>();
  readonly assign = output<AssignPregenEvent>();

  readonly pregenStatusLabels = PREGEN_STATUS_LABELS;
}
