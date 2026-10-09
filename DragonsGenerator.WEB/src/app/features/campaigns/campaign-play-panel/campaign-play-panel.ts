import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import type { CampaignDetail as CampaignDetailModel } from '@core/models/Campaign/campaign';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';
import { PlayTableShellService } from './play-table-shell.service';
import { PlayImportService } from './play-import.service';
import { PlayCombatState } from './play-combat-state.service';
import { PlayInitiativeService } from './play-initiative.service';
import { PlayTableActionsService } from './play-table-actions.service';
import { PlayCombatFacade } from './play-combat.facade';
import { PlayTableChrome } from './play-table-chrome';
import { PlaySessionViews } from './play-session-views';
import { PlayPlayerRail } from './play-player-rail';
import { PlayTableOverlays } from './play-table-overlays';
import type { PlaySessionView } from '@core/utils/play-table.util';
import { type MjTableShortcut } from '@core/utils/play-keyboard.util';

export type { PlaySessionView };

@Component({
  selector: 'app-campaign-play-panel',
  standalone: true,
  imports: [PlayTableChrome, PlaySessionViews, PlayPlayerRail, PlayTableOverlays],
  providers: [
    CampaignPlaySessionStore,
    PlayTableShellService,
    PlayImportService,
    PlayCombatState,
    PlayInitiativeService,
    PlayTableActionsService,
    PlayCombatFacade,
  ],
  templateUrl: './campaign-play-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignPlayPanel implements OnDestroy {
  readonly campaign = input.required<CampaignDetailModel>();
  readonly fullscreen = input(false);
  readonly campaignChange = output<CampaignDetailModel>();

  readonly shell = inject(PlayTableShellService);
  readonly playImport = inject(PlayImportService);
  readonly combat = inject(PlayCombatFacade);
  private readonly playStore = inject(CampaignPlaySessionStore);
  private readonly chrome = viewChild(PlayTableChrome);

  readonly saving = this.playStore.saving;

  constructor() {
    this.combat.bind({
      campaign: this.campaign,
      fullscreen: this.fullscreen,
      emitCampaign: (next) => this.campaignChange.emit(next),
      tableChat: () => this.chrome()?.tableChat(),
    });
  }

  ngOnDestroy(): void {
    this.combat.destroy();
  }

  announceCodexImport(creatureName: string): void {
    this.shell.announceCodexImport(creatureName);
  }

  handleMjShortcut(key: MjTableShortcut): boolean {
    return this.combat.actions.handleMjShortcut(key);
  }
}
