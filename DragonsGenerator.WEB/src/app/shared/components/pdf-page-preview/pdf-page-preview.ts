import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';

// Worker PDF.js (v4) — chemin ESM bundlé par Angular.
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

@Component({
  selector: 'app-pdf-page-preview',
  standalone: true,
  templateUrl: './pdf-page-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfPagePreview implements OnDestroy {
  /** blob: URL du PDF */
  readonly src = input.required<string | null>();
  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('pdfCanvas');

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly page = signal(1);
  readonly pageCount = signal(0);

  private pdf: PDFDocumentProxy | null = null;
  private loadSeq = 0;

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
      const task = getDocument({ url, withCredentials: false });
      const pdf = await task.promise;
      if (seq !== this.loadSeq) {
        await pdf.destroy();
        return;
      }
      this.pdf = pdf;
      this.pageCount.set(pdf.numPages);
      this.page.set(1);
      await this.renderPage();
    } catch (e) {
      if (seq !== this.loadSeq) return;
      this.error.set('Impossible d’afficher le PDF dans le navigateur.');
      console.warn(e);
    } finally {
      if (seq === this.loadSeq) this.loading.set(false);
    }
  }

  private async renderPage(): Promise<void> {
    const pdf = this.pdf;
    const canvas = this.canvasRef()?.nativeElement;
    if (!pdf || !canvas) return;
    const page = await pdf.getPage(this.page());
    const parentW = canvas.parentElement?.clientWidth || 640;
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(2, parentW / unscaled.width);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }
}
