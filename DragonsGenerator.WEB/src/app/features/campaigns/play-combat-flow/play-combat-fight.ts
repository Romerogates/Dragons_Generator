import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DiceRollComponent } from '@shared/components/dice-roll/dice-roll';
import type { PlayCombatHost } from './play-combat-host';

@Component({
  selector: 'app-play-combat-fight',
  standalone: true,
  imports: [FormsModule, DiceRollComponent],
  templateUrl: './play-combat-fight.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PlayCombatFight {
  readonly host = input.required<PlayCombatHost>();
}
