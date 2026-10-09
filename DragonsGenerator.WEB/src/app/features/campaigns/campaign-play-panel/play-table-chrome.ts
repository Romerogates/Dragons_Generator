import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { FullscreenEnterLink } from '@shared/components/fullscreen-enter-btn/fullscreen-enter-link';
import { PlayTableChat } from '../play-table-chat/play-table-chat';
import { PlayCombatFacade } from './play-combat.facade';
import { PlayImportService } from './play-import.service';
import { PlayTableShellService } from './play-table-shell.service';

@Component({
  selector: 'app-play-table-chrome',
  standalone: true,
  imports: [FullscreenEnterLink, PlayTableChat],
  templateUrl: './play-table-chrome.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayTableChrome {
  readonly combat = inject(PlayCombatFacade);
  readonly shell = inject(PlayTableShellService);
  readonly playImport = inject(PlayImportService);
  readonly tableChat = viewChild(PlayTableChat);
}
