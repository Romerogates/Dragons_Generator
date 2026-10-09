import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PlayCombatHost } from './play-combat-host';

@Component({
  selector: 'app-play-combat-header',
  standalone: true,
  templateUrl: './play-combat-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayCombatHeader {
  readonly host = input.required<PlayCombatHost>();
}
