import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  GRIMOIRE_IMAGES,
  GRIMOIRE_SHEET,
  listGrimoireCalibrationPoints,
  type GrimoireCalibrationPoint,
} from '@core/config/grimoire-coords.config';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import type { SpellcastingKind } from '@core/models/Character/character';

interface ClickMarker {
  x: number;
  y: number;
}

@Component({
  selector: 'app-grimoire-calibrate',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './grimoire-calibrate.html',
  styleUrl: './grimoire-calibrate.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrimoireCalibratePage {
  private readonly route = inject(ActivatedRoute);
  private readonly pdfService = inject(PdfGeneratorService);

  readonly sheet = GRIMOIRE_SHEET;
  readonly clicks = signal<ClickMarker[]>([]);
  readonly exporting = signal(false);

  readonly kind = computed((): SpellcastingKind => {
    const raw = this.route.snapshot.paramMap.get('kind') ?? 'cleric';
    return raw as SpellcastingKind;
  });

  readonly imageUrl = computed(() => GRIMOIRE_IMAGES[this.kind()] ?? GRIMOIRE_IMAGES.cleric);

  readonly anchors = computed((): GrimoireCalibrationPoint[] =>
    listGrimoireCalibrationPoints(this.kind()),
  );

  onImageClick(event: MouseEvent): void {
    const img = event.currentTarget as HTMLImageElement;
    const rect = img.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * GRIMOIRE_SHEET.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * GRIMOIRE_SHEET.height);
    this.clicks.update((list) => [...list.slice(-19), { x, y }]);
  }

  clearClicks(): void {
    this.clicks.set([]);
  }

  copyAnchorsJson(): void {
    const json = JSON.stringify(this.anchors(), null, 2);
    void navigator.clipboard.writeText(json);
  }

  copyLastClick(): void {
    const last = this.clicks().at(-1);
    if (!last) return;
    void navigator.clipboard.writeText(`x: ${last.x}, y: ${last.y}`);
  }

  async downloadCalibrationPdf(): Promise<void> {
    this.exporting.set(true);
    try {
      await this.pdfService.generateGrimoireCalibrationPdf(this.kind());
    } finally {
      this.exporting.set(false);
    }
  }
}
