import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { getCreatureIcon } from '@core/utils/creature-display.util';
import type { PlayCombatHost } from './play-combat-host';

@Component({
  selector: 'app-play-combat-setup',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './play-combat-setup.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PlayCombatSetup {
  readonly host = input.required<PlayCombatHost>();
  protected readonly portraitIcon = getCreatureIcon;
}
