import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlayCombatFacade } from './play-combat.facade';
import { PlayTableShellService } from './play-table-shell.service';

@Component({
  selector: 'app-play-player-rail',
  standalone: true,
  templateUrl: './play-player-rail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayPlayerRail {
  readonly combat = inject(PlayCombatFacade);
  readonly shell = inject(PlayTableShellService);
}
