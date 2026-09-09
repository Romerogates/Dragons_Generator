import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CampaignSession,
  NotebookPage,
  SESSION_PLAY_PAD_MAX,
  SessionChecklistItem,
  SessionPlayPad,
  createChecklistItem,
  createSessionPlayPad,
} from '@core/models/Campaign/campaign';
import {
  archivePlayPadsText,
  ensureSessionPlayPads,
  ensureSessionResume,
  syncLegacyPlayNotesFromPads,
} from '@core/utils/notebook.util';
import { CampaignNotebook } from '../campaign-notebook/campaign-notebook';

@Component({
  selector: 'app-campaign-session-notes',
  standalone: true,
  imports: [FormsModule, CampaignNotebook],
  templateUrl: './campaign-session-notes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignSessionNotes {
  readonly session = input.required<CampaignSession>();
  readonly sessionResume = input<NotebookPage | null>(null);
  readonly compact = input(false);

  readonly resumeChange = output<NotebookPage>();
  readonly padsChange = output<{
    playPads: SessionPlayPad[];
    playNotes: string;
    playNotebook: NotebookPage | undefined;
  }>();

  readonly resumeCollapsed = signal(false);
  readonly padMax = SESSION_PLAY_PAD_MAX;

  readonly resumePage = computed(() => ensureSessionResume(this.sessionResume()));

  readonly pads = computed(() => ensureSessionPlayPads(this.session()));

  toggleResume(): void {
    this.resumeCollapsed.update((v) => !v);
  }

  onResumePageChange(page: NotebookPage): void {
    this.resumeChange.emit({ ...page, title: page.title?.trim() || 'Résumé' });
  }

  addNotePad(): void {
    const current = this.pads();
    if (current.length >= this.padMax) return;
    const pad = createSessionPlayPad('note', `Notes ${current.length + 1}`, current.length);
    this.emitPads([...current, pad]);
  }

  addChecklistPad(): void {
    const current = this.pads();
    if (current.length >= this.padMax) return;
    const pad = createSessionPlayPad('checklist', `Liste ${current.length + 1}`, current.length);
    this.emitPads([...current, pad]);
  }

  togglePad(id: string): void {
    this.emitPads(
      this.pads().map((p) => (p.id === id ? { ...p, collapsed: !p.collapsed } : p)),
    );
  }

  setPadTitle(id: string, title: string): void {
    this.emitPads(
      this.pads().map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, title };
        if (next.kind === 'note' && next.page) {
          next.page = { ...next.page, title, updatedAt: new Date().toISOString() };
        }
        return next;
      }),
    );
  }

  movePad(id: string, dir: -1 | 1): void {
    const list = [...this.pads()].sort((a, b) => a.order - b.order);
    const idx = list.findIndex((p) => p.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const tmp = list[idx]!;
    list[idx] = list[swap]!;
    list[swap] = tmp;
    this.emitPads(list.map((p, i) => ({ ...p, order: i })));
  }

  removePad(id: string): void {
    const list = this.pads();
    if (list.length <= 1) {
      alert('Gardez au moins un calepin.');
      return;
    }
    if (!confirm('Supprimer ce calepin ?')) return;
    this.emitPads(
      list
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, order: i })),
    );
  }

  onPadPageChange(id: string, page: NotebookPage): void {
    this.emitPads(
      this.pads().map((p) =>
        p.id === id && p.kind === 'note'
          ? { ...p, title: p.title || page.title, page: { ...page, title: p.title || page.title } }
          : p,
      ),
    );
  }

  addChecklistItem(padId: string): void {
    this.emitPads(
      this.pads().map((p) => {
        if (p.id !== padId || p.kind !== 'checklist') return p;
        return { ...p, items: [...(p.items ?? []), createChecklistItem('')] };
      }),
    );
  }

  updateChecklistItem(padId: string, itemId: string, patch: Partial<SessionChecklistItem>): void {
    this.emitPads(
      this.pads().map((p) => {
        if (p.id !== padId || p.kind !== 'checklist') return p;
        return {
          ...p,
          items: (p.items ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
        };
      }),
    );
  }

  removeChecklistItem(padId: string, itemId: string): void {
    this.emitPads(
      this.pads().map((p) => {
        if (p.id !== padId || p.kind !== 'checklist') return p;
        const items = (p.items ?? []).filter((it) => it.id !== itemId);
        return { ...p, items: items.length ? items : [createChecklistItem('')] };
      }),
    );
  }

  /** Exposé pour tests / archive. */
  archiveText(): string {
    return archivePlayPadsText(this.pads());
  }

  private emitPads(pads: SessionPlayPad[]): void {
    const normalized = pads.map((p, i) => ({ ...p, order: i }));
    const legacy = syncLegacyPlayNotesFromPads(normalized);
    this.padsChange.emit({
      playPads: normalized,
      playNotes: legacy.playNotes,
      playNotebook: legacy.playNotebook,
    });
  }
}
