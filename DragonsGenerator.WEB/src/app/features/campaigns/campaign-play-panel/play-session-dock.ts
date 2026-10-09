import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PlayCombatFacade } from './play-combat.facade';
import { PlayDockTile } from './play-dock-tile';
import { PlayTableShellService } from './play-table-shell.service';

@Component({
  selector: 'app-play-session-dock',
  standalone: true,
  imports: [PlayDockTile],
  templateUrl: './play-session-dock.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaySessionDock {
  readonly compact = input(false);
  readonly combat = inject(PlayCombatFacade);
  readonly shell = inject(PlayTableShellService);

  readonly combatDetail = computed(() => {
    const fight = this.combat.state.activeCombat();
    if (this.compact()) {
      return fight ? 'Reprendre le combat' : 'Alliés → init → tours';
    }
    return fight
      ? `Reprendre · manche ${fight.round} · ${fight.label || 'Combat'}`
      : 'Alliés → initiative → tours';
  });

  readonly notesTitle = computed(() => (this.compact() ? 'Notes / scène' : 'Notes'));
  readonly notesDetail = computed(() =>
    this.compact() ? 'Écrire ce qui se passe' : 'Carnet de session (texte / stylet)',
  );

  readonly encountersDetail = computed(() => {
    if (this.compact()) return 'Lancer un groupe préparé';
    const n = this.combat.state.campaign().data.encounters.length;
    return `${n} préparée${n > 1 ? 's' : ''}`;
  });

  readonly dungeonDetail = computed(() => this.combat.state.activeSessionMap()?.name ?? 'Aucun donjon attribué');

  readonly secretsDetail = computed(() => {
    const n = this.combat.state.secretCreatureCards().length;
    return n ? `${n} PNJ · calepins` : 'Voix / désir / peur / secret';
  });
}
