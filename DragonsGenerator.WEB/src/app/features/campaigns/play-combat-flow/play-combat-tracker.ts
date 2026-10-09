import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CampaignInitiativeInline } from '../campaign-initiative-inline/campaign-initiative-inline';
import type { PlayCombatHost } from './play-combat-host';

@Component({
  selector: 'app-play-combat-tracker',
  standalone: true,
  imports: [RouterLink, CampaignInitiativeInline],
  templateUrl: './play-combat-tracker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayCombatTracker {
  readonly host = input.required<PlayCombatHost>();
}
