import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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

/** Worker servi en asset Angular (chemin absolu — évite 404 sous /campaigns/…). */
GlobalWorkerOptions.workerSrc = `/assets/pdfjs/pdf.worker.min.mjs?v=${version}`;

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

  constructor() {
    effect(() => {
      const url = this.src();
      void this.loadPdf(url);
    });
  }

  ngOnDestroy(): void {
    void this.pdf?.destroy();
    this.pdf = null;
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

  private async renderPage(): Promise<void> {
    const pdf = this.pdf;
    const canvas = this.canvasRef()?.nativeElement;
    if (!pdf || !canvas) return;
    const page = await pdf.getPage(this.page());
    const parentW = canvas.parentElement?.clientWidth || 640;
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(2, Math.max(0.5, parentW / unscaled.width));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }
}
