import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  getDocument,
  GlobalWorkerOptions,
  version,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist';

/**
 * nginx sert souvent `.mjs` en `application/octet-stream` → Chrome refuse le module worker.
 * On recharge le worker en Blob `text/javascript` pour forcer un MIME valide.
 */
let workerReady: Promise<void> | null = null;

function ensurePdfWorker(): Promise<void> {
  if (!workerReady) {
    workerReady = (async () => {
      const assetUrl = `/assets/pdfjs/pdf.worker.min.mjs?v=${version}`;
      try {
        const res = await fetch(assetUrl);
        if (!res.ok) throw new Error(`worker HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const blob = new Blob([buf], { type: 'text/javascript' });
        GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
      } catch (e) {
        console.warn('[pdf-page-preview] worker blob fallback failed', e);
        GlobalWorkerOptions.workerSrc = assetUrl;
      }
    })();
  }
  return workerReady;
}

export type PdfPreviewMode = 'pager' | 'strip';

@Component({
  selector: 'app-pdf-page-preview',
  standalone: true,
  templateUrl: './pdf-page-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfPagePreview implements OnDestroy {
  /** blob: URL du PDF */
  readonly src = input.required<string | null>();
  /** pager = une page + flèches ; strip = toutes les pages empilées */
  readonly mode = input<PdfPreviewMode>('pager');
  /** Émis si PDF.js ne peut pas charger — le parent peut basculer sur iframe. */
  readonly loadFailed = output<void>();

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('pdfCanvas');
  readonly stripCanvases = viewChildren<ElementRef<HTMLCanvasElement>>('stripCanvas');
  private readonly injector = inject(Injector);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageCount = signal(0);
  /** Indices 1..N pour le mode strip (évite Array.from dans le template). */
  readonly pageIndexes = signal<number[]>([]);

  private pdf: PDFDocumentProxy | null = null;
  private loadSeq = 0;
  private failedEmitted = false;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private renderSeq = 0;
  private renderTasks: RenderTask[] = [];

  constructor() {
    effect(() => {
      const url = this.src();
      // Recharger aussi si le mode change avec la même URL.
      this.mode();
      void this.loadPdf(url);
    });
  }

  ngOnDestroy(): void {
    this.teardownResize();
    this.cancelRenders();
    void this.pdf?.destroy();
    this.pdf = null;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (this.mode() !== 'pager') return;
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const t = ev.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') {
      ev.preventDefault();
      void this.prevPage();
    } else if (ev.key === 'ArrowRight' || ev.key === 'PageDown') {
      ev.preventDefault();
      void this.nextPage();
    }
  }

  async prevPage(): Promise<void> {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    await this.renderPagerPage();
  }

  async nextPage(): Promise<void> {
    if (this.page() >= this.pageCount()) return;
    this.page.update((p) => p + 1);
    await this.renderPagerPage();
  }

  private async loadPdf(url: string | null): Promise<void> {
    const seq = ++this.loadSeq;
    this.failedEmitted = false;
    this.teardownResize();
    this.cancelRenders();
    await this.pdf?.destroy();
    this.pdf = null;
    this.page.set(1);
    this.pageCount.set(0);
    this.pageIndexes.set([]);
    this.error.set(null);

    if (!url) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      await ensurePdfWorker();
      if (seq !== this.loadSeq) return;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch PDF ${res.status}`);
      const data = new Uint8Array(await res.arrayBuffer());
      if (seq !== this.loadSeq) return;

      const task = getDocument({ data, isEvalSupported: false });
      const pdf = await task.promise;
      if (seq !== this.loadSeq) {
        await pdf.destroy();
        return;
      }
      this.pdf = pdf;
      this.pageCount.set(pdf.numPages);
      this.pageIndexes.set(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
      this.page.set(1);
      this.loading.set(false);

      await new Promise<void>((resolve) => {
        afterNextRender(() => resolve(), { injector: this.injector });
      });
      if (seq !== this.loadSeq) return;

      if (this.mode() === 'strip') {
        const ready = await this.waitForStripCanvases(pdf.numPages);
        if (seq !== this.loadSeq) return;
        if (!ready) throw new Error('canvas strip indisponible');
        await this.renderAllPages();
      } else {
        await this.waitForLayout();
        if (seq !== this.loadSeq) return;
        await this.renderPagerPage();
      }
      if (seq !== this.loadSeq) return;
      // Observer après le 1er rendu : sinon le resize du canvas relance un paint concurrent.
      this.bindResizeObserver();
    } catch (e) {
      if (seq !== this.loadSeq) return;
      console.warn('[pdf-page-preview]', e);
      this.error.set('Impossible d’afficher le PDF dans le navigateur.');
      this.loading.set(false);
      if (!this.failedEmitted) {
        this.failedEmitted = true;
        this.loadFailed.emit();
      }
    }
  }

  private async waitForStripCanvases(expected: number): Promise<boolean> {
    for (let i = 0; i < 24; i++) {
      if (this.stripCanvases().length >= expected) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        return true;
      }
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
    return this.stripCanvases().length > 0;
  }

  private async waitForLayout(): Promise<void> {
    for (let i = 0; i < 12; i++) {
      const el =
        this.mode() === 'strip'
          ? this.stripCanvases()[0]?.nativeElement?.parentElement
          : this.canvasRef()?.nativeElement?.parentElement;
      if (el && el.clientWidth > 32 && el.clientHeight > 32) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        return;
      }
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
  }

  private teardownResize(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeTimer != null) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }

  private bindResizeObserver(): void {
    const canvas =
      this.mode() === 'strip'
        ? this.stripCanvases()[0]?.nativeElement
        : this.canvasRef()?.nativeElement;
    const parent =
      this.mode() === 'strip'
        ? canvas?.closest('[data-pdf-preview-root]') ?? canvas?.parentElement
        : canvas?.parentElement;
    if (!parent) return;
    this.teardownResize();
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeTimer != null) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.resizeTimer = null;
        if (this.mode() === 'strip') void this.renderAllPages();
        else void this.renderPagerPage();
      }, 80);
    });
    this.resizeObserver.observe(parent);
  }

  private cancelRenders(): void {
    for (const task of this.renderTasks) {
      try {
        task.cancel();
      } catch {
        /* ignore */
      }
    }
    this.renderTasks = [];
  }

  private async renderPagerPage(): Promise<void> {
    const pdf = this.pdf;
    const canvas = this.canvasRef()?.nativeElement;
    if (!pdf || !canvas) return;
    const seq = ++this.renderSeq;
    this.cancelRenders();

    const page = await pdf.getPage(this.page());
    if (seq !== this.renderSeq) return;

    const parent = canvas.parentElement;
    await this.paintPage(page, canvas, parent, seq, { fitHeight: true });
  }

  private async renderAllPages(): Promise<void> {
    const pdf = this.pdf;
    const refs = this.stripCanvases();
    if (!pdf || !refs.length) return;
    const seq = ++this.renderSeq;
    this.cancelRenders();

    // Une largeur commune basée sur le conteneur scrollable.
    const root = refs[0]?.nativeElement?.closest('[data-pdf-preview-root]') as HTMLElement | null;
    const widthHost = root ?? refs[0]?.nativeElement?.parentElement;

    for (let i = 0; i < refs.length; i++) {
      if (seq !== this.renderSeq) return;
      const canvas = refs[i]?.nativeElement;
      if (!canvas) continue;
      const page = await pdf.getPage(i + 1);
      if (seq !== this.renderSeq) return;
      await this.paintPage(page, canvas, widthHost, seq, { fitHeight: false });
    }
  }

  private async paintPage(
    page: PDFPageProxy,
    canvas: HTMLCanvasElement,
    host: HTMLElement | null | undefined,
    seq: number,
    opts: { fitHeight: boolean },
  ): Promise<void> {
    if (seq !== this.renderSeq) return;

    const pad = 16;
    const parentW = Math.max(120, (host?.clientWidth || 640) - pad);
    const parentH = Math.max(160, (host?.clientHeight || 800) - pad);
    const unscaled = page.getViewport({ scale: 1 });
    const fit = opts.fitHeight
      ? Math.min(parentW / unscaled.width, parentH / unscaled.height)
      : parentW / unscaled.width;
    const cssScale = Math.min(2, Math.max(0.35, fit));
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const viewport = page.getViewport({ scale: cssScale * dpr });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const task = page.render({ canvasContext: ctx, viewport });
    this.renderTasks.push(task);
    try {
      await task.promise;
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === 'RenderingCancelledException') return;
      throw e;
    } finally {
      this.renderTasks = this.renderTasks.filter((t) => t !== task);
    }
  }
}
