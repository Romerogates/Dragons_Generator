import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { PlayBattleMap } from '../play-battle-map/play-battle-map';
import { PlayTableChat } from '../play-table-chat/play-table-chat';
import type { PlayCombatHost } from './play-combat-host';
import { PlayCombatHeader } from './play-combat-header';
import { PlayCombatTracker } from './play-combat-tracker';
import { PlayCombatFight } from './play-combat-fight';
import { PlayCombatSetup } from './play-combat-setup';
import { PlayCombatIdle } from './play-combat-idle';

/**
 * UI combat : shell + phases (header, tracker, fight, setup, idle).
 * Logique via `PlayCombatHost` ; persist via le store.
 */
@Component({
  selector: 'app-play-combat-flow',
  standalone: true,
  imports: [
    PlayBattleMap,
    PlayTableChat,
    PlayCombatHeader,
    PlayCombatTracker,
    PlayCombatFight,
    PlayCombatSetup,
    PlayCombatIdle,
  ],
  templateUrl: './play-combat-flow.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayCombatFlow {
  readonly host = input.required<PlayCombatHost>();
}
