import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PatchNotesList } from '@shared/components/patch-notes-list/patch-notes-list';

@Component({
  selector: 'app-patch-notes-page',
  standalone: true,
  imports: [PatchNotesList, RouterLink],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-10">
      <h1 class="font-serif text-3xl font-bold text-amber-500 mb-2">Nouveautés</h1>
      <p class="text-sm text-slate-400 mb-8">
        Tout ce qui change sur Dragons Generator, version après version. Un souci ou une idée ?
        <a routerLink="/support" class="text-amber-400 hover:underline">Écrivez-nous</a>.
      </p>
      <app-patch-notes-list audience="player" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatchNotesPage {}
