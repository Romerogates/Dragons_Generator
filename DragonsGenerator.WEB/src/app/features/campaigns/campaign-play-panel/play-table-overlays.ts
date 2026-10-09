import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { PlayCombatFacade } from './play-combat.facade';
import { PlayImportService } from './play-import.service';
import { PlayTableShellService } from './play-table-shell.service';

@Component({
  selector: 'app-play-table-overlays',
  standalone: true,
  imports: [FormsModule, RouterLink, ConfirmDialog],
  templateUrl: './play-table-overlays.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayTableOverlays {
  readonly combat = inject(PlayCombatFacade);
  readonly shell = inject(PlayTableShellService);
  readonly playImport = inject(PlayImportService);
}
