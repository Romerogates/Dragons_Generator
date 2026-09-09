import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  InkStroke,
  NOTEBOOK_MAX_PAGES,
  NotebookPage,
  createNotebookPage,
} from '@core/models/Campaign/campaign';
import { exportInkDataUrl, redrawInkStrokes } from '@core/utils/notebook.util';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-campaign-notebook',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './campaign-notebook.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignNotebook implements OnDestroy {
  private readonly data = inject(DataService);
  /** Liste de pages (carnet campagne). Si null, mode page unique (session). */
  readonly pages = input<NotebookPage[] | null>(null);
  readonly page = input.required<NotebookPage>();
  readonly compact = input(false);
  readonly showPageList = input(true);
  /** Masque en-tête Carnet + champ titre (calepin parent). */
  readonly embedded = input(false);
  readonly maxPages = input(NOTEBOOK_MAX_PAGES);

  readonly pageChange = output<NotebookPage>();
  readonly pagesChange = output<NotebookPage[]>();

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('inkCanvas');

  readonly penColors = ['#e2e8f0', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#f87171'] as const;
  readonly penColor = signal<string>('#e2e8f0');
  readonly penWidth = signal(2.5);
  readonly erasing = signal(false);
  readonly inkTool = signal<'pen' | 'highlighter'>('pen');
  readonly canUndo = signal(false);
  readonly transcribing = signal(false);
  readonly transcribeError = signal<string | null>(null);
  readonly inkFullscreen = signal(false);

  private drawing = false;
  private currentStroke: InkStroke | null = null;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPageId: string | null = null;
  private lastStrokeCount = -1;
  private inkSizeLocked = false;

  constructor() {
    effect(() => {
      const page = this.page();
      if (!this.inkFullscreen()) return;
      if (this.drawing) return;
      const strokeCount = page.inkStrokes?.length ?? 0;
      const idChanged = this.lastPageId !== page.id;
      const strokesChanged = strokeCount !== this.lastStrokeCount;
      this.lastPageId = page.id;
      this.lastStrokeCount = strokeCount;
      this.canUndo.set(strokeCount > 0);
      if (!idChanged && !strokesChanged) return;
      queueMicrotask(() => {
        if (this.drawing || !this.inkFullscreen()) return;
        if (idChanged) {
          this.inkSizeLocked = false;
          this.setupFullscreenCanvasSize();
        }
        this.paintPage();
      });
    });
  }

  ngOnDestroy(): void {
    if (this.emitTimer) clearTimeout(this.emitTimer);
    this.unlockBodyScroll();
  }

  listPages(): NotebookPage[] {
    return this.pages() ?? [this.page()];
  }

  hasInkPreview(): boolean {
    const p = this.page();
    return !!(p.inkImageDataUrl || (p.inkStrokes?.length ?? 0) > 0);
  }

  openInkFullscreen(): void {
    this.transcribeError.set(null);
    this.inkFullscreen.set(true);
    this.inkSizeLocked = false;
    this.lockBodyScroll();
    const next: NotebookPage = {
      ...this.page(),
      mode: 'ink',
      updatedAt: new Date().toISOString(),
    };
    if (this.page().mode !== 'ink') this.emitPage(next);
    queueMicrotask(() => {
      this.setupFullscreenCanvasSize();
      this.paintPage();
    });
  }

  closeInkFullscreen(toText = true): void {
    const canvas = this.canvasRef()?.nativeElement;
    let page = this.page();
    if (canvas && (page.inkStrokes?.length ?? 0) > 0) {
      page = {
        ...page,
        inkImageDataUrl: exportInkDataUrl(canvas),
        mode: toText ? 'text' : 'ink',
        updatedAt: new Date().toISOString(),
      };
      this.emitPage(page);
    } else if (toText && page.mode !== 'text') {
      this.emitPage({ ...page, mode: 'text', updatedAt: new Date().toISOString() });
    }
    this.inkFullscreen.set(false);
    this.inkSizeLocked = false;
    this.unlockBodyScroll();
  }

  selectPage(id: string): void {
    const list = this.pages();
    if (!list) return;
    const next = list.find((p) => p.id === id);
    if (next) this.pageChange.emit(next);
  }

  addPage(): void {
    const list = [...(this.pages() ?? [])];
    if (list.length >= this.maxPages()) return;
    const page = createNotebookPage(`Page ${list.length + 1}`);
    list.push(page);
    this.pagesChange.emit(list);
    this.pageChange.emit(page);
  }

  removePage(id: string): void {
    const list = this.pages();
    if (!list || list.length <= 1) return;
    if (!confirm('Supprimer cette page du carnet ?')) return;
    const next = list.filter((p) => p.id !== id);
    this.pagesChange.emit(next);
    this.pageChange.emit(next[0]!);
  }

  onTitleChange(title: string): void {
    this.emitPage({ ...this.page(), title, updatedAt: new Date().toISOString() });
  }

  onTextChange(text: string): void {
    this.emitPageDebounced({
      ...this.page(),
      text,
      mode: 'text',
      updatedAt: new Date().toISOString(),
    });
  }

  setPenWidth(width: number): void {
    this.penWidth.set(Math.max(1, Math.min(12, +width || 2.5)));
  }

  setPenColor(color: string): void {
    this.penColor.set(color);
    this.erasing.set(false);
  }

  setInkTool(tool: 'pen' | 'highlighter'): void {
    this.inkTool.set(tool);
    this.erasing.set(false);
    if (tool === 'highlighter' && this.penWidth() < 8) this.penWidth.set(12);
  }

  toggleEraser(): void {
    this.erasing.update((v) => !v);
  }

  undoStroke(): void {
    const strokes = [...(this.page().inkStrokes ?? [])];
    if (!strokes.length) return;
    strokes.pop();
    this.lastStrokeCount = strokes.length;
    this.canUndo.set(strokes.length > 0);
    const canvas = this.canvasRef()?.nativeElement;
    const next: NotebookPage = {
      ...this.page(),
      mode: 'ink',
      inkStrokes: strokes,
      inkImageDataUrl: undefined,
      updatedAt: new Date().toISOString(),
    };
    this.emitPage(next);
    queueMicrotask(() => {
      this.paintPage();
      if (canvas) {
        this.emitPage({
          ...next,
          inkImageDataUrl: exportInkDataUrl(canvas),
        });
      }
    });
  }

  clearInk(): void {
    if (!confirm('Effacer tout le dessin de cette page ?')) return;
    this.paintBlank();
    this.canUndo.set(false);
    this.emitPage({
      ...this.page(),
      inkStrokes: [],
      inkImageDataUrl: undefined,
      mode: 'ink',
      updatedAt: new Date().toISOString(),
    });
  }

  exportCurrentPng(): void {
    const page = this.page();
    let url = page.inkImageDataUrl;
    const canvas = this.canvasRef()?.nativeElement;
    if (!url && canvas && this.inkFullscreen()) url = exportInkDataUrl(canvas);
    if (!url) {
      alert('Rien à exporter — dessine d’abord à la main.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(page.title || 'carnet').replace(/\s+/g, '-')}.jpg`;
    a.click();
  }

  async exportInkPdf(): Promise<void> {
    const list = this.listPages().filter((p) => p.inkImageDataUrl || (p.inkStrokes?.length ?? 0) > 0);
    if (!list.length) {
      alert('Aucune page manuscrite à exporter.');
      return;
    }
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const margin = 36;
    const maxW = doc.internal.pageSize.getWidth() - margin * 2;
    const maxH = doc.internal.pageSize.getHeight() - margin * 2 - 24;
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!;
      if (i > 0) doc.addPage();
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text(p.title || `Page ${i + 1}`, margin, margin);
      let dataUrl = p.inkImageDataUrl;
      if (!dataUrl && p.id === this.page().id) {
        const canvas = this.canvasRef()?.nativeElement;
        if (canvas) dataUrl = exportInkDataUrl(canvas);
      }
      if (!dataUrl) continue;
      const props = doc.getImageProperties(dataUrl);
      let w = maxW;
      let h = (props.height * w) / props.width;
      if (h > maxH) {
        h = maxH;
        w = (props.width * h) / props.height;
      }
      doc.addImage(dataUrl, 'JPEG', margin, margin + 16, w, h);
    }
    doc.save('carnet-manuscrit.pdf');
  }

  transcribeInk(): void {
    if (this.transcribing()) return;
    const canvas = this.canvasRef()?.nativeElement;
    let dataUrl = this.page().inkImageDataUrl;
    if (!dataUrl && canvas) dataUrl = exportInkDataUrl(canvas);
    if (!dataUrl) {
      this.transcribeError.set('Rien à transcrire — dessine d’abord.');
      return;
    }
    this.transcribing.set(true);
    this.transcribeError.set(null);
    this.data.transcribeNotebook(dataUrl).subscribe({
      next: (res) => {
        this.transcribing.set(false);
        const text = (res.text || '').trim();
        const prev = (this.page().text || '').trim();
        const merged = prev ? `${prev}\n\n--- Transcription ---\n\n${text}` : text;
        this.emitPage({
          ...this.page(),
          text: merged,
          mode: 'text',
          updatedAt: new Date().toISOString(),
        });
        this.closeInkFullscreen(true);
      },
      error: (err) => {
        this.transcribing.set(false);
        const msg =
          err?.error?.errors?.[0]?.reason ||
          err?.error?.message ||
          'Transcription impossible (IA indisponible).';
        this.transcribeError.set(typeof msg === 'string' ? msg : 'Transcription impossible.');
      },
    });
  }

  onPointerDown(ev: PointerEvent): void {
    if (!this.inkFullscreen()) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    this.drawing = true;
    const pt = this.pointerToCanvas(ev, canvas);
    const tool = this.inkTool();
    const width = this.erasing()
      ? Math.max(10, this.penWidth() * 4)
      : tool === 'highlighter'
        ? Math.max(8, this.penWidth() * 2)
        : Math.max(2, this.penWidth());
    const color = this.erasing() ? '#171b22' : this.penColor();
    this.currentStroke = {
      color,
      width,
      points: [pt],
      tool: this.erasing() ? 'pen' : tool,
    };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = !this.erasing() && tool === 'highlighter' ? 0.35 : 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(width / 2, 1.75), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  onPointerMove(ev: PointerEvent): void {
    if (!this.drawing || !this.currentStroke) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    ev.preventDefault();
    const pt = this.pointerToCanvas(ev, canvas);
    const prev = this.currentStroke.points[this.currentStroke.points.length - 1]!;
    this.currentStroke.points.push(pt);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.globalAlpha = this.currentStroke.tool === 'highlighter' ? 0.35 : 1;
    ctx.strokeStyle = this.currentStroke.color;
    ctx.lineWidth = this.currentStroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  onPointerUp(ev: PointerEvent): void {
    if (!this.drawing) return;
    this.drawing = false;
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      try {
        canvas.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (!this.currentStroke?.points.length) {
      this.currentStroke = null;
      return;
    }
    const strokes = [...(this.page().inkStrokes ?? []), this.currentStroke];
    const shortTap = this.currentStroke.points.length <= 2;
    this.currentStroke = null;
    this.lastStrokeCount = strokes.length;
    this.canUndo.set(true);
    const imageDataUrl = canvas ? exportInkDataUrl(canvas) : this.page().inkImageDataUrl;
    const next: NotebookPage = {
      ...this.page(),
      mode: 'ink',
      inkStrokes: strokes,
      inkImageDataUrl: imageDataUrl,
      updatedAt: new Date().toISOString(),
    };
    if (shortTap) this.emitPage(next);
    else this.emitPageDebounced(next);
  }

  private pointerToCanvas(ev: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (ev.clientX - rect.left) * scaleX,
      y: (ev.clientY - rect.top) * scaleY,
    };
  }

  private setupFullscreenCanvasSize(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || this.inkSizeLocked) return;
    const parent = canvas.parentElement;
    const cssW = Math.max(320, Math.floor(parent?.clientWidth || window.innerWidth || 800));
    const cssH = Math.max(320, Math.floor(parent?.clientHeight || window.innerHeight * 0.75 || 600));
    canvas.width = cssW;
    canvas.height = cssH;
    this.inkSizeLocked = true;
  }

  private paintBlank(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#171b22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private paintPage(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !this.inkFullscreen()) return;
    this.paintBlank();
    redrawInkStrokes(ctx, this.page().inkStrokes ?? [], false);
  }

  private emitPage(page: NotebookPage): void {
    this.pageChange.emit(page);
    const list = this.pages();
    if (list) {
      this.pagesChange.emit(list.map((p) => (p.id === page.id ? page : p)));
    }
  }

  private emitPageDebounced(page: NotebookPage): void {
    if (this.emitTimer) clearTimeout(this.emitTimer);
    this.emitTimer = setTimeout(() => this.emitPage(page), 280);
  }

  private lockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = '';
  }
}
