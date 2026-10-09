import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { drawDungeonToCanvas } from '@core/utils/dungeon-render.util';
import type { DungeonMapsHost } from './dungeon-maps-host';

const PREVIEW_CELL = 4;

@Component({
  selector: 'app-dungeon-maps-generator',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dungeon-maps-generator.html',
  styleUrl: './campaign-dungeon-maps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DungeonMapsGenerator {
  readonly host = input.required<DungeonMapsHost>();
  readonly previewCanvas = viewChild<ElementRef<HTMLCanvasElement>>('previewCanvas');

  constructor() {
    effect(() => {
      const h = this.host();
      const preview = h.gen.previewMap();
      const canvas = this.previewCanvas()?.nativeElement;
      if (!h.gen.showGenerator()) return;
      if (!canvas) return;
      if (!preview) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = 320;
          canvas.height = 240;
          ctx.fillStyle = '#0f1218';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }
      drawDungeonToCanvas(preview, canvas, PREVIEW_CELL, {
        showRoomNumbers: true,
        vignette: true,
        edgePadCells: 1,
      });
    });
  }
}
