import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PATCH_NOTES, type PatchNote } from '@core/data/patch-notes';

export type PatchNotesAudience = 'player' | 'tech';

@Component({
  selector: 'app-patch-notes-list',
  standalone: true,
  templateUrl: './patch-notes-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatchNotesList {
  readonly audience = input<PatchNotesAudience>('player');
  readonly notes = input<readonly PatchNote[]>(PATCH_NOTES);
  /** Accueil : n’afficher que les n dernières versions. 0 = tout. */
  readonly limit = input(0);

  readonly entries = computed(() => {
    const tech = this.audience() === 'tech';
    const list = this.notes()
      .map((n) => ({ ...n, items: tech ? n.tech : n.player }))
      .filter((n) => n.items.length > 0);
    const n = this.limit();
    return n > 0 ? list.slice(0, n) : list;
  });

  formatDate(iso: string): string {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
