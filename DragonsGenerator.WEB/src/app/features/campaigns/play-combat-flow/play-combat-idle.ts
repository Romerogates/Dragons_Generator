import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import type { PlayCombatHost } from './play-combat-host';
import { PlayPawn } from './play-pawn';

@Component({
  selector: 'app-play-combat-idle',
  standalone: true,
  imports: [PlayPawn],
  templateUrl: './play-combat-idle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PlayCombatIdle {
  readonly host = input.required<PlayCombatHost>();
}
