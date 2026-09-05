import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import type { SafeResourceUrl } from '@angular/platform-browser';
import {
  CampaignHandout,
  CampaignMember,
  CampaignPregen,
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

export type CampaignPdfKind = 'pack' | 'bestiary';

export interface MemberSheetPdfEvent {
  member: CampaignMember;
  scope: 'proposed' | 'approved';
}

@Component({
  selector: 'app-campaign-detail-handouts',
  standalone: true,
  imports: [CommonModule, FormsModule, LightMarkdownPipe],
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

  /** Hub PDF (MJ) — centralisé ici pour ne pas encombrer Résumé / Créatures. */
  readonly printing = input(false);
  readonly pdfPreviewUrl = input<SafeResourceUrl | null>(null);
  readonly isLoadingPreview = input(false);
  readonly pdfPreviewKind = input<CampaignPdfKind>('pack');
  readonly hasCreatures = input(false);
  readonly pregens = input<CampaignPregen[]>([]);
  readonly sheetMembers = input<CampaignMember[]>([]);
  readonly pregenPdfLoadingId = input<string | null>(null);
  readonly memberSheetLoadingKey = input<string | null>(null);

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

  readonly printPackMj = output<void>();
  readonly printBestiary = output<void>();
  readonly printPlayerSummaries = output<void>();
  readonly printAllPlayerSheets = output<void>();
  readonly loadPackPreview = output<void>();
  readonly loadBestiaryPreview = output<void>();
  readonly openPdfFullscreen = output<void>();
  readonly printPregenFullSheet = output<CampaignPregen>();
  readonly printPregenHandout = output<CampaignPregen>();
  readonly printMemberFullSheet = output<MemberSheetPdfEvent>();

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

  memberSheetLabel(m: CampaignMember): string {
    if (m.proposalStatus === 'pending' && m.proposedCharacterName) {
      return `${m.displayName} — ${m.proposedCharacterName} (proposé)`;
    }
    return `${m.displayName} — ${m.approvedCharacterName ?? 'Personnage'}`;
  }

  memberSheetScope(m: CampaignMember): 'proposed' | 'approved' {
    return m.proposalStatus === 'pending' && m.proposedCharacterId ? 'proposed' : 'approved';
  }

  memberLoadingKey(m: CampaignMember): string {
    return `${m.id}-${this.memberSheetScope(m)}`;
  }
}
