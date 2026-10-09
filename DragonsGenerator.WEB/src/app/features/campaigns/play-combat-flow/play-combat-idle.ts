import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PlayCombatHost } from './play-combat-host';

@Component({
  selector: 'app-play-combat-idle',
  standalone: true,
  templateUrl: './play-combat-idle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayCombatIdle {
  readonly host = input.required<PlayCombatHost>();
}
