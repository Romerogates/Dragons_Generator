import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import type { DungeonMapsHost } from './dungeon-maps-host';

@Component({
  selector: 'app-dungeon-maps-overlays',
  standalone: true,
  imports: [RouterLink, ConfirmDialog],
  templateUrl: './dungeon-maps-overlays.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DungeonMapsOverlays {
  readonly host = input.required<DungeonMapsHost>();
}
