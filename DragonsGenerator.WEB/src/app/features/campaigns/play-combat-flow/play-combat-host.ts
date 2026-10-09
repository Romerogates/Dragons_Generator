import type { Signal } from '@angular/core';
import type { PlayCombatState } from '../campaign-play-panel/play-combat-state.service';
import type { PlayTableActionsService } from '../campaign-play-panel/play-table-actions.service';
import type { PlayInitiativeService } from '../campaign-play-panel/play-initiative.service';
import type { PlayTableShellService } from '../campaign-play-panel/play-table-shell.service';
import type { PlayImportService } from '../campaign-play-panel/play-import.service';
import type { PlayCombatController } from './play-combat-controller';

export type PlayFightStep = 'menu' | 'pickAttack' | 'pickTarget' | 'toHit' | 'damage';

/**
 * Contrat UI combat : domaines, pas de relais.
 * `PlayCombatFacade` l’implémente ; persist via le store.
 */
export interface PlayCombatHost {
  readonly liveConnected: Signal<boolean>;
  readonly state: PlayCombatState;
  readonly actions: PlayTableActionsService;
  readonly initiative: PlayInitiativeService;
  readonly shell: PlayTableShellService;
  readonly playImport: PlayImportService;
  readonly ctrl: PlayCombatController;
}
