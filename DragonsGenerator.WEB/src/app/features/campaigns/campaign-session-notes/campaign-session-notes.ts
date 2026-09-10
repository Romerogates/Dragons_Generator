import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CampaignSession,
  NotebookPage,
  SESSION_PLAY_PAD_MAX,
  SessionChecklistItem,
  SessionPlayPad,
  SessionPlayPadLayout,
  createChecklistItem,
  createSessionPlayPad,
} from '@core/models/Campaign/campaign';
import {
  archivePlayPadsText,
  ensureSessionPlayPads,
  ensureSessionResume,
  syncLegacyPlayNotesFromPads,
} from '@core/utils/notebook.util';
import {
  PAD_DEFAULT_H,
  PAD_DEFAULT_W,
  PAD_GRID_COLS,
  PAD_GRID_ROW_PX,
  PAD_MIN_H,
  PAD_MIN_W,
  boardRowCount,
  clampLayout,
  findFreeLayout,
  layoutsOverlap,
  padGridStyle,
} from '@core/utils/pad-layout.util';
import { CampaignNotebook } from '../campaign-notebook/campaign-notebook';

type DragMode = 'move' | 'resize';

interface DragState {
  padId: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origin: SessionPlayPadLayout;
  colW: number;
}

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

  private readonly boardRef = viewChild<ElementRef<HTMLElement>>('board');

  readonly resumeCollapsed = signal(false);
  readonly editingPadId = signal<string | null>(null);
  /** false = widgets déplaçables / redimensionnables. */
  readonly boardLocked = signal(true);
  readonly dragPreview = signal<Record<string, SessionPlayPadLayout>>({});
  readonly padMax = SESSION_PLAY_PAD_MAX;
  readonly gridCols = PAD_GRID_COLS;
  readonly rowPx = PAD_GRID_ROW_PX;

  private drag: DragState | null = null;

  readonly resumePage = computed(() => ensureSessionResume(this.sessionResume()));
  readonly pads = computed(() => {
    const base = ensureSessionPlayPads(this.session());
    const preview = this.dragPreview();
    if (!Object.keys(preview).length) return base;
    return base.map((p) => (preview[p.id] ? { ...p, layout: preview[p.id] } : p));
  });

  readonly boardRows = computed(() => boardRowCount(this.pads()));

  padStyle(pad: SessionPlayPad): Record<string, string> {
    return padGridStyle(pad.layout ?? { x: 0, y: 0, w: PAD_DEFAULT_W, h: PAD_DEFAULT_H });
  }

  isEditing(padId: string): boolean {
    return this.editingPadId() === padId;
  }

  startEditPad(id: string): void {
    this.editingPadId.set(id);
  }

  stopEditPad(): void {
    this.editingPadId.set(null);
  }

  toggleBoardLock(): void {
    this.boardLocked.update((v) => !v);
  }

  toggleResume(): void {
    this.resumeCollapsed.update((v) => !v);
  }

  onResumePageChange(page: NotebookPage): void {
    this.resumeChange.emit({ ...page, title: page.title?.trim() || 'Résumé' });
  }

  addNotePad(): void {
    const current = this.pads();
    if (current.length >= this.padMax) return;
    const occupied = current.map((p) => p.layout!).filter(Boolean);
    const layout = findFreeLayout(PAD_DEFAULT_W, PAD_DEFAULT_H, occupied);
    const pad = createSessionPlayPad('note', `Notes ${current.length + 1}`, current.length, layout);
    this.emitPads([...current, pad]);
    this.editingPadId.set(pad.id);
  }

  addChecklistPad(): void {
    const current = this.pads();
    if (current.length >= this.padMax) return;
    const occupied = current.map((p) => p.layout!).filter(Boolean);
    const layout = findFreeLayout(PAD_DEFAULT_W, PAD_DEFAULT_H, occupied);
    const pad = createSessionPlayPad(
      'checklist',
      `Liste ${current.length + 1}`,
      current.length,
      layout,
    );
    this.emitPads([...current, pad]);
    this.editingPadId.set(pad.id);
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

  removePad(id: string): void {
    const list = this.pads();
    if (list.length <= 1) {
      alert('Gardez au moins un calepin.');
      return;
    }
    if (!confirm('Supprimer ce calepin ?')) return;
    if (this.editingPadId() === id) this.editingPadId.set(null);
    this.emitPads(list.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i })));
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

  onDragHandlePointerDown(ev: PointerEvent, pad: SessionPlayPad): void {
    if (this.boardLocked()) return;
    this.beginDrag(ev, pad, 'move');
  }

  onResizeHandlePointerDown(ev: PointerEvent, pad: SessionPlayPad): void {
    if (this.boardLocked()) return;
    ev.stopPropagation();
    this.beginDrag(ev, pad, 'resize');
  }

  onBoardPointerMove(ev: PointerEvent): void {
    if (!this.drag) return;
    const dx = ev.clientX - this.drag.startX;
    const dy = ev.clientY - this.drag.startY;
    const dCol = Math.round(dx / this.drag.colW);
    const dRow = Math.round(dy / PAD_GRID_ROW_PX);
    const o = this.drag.origin;
    let next: SessionPlayPadLayout;
    if (this.drag.mode === 'move') {
      next = clampLayout({ ...o, x: o.x + dCol, y: o.y + dRow });
    } else {
      next = clampLayout({
        ...o,
        w: Math.max(PAD_MIN_W, o.w + dCol),
        h: Math.max(PAD_MIN_H, o.h + dRow),
      });
    }
    this.dragPreview.set({ [this.drag.padId]: next });
  }

  onBoardPointerUp(): void {
    if (!this.drag) return;
    const id = this.drag.padId;
    const preview = this.dragPreview()[id];
    this.drag = null;
    this.dragPreview.set({});
    if (!preview) return;

    const others = this.pads()
      .filter((p) => p.id !== id && p.layout)
      .map((p) => p.layout!);
    let layout = clampLayout(preview);
    if (others.some((o) => layoutsOverlap(layout, o))) {
      layout = findFreeLayout(layout.w, layout.h, others, layout.y);
    }
    this.emitPads(this.pads().map((p) => (p.id === id ? { ...p, layout } : p)));
  }

  archiveText(): string {
    return archivePlayPadsText(this.pads());
  }

  /** @deprecated kept for older specs — no-op size buttons removed. */
  setPadWidgetSize(id: string, _size: string): void {
    const pad = this.pads().find((p) => p.id === id);
    if (!pad?.layout) return;
    const w = _size === 'full' ? 12 : _size === 'third' ? 4 : 6;
    this.emitPads(
      this.pads().map((p) =>
        p.id === id ? { ...p, layout: clampLayout({ ...p.layout!, w }), widgetSize: _size as never } : p,
      ),
    );
  }

  movePad(id: string, dir: -1 | 1): void {
    const list = [...this.pads()].sort((a, b) => a.order - b.order);
    const idx = list.findIndex((p) => p.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const a = list[idx]!;
    const b = list[swap]!;
    const la = a.layout ?? { x: 0, y: 0, w: PAD_DEFAULT_W, h: PAD_DEFAULT_H };
    const lb = b.layout ?? { x: 0, y: 0, w: PAD_DEFAULT_W, h: PAD_DEFAULT_H };
    list[idx] = { ...b, layout: { ...la } };
    list[swap] = { ...a, layout: { ...lb } };
    this.emitPads(list.map((p, i) => ({ ...p, order: i })));
  }

  private beginDrag(ev: PointerEvent, pad: SessionPlayPad, mode: DragMode): void {
    const board = this.boardRef()?.nativeElement;
    if (!board || !pad.layout) return;
    ev.preventDefault();
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    const colW = board.clientWidth / PAD_GRID_COLS;
    this.drag = {
      padId: pad.id,
      mode,
      startX: ev.clientX,
      startY: ev.clientY,
      origin: { ...pad.layout },
      colW: Math.max(8, colW),
    };
  }

  private emitPads(pads: SessionPlayPad[]): void {
    const normalized = pads.map((p, i) => ({
      ...p,
      order: i,
      layout: clampLayout(p.layout ?? { x: 0, y: 0, w: PAD_DEFAULT_W, h: PAD_DEFAULT_H }),
    }));
    const legacy = syncLegacyPlayNotesFromPads(normalized);
    this.padsChange.emit({
      playPads: normalized,
      playNotes: legacy.playNotes,
      playNotebook: legacy.playNotebook,
    });
  }
}
