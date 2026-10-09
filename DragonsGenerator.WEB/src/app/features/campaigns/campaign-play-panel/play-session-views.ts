import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CampaignDungeonMaps } from '../campaign-dungeon-maps/campaign-dungeon-maps';
import { CampaignSessionNotes } from '../campaign-session-notes/campaign-session-notes';
import { CampaignSessionTimeline } from '../campaign-session-timeline/campaign-session-timeline';
import { PlayCombatFlow } from '../play-combat-flow/play-combat-flow';
import { PlayCombatFacade } from './play-combat.facade';
import { PlayEmptyHint } from './play-empty-hint';
import { PlaySessionDock } from './play-session-dock';
import { PlayImportService } from './play-import.service';
import { PlayTableShellService } from './play-table-shell.service';

@Component({
  selector: 'app-play-session-views',
  standalone: true,
  imports: [
    RouterLink,
    CampaignDungeonMaps,
    CampaignSessionNotes,
    CampaignSessionTimeline,
    PlayCombatFlow,
    PlaySessionDock,
    PlayEmptyHint,
  ],
  templateUrl: './play-session-views.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PlaySessionViews {
  readonly combat = inject(PlayCombatFacade);
  readonly shell = inject(PlayTableShellService);
  readonly playImport = inject(PlayImportService);
}
