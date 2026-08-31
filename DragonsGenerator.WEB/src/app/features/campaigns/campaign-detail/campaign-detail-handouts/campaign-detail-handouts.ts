import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CampaignHandout,
  HandoutKind,
  HANDOUT_KIND_LABELS,
} from '@core/models/Campaign/campaign';
import { LightMarkdownPipe } from '@shared/pipes/light-markdown.pipe';

export interface HandoutPatchEvent {
  handoutId: string;
  patch: Partial<CampaignHandout>;
}

export interface HandoutPublishEvent {
  handoutId: string;
  published: boolean;
}

@Component({
  selector: 'app-campaign-detail-handouts',
  standalone: true,
  imports: [FormsModule, LightMarkdownPipe],
  templateUrl: './campaign-detail-handouts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetailHandouts {
  readonly isOwner = input.required<boolean>();
  readonly handouts = input<CampaignHandout[]>([]);
  readonly kindFilter = input<HandoutKind | 'all'>('all');
  readonly editingHandoutId = input<string | null>(null);
  readonly focusHandoutId = input<string | null>(null);
  readonly previewHandout = input<CampaignHandout | null>(null);
  readonly pinnedHandoutId = input<string | null>(null);

  readonly handoutKinds: HandoutKind[] = ['letter', 'map', 'summary', 'other'];
  readonly handoutKindLabels = HANDOUT_KIND_LABELS;

  readonly addHandout = output<void>();
  readonly kindFilterChange = output<HandoutKind | 'all'>();
  readonly startEdit = output<string>();
  readonly stopEdit = output<void>();
  readonly deleteHandout = output<string>();
  readonly preview = output<string>();
  readonly closePreview = output<void>();
  readonly handoutPatch = output<HandoutPatchEvent>();
  readonly handoutPatchImmediate = output<HandoutPatchEvent>();
  readonly togglePublished = output<HandoutPublishEvent>();
  readonly pinHandout = output<string>();

  formatHandoutDate(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
