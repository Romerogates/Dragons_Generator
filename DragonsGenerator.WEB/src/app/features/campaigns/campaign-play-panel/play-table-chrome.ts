import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullscreenEnterLink } from '@shared/components/fullscreen-enter-btn/fullscreen-enter-link';
import { PlayTableChat } from '../play-table-chat/play-table-chat';
import { PlayPawn } from '../play-combat-flow/play-pawn';
import { PlayCombatFacade } from './play-combat.facade';
import { PlayImportService } from './play-import.service';
import { PlayTableShellService } from './play-table-shell.service';

@Component({
  selector: 'app-play-table-chrome',
  standalone: true,
  imports: [FormsModule, FullscreenEnterLink, PlayTableChat, PlayPawn],
  templateUrl: './play-table-chrome.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PlayTableChrome {
  readonly combat = inject(PlayCombatFacade);
  readonly shell = inject(PlayTableShellService);
  readonly playImport = inject(PlayImportService);
  readonly tableChat = viewChild(PlayTableChat);
  readonly sceneBeat = signal('');

  submitSceneBeat(): void {
    this.combat.actions.announceSceneBeat(this.sceneBeat());
    this.sceneBeat.set('');
  }
}
