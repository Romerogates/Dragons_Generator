import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DiceRollComponent } from '@shared/components/dice-roll/dice-roll';
import { PlayBattleMap } from '../play-battle-map/play-battle-map';
import { PlayTableChat } from '../play-table-chat/play-table-chat';
import { CampaignInitiativeInline } from '../campaign-initiative-inline/campaign-initiative-inline';
import type { CampaignPlayPanel } from '../campaign-play-panel/campaign-play-panel';

/**
 * UI combat (phases, init, HP, import party, fin combat) + carte + fil.
 * Logique métier sur le shell `CampaignPlayPanel` (host) ;
 * ce composant porte le grand template extrait du god-object.
 */
@Component({
  selector: 'app-play-combat-flow',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DiceRollComponent,
    PlayBattleMap,
    PlayTableChat,
    CampaignInitiativeInline,
  ],
  templateUrl: './play-combat-flow.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PlayCombatFlow {
  /** Shell play-panel (méthodes + signaux combat). */
  readonly host = input.required<CampaignPlayPanel>();
}
