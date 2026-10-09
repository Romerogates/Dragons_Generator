import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input, output } from '@angular/core';
import type { CampaignPrepSub, CampaignPrepSubTab } from '@core/utils/campaign-detail-tabs.util';
import type { CampaignSetupAction, CampaignSetupGuideInput } from '../campaign-setup-guide/campaign-setup-guide.util';
import { CampaignSetupGuide } from '../campaign-setup-guide/campaign-setup-guide';

/** Coquille onglet Préparation : nav + guide MJ. Les sous-vues restent projetées par le hub. */
@Component({
  selector: 'app-campaign-detail-prep',
  standalone: true,
  imports: [CampaignSetupGuide],
  templateUrl: './campaign-detail-prep.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailPrep {
  readonly isMj = input.required<boolean>();
  readonly prepSub = input.required<CampaignPrepSub>();
  readonly tabs = input.required<CampaignPrepSubTab[]>();
  readonly guideState = input.required<CampaignSetupGuideInput>();

  readonly prepSubChange = output<CampaignPrepSub>();
  readonly guideAction = output<CampaignSetupAction>();
}
