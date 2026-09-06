import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  InkStroke,
  NOTEBOOK_MAX_PAGES,
  NotebookMode,
  NotebookPage,
  createNotebookPage,
} from '@core/models/Campaign/campaign';
import { exportInkDataUrl, redrawInkStrokes } from '@core/utils/notebook.util';

@Component({
  selector: 'app-campaign-notebook',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './campaign-notebook.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignNotebook implements AfterViewInit, OnDestroy {
  /** Liste de pages (carnet campagne). Si null, mode page unique (session). */
  readonly pages = input<NotebookPage[] | null>(null);
  readonly page = input.required<NotebookPage>();
  readonly compact = input(false);
  readonly showPageList = input(true);
  readonly maxPages = input(NOTEBOOK_MAX_PAGES);

  readonly pageChange = output<NotebookPage>();
  readonly pagesChange = output<NotebookPage[]>();

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('inkCanvas');

  readonly penColor = signal('#e2e8f0');
  readonly penWidth = signal(2.5);
  readonly erasing = signal(false);

  private drawing = false;
  private currentStroke: InkStroke | null = null;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastPageId: string | null = null;
  private lastStrokeCount = -1;

  constructor() {
    effect(() => {
      const page = this.page();
      if (page.mode !== 'ink') return;
      // Ne pas repaindre pendant un trait (sinon les points disparaissent).
      if (this.drawing) return;
      const strokeCount = page.inkStrokes?.length ?? 0;
      const idChanged = this.lastPageId !== page.id;
      const strokesChanged = strokeCount !== this.lastStrokeCount;
      this.lastPageId = page.id;
      this.lastStrokeCount = strokeCount;
      if (!idChanged && !strokesChanged) return;
      queueMicrotask(() => {
        if (this.drawing) return;
        if (idChanged) this.setupCanvasSize();
        this.paintPage();
      });
    });
  }

  ngAfterViewInit(): void {
    this.setupCanvasSize();
    this.paintPage();
    const canvas = this.canvasRef()?.nativeElement;
    const host = canvas?.parentElement;
    if (host && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.drawing) return;
        this.setupCanvasSize();
        this.paintPage();
      });
      this.resizeObserver.observe(host);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.emitTimer) clearTimeout(this.emitTimer);
  }

  listPages(): NotebookPage[] {
    return this.pages() ?? [this.page()];
  }

  setMode(mode: NotebookMode): void {
    if (this.page().mode === mode) return;
    this.emitPage({ ...this.page(), mode, updatedAt: new Date().toISOString() });
    if (mode === 'ink') {
      queueMicrotask(() => {
        this.setupCanvasSize();
        this.paintPage();
      });
    }
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

  toggleEraser(): void {
    this.erasing.update((v) => !v);
  }

  clearInk(): void {
    if (!confirm('Effacer tout le dessin de cette page ?')) return;
    this.paintBlank();
    this.emitPage({
      ...this.page(),
      inkStrokes: [],
      inkImageDataUrl: undefined,
      mode: 'ink',
      updatedAt: new Date().toISOString(),
    });
  }

  onPointerDown(ev: PointerEvent): void {
    if (this.page().mode !== 'ink') return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    ev.preventDefault();
    canvas.setPointerCapture(ev.pointerId);
    this.drawing = true;
    const pt = this.pointerToCanvas(ev, canvas);
    const width = this.erasing() ? Math.max(10, this.penWidth() * 4) : Math.max(2, this.penWidth());
    const color = this.erasing() ? '#171b22' : this.penColor();
    this.currentStroke = { color, width, points: [pt] };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    // Point immédiat (tap tablette)
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(width / 2, 1.75), 0, Math.PI * 2);
    ctx.fill();
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
    ctx.strokeStyle = this.currentStroke.color;
    ctx.lineWidth = this.currentStroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
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
    const imageDataUrl = canvas ? exportInkDataUrl(canvas) : this.page().inkImageDataUrl;
    const next: NotebookPage = {
      ...this.page(),
      mode: 'ink',
      inkStrokes: strokes,
      inkImageDataUrl: imageDataUrl,
      updatedAt: new Date().toISOString(),
    };
    // Les taps doivent être persistés tout de suite (sinon un repaint les efface).
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

  private setupCanvasSize(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const cssW = Math.max(280, parent?.clientWidth || canvas.clientWidth || 640);
    const cssH = this.compact() ? 280 : Math.max(360, Math.min(520, Math.round(cssW * 0.62)));
    if (canvas.width === cssW && canvas.height === cssH) return;
    canvas.width = cssW;
    canvas.height = cssH;
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
    if (!canvas || !ctx || this.page().mode !== 'ink') return;
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
}
