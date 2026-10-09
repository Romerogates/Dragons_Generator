import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { LightMarkdownPipe } from '@shared/pipes/light-markdown.pipe';
import { CampaignHubViewService } from '../campaign-hub-store/campaign-hub-view.service';
import { CampaignDetailRoster } from './campaign-detail-roster/campaign-detail-roster';

@Component({
  selector: 'app-campaign-detail-overlays',
  standalone: true,
  imports: [CommonModule, ConfirmDialog, LightMarkdownPipe, CampaignDetailRoster],
  templateUrl: './campaign-detail-overlays.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignDetailOverlays {
  readonly vm = inject(CampaignHubViewService);
}
