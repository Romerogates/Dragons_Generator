import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PlayCombatHost } from './play-combat-host';

@Component({
  selector: 'app-play-combat-setup',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './play-combat-setup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayCombatSetup {
  readonly host = input.required<PlayCombatHost>();
}
