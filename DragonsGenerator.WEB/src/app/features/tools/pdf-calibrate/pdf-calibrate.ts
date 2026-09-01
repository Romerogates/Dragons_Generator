import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  buildCalibrationExport,
  getSheetCalibrationTemplate,
  PDF_SHEET_SIZE,
  resolveSheetCalibrationId,
  SHEET_CALIBRATION_TEMPLATES,
  type SheetCalibrationAnchor,
} from '@core/config/sheet-calibration.config';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import {
  clearCalibrationOverrides,
  loadCalibrationOverrides,
  mergeAnchors,
  saveCalibrationOverrides,
} from '@core/services/sheet-calibration.storage';

@Component({
  selector: 'app-pdf-calibrate',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './pdf-calibrate.html',
  styleUrl: './pdf-calibrate.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfCalibratePage {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pdfService = inject(PdfGeneratorService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly sheetSize = PDF_SHEET_SIZE;
  readonly templates = SHEET_CALIBRATION_TEMPLATES;
  readonly exporting = signal(false);
  readonly realPreviewUrl = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly draggingId = signal<string | null>(null);

  private readonly allOverrides = signal(loadCalibrationOverrides());

  readonly sheetId = computed(() => {
    const fromSheet = this.route.snapshot.paramMap.get('sheetId');
    const fromKind = this.route.snapshot.paramMap.get('kind');
    const raw = fromSheet ?? fromKind ?? 'sheet-page1';
    return resolveSheetCalibrationId(raw);
  });

  readonly isGrimoire = computed(() => this.sheetId().startsWith('grimoire-'));

  readonly template = computed(() => getSheetCalibrationTemplate(this.sheetId()));

  readonly anchors = computed((): SheetCalibrationAnchor[] => {
    const tpl = this.template();
    if (!tpl) return [];
    return mergeAnchors(tpl.anchors, this.allOverrides()[tpl.id]);
  });

  readonly selectedAnchor = computed(() => {
    const id = this.selectedId();
    return this.anchors().find((a) => a.id === id) ?? null;
  });

  readonly safePreviewUrl = computed(() => {
    const url = this.realPreviewUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  readonly groupedAnchors = computed(() => {
    const groups = new Map<string, SheetCalibrationAnchor[]>();
    for (const a of this.anchors()) {
      const list = groups.get(a.group) ?? [];
      list.push(a);
      groups.set(a.group, list);
    }
    return [...groups.entries()];
  });

  circlePreviewIndices(anchor: SheetCalibrationAnchor): number[] {
    if (anchor.render === 'circle-row') {
      const count = anchor.circleCount ?? 5;
      return Array.from({ length: count }, (_, i) => i);
    }
    return [0];
  }

  anchorCircleX(anchor: SheetCalibrationAnchor, index: number): number {
    const spacing = anchor.circleSpacing ?? 15;
    return anchor.x + index * spacing;
  }

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.selectedId.set(null);
    });
  }

  selectSheet(sheetId: string): void {
    window.location.href = `/tools/pdf-calibrate/${sheetId}`;
  }

  selectAnchor(id: string): void {
    this.selectedId.set(id);
  }

  updateSelected(field: 'sampleText' | 'fontSize' | 'label', value: string | number): void {
    const id = this.selectedId();
    if (!id) return;
    this.patchAnchors((list) =>
      list.map((a) => {
        if (a.id !== id) return a;
        if (field === 'fontSize') return { ...a, fontSize: Number(value) || 10 };
        return { ...a, [field]: value };
      }),
    );
  }

  resetSheet(): void {
    const tpl = this.template();
    if (!tpl) return;
    const next = { ...this.allOverrides() };
    delete next[tpl.id];
    this.persistAll(next);
    this.selectedId.set(null);
  }

  resetAll(): void {
    clearCalibrationOverrides();
    this.allOverrides.set({});
    this.selectedId.set(null);
  }

  exportAllJson(): void {
    const json = JSON.stringify(buildCalibrationExport(this.allOverrides()), null, 2);
    void navigator.clipboard.writeText(json);
    this.downloadJson(json, 'pdf-calibration-all.json');
  }

  exportSheetJson(): void {
    const tpl = this.template();
    if (!tpl) return;
    const payload = {
      sheetId: tpl.id,
      title: tpl.title,
      anchors: this.anchors(),
    };
    const json = JSON.stringify(payload, null, 2);
    void navigator.clipboard.writeText(json);
    this.downloadJson(json, `pdf-calibration-${tpl.id}.json`);
  }

  async downloadPreviewPdf(): Promise<void> {
    const tpl = this.template();
    if (!tpl) return;
    this.exporting.set(true);
    try {
      if (this.isGrimoire()) {
        await this.refreshRealPreview();
        const url = this.realPreviewUrl();
        if (url) {
          const a = document.createElement('a');
          a.href = url;
          a.download = `calibration-${tpl.id}-reel.pdf`;
          a.click();
        }
        return;
      }
      await this.pdfService.generateSheetCalibrationPdf(tpl.id, tpl.imageUrl, this.anchors());
    } finally {
      this.exporting.set(false);
    }
  }

  async refreshRealPreview(): Promise<void> {
    if (!this.isGrimoire()) return;
    this.exporting.set(true);
    try {
      const prev = this.realPreviewUrl();
      if (prev) URL.revokeObjectURL(prev);
      const url = await this.pdfService.generateGrimoireCalibrationPreviewBlob(this.anchors());
      this.realPreviewUrl.set(url);
    } finally {
      this.exporting.set(false);
    }
  }

  onCanvasPointerDown(event: PointerEvent, anchorId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedId.set(anchorId);
    this.draggingId.set(anchorId);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    const dragId = this.draggingId();
    if (!dragId) return;
    const coords = this.pointerToSheet(event.clientX, event.clientY);
    if (!coords) return;
    this.patchAnchors((list) =>
      list.map((a) => (a.id === dragId ? { ...a, x: coords.x, y: coords.y } : a)),
    );
  }

  onCanvasPointerUp(event: PointerEvent): void {
    if (this.draggingId()) {
      this.draggingId.set(null);
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  private patchAnchors(mapper: (list: SheetCalibrationAnchor[]) => SheetCalibrationAnchor[]): void {
    const tpl = this.template();
    if (!tpl) return;
    const updated = mapper(this.anchors());
    const next = { ...this.allOverrides(), [tpl.id]: updated };
    this.persistAll(next);
  }

  private persistAll(data: Record<string, SheetCalibrationAnchor[]>): void {
    saveCalibrationOverrides(data);
    this.allOverrides.set(data);
  }

  private pointerToSheet(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = document.querySelector<HTMLElement>('.calibrate-canvas');
    const img = canvas?.querySelector('img');
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const x = Math.round(((clientX - rect.left) / rect.width) * PDF_SHEET_SIZE.width);
    const y = Math.round(((clientY - rect.top) / rect.height) * PDF_SHEET_SIZE.height);
    return {
      x: Math.max(0, Math.min(PDF_SHEET_SIZE.width, x)),
      y: Math.max(0, Math.min(PDF_SHEET_SIZE.height, y)),
    };
  }

  private downloadJson(json: string, filename: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
