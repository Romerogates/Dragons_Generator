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
} from '@angular/core';
import { getDocument, GlobalWorkerOptions, version, type PDFDocumentProxy } from 'pdfjs-dist';

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

@Component({
  selector: 'app-pdf-page-preview',
  standalone: true,
  templateUrl: './pdf-page-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfPagePreview implements OnDestroy {
  /** blob: URL du PDF */
  readonly src = input.required<string | null>();
  /** Émis si PDF.js ne peut pas charger — le parent peut basculer sur iframe. */
  readonly loadFailed = output<void>();

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('pdfCanvas');
  private readonly injector = inject(Injector);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageCount = signal(0);

  private pdf: PDFDocumentProxy | null = null;
  private loadSeq = 0;
  private failedEmitted = false;
  private resizeObserver: ResizeObserver | null = null;
  private renderSeq = 0;

  constructor() {
    effect(() => {
      const url = this.src();
      void this.loadPdf(url);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    void this.pdf?.destroy();
    this.pdf = null;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
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
    await this.renderPage();
  }

  async nextPage(): Promise<void> {
    if (this.page() >= this.pageCount()) return;
    this.page.update((p) => p + 1);
    await this.renderPage();
  }

  private async loadPdf(url: string | null): Promise<void> {
    const seq = ++this.loadSeq;
    this.failedEmitted = false;
    await this.pdf?.destroy();
    this.pdf = null;
    this.page.set(1);
    this.pageCount.set(0);
    this.error.set(null);

    if (!url) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    try {
      await ensurePdfWorker();
      if (seq !== this.loadSeq) return;

      // Charger en bytes : plus fiable que blob: URL avec le worker.
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
      this.page.set(1);
      this.loading.set(false);
      // Canvas présent seulement hors loading — attendre le prochain rendu DOM.
      await new Promise<void>((resolve) => {
        afterNextRender(() => resolve(), { injector: this.injector });
      });
      if (seq !== this.loadSeq) return;
      this.bindResizeObserver();
      await this.renderPage();
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

  private bindResizeObserver(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const parent = canvas?.parentElement;
    if (!parent) return;
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      void this.renderPage();
    });
    this.resizeObserver.observe(parent);
  }

  private async renderPage(): Promise<void> {
    const pdf = this.pdf;
    const canvas = this.canvasRef()?.nativeElement;
    if (!pdf || !canvas) return;
    const seq = ++this.renderSeq;
    const page = await pdf.getPage(this.page());
    if (seq !== this.renderSeq) return;

    const parent = canvas.parentElement;
    const pad = 16;
    const parentW = Math.max(120, (parent?.clientWidth || 640) - pad);
    const parentH = Math.max(160, (parent?.clientHeight || 800) - pad);
    const unscaled = page.getViewport({ scale: 1 });
    const fit = Math.min(parentW / unscaled.width, parentH / unscaled.height);
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
    await page.render({ canvasContext: ctx, viewport }).promise;
  }
}
