import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignDungeonMaps } from '../campaign-dungeon-maps/campaign-dungeon-maps';
import { CampaignCalendar } from '../campaign-calendar/campaign-calendar';
import { CampaignNotebook } from '../campaign-notebook/campaign-notebook';
import { CampaignInitiativeInline } from '../campaign-initiative-inline/campaign-initiative-inline';
import { CampaignHubViewService } from '../campaign-hub-store/campaign-hub-view.service';
import { CampaignDetailOverview } from './campaign-detail-overview/campaign-detail-overview';
import { CampaignDetailSessions } from './campaign-detail-sessions/campaign-detail-sessions';
import { CampaignDetailHandouts } from './campaign-detail-handouts/campaign-detail-handouts';
import { CampaignDetailPrepScenario } from './campaign-detail-prep-scenario/campaign-detail-prep-scenario';
import { CampaignDetailPrepCreatures } from './campaign-detail-prep-creatures/campaign-detail-prep-creatures';
import { CampaignDetailPrepEncounters } from './campaign-detail-prep-encounters/campaign-detail-prep-encounters';
import { CampaignDetailPrepPregens } from './campaign-detail-prep-pregens/campaign-detail-prep-pregens';
import { CampaignDetailPlayers } from './campaign-detail-players/campaign-detail-players';
import { CampaignDetailPrep } from './campaign-detail-prep/campaign-detail-prep';

@Component({
  selector: 'app-campaign-detail-tabs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CampaignDungeonMaps,
    CampaignDetailOverview,
    CampaignDetailSessions,
    CampaignCalendar,
    CampaignDetailHandouts,
    CampaignDetailPrepScenario,
    CampaignDetailPrepCreatures,
    CampaignDetailPrepEncounters,
    CampaignDetailPrepPregens,
    CampaignDetailPrep,
    CampaignDetailPlayers,
    CampaignNotebook,
    CampaignInitiativeInline,
  ],
  templateUrl: './campaign-detail-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailTabs {
  readonly vm = inject(CampaignHubViewService);
  private readonly dungeonMapsComp = viewChild(CampaignDungeonMaps);

  flushPendingSave(): void {
    this.dungeonMapsComp()?.flushPendingSave();
  }
}
