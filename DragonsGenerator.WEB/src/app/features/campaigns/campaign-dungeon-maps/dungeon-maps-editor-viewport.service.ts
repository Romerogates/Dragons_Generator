import { computed, inject, Injectable, signal } from '@angular/core';
import { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import { themePalette } from '@core/utils/dungeon-render.util';
import {
  clampDungeonEditorScale,
  DUNGEON_EDITOR_MAX_SCALE,
  DUNGEON_EDITOR_MIN_SCALE,
} from '@core/utils/dungeon-editor-ui.util';
import {
  dungeonEditorFitPanScale,
  dungeonZoomTowardPointer,
} from '@core/utils/dungeon-map-edit.util';
import { DungeonMapsCore } from './dungeon-maps-core.service';

const MIN_SCALE = DUNGEON_EDITOR_MIN_SCALE;
const MAX_SCALE = DUNGEON_EDITOR_MAX_SCALE;

/** Pan / zoom / plein écran. Persist via le core / store. */
@Injectable()
export class DungeonMapsEditorViewport {
  private readonly core = inject(DungeonMapsCore);

  readonly revealMap = signal(false);
  readonly editorFullscreen = signal(false);
  readonly scale = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);

  private previousBodyOverflow = '';
  private editorBodyLocked = false;

  readonly viewportBg = computed(() =>
    themePalette(this.core.editingMap()?.theme ?? 'generic').bg,
  );

  readonly themeAccent = computed(() =>
    themePalette(this.core.editingMap()?.theme ?? 'generic').accent,
  );

  toggleEditorFullscreen(): void {
    if (this.editorFullscreen()) return;
    this.setEditorFullscreen(true);
  }

  setEditorFullscreen(open: boolean): void {
    if (this.editorFullscreen() === open) return;
    this.editorFullscreen.set(open);
    if (open) {
      if (typeof document !== 'undefined' && !this.editorBodyLocked) {
        this.previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        this.editorBodyLocked = true;
      }
      queueMicrotask(() => this.resetView());
    } else {
      this.unlockEditorBody();
      queueMicrotask(() => this.resetView());
    }
  }

  zoom(delta: number): void {
    this.scale.update((s) => clampDungeonEditorScale(s, delta));
  }

  resetView(): void {
    const map = this.core.editingMap();
    if (map) this.fitMapInView(map);
  }

  fitMapInView(map: CampaignDungeonMap): void {
    const apply = () => {
      const viewport = this.viewportEl();
      const next = dungeonEditorFitPanScale({
        viewportW: viewport?.clientWidth ?? 0,
        viewportH: viewport?.clientHeight ?? 0,
        gridWidth: map.gridWidth,
        gridHeight: map.gridHeight,
      });
      this.scale.set(next.scale);
      this.panX.set(next.panX);
      this.panY.set(next.panY);
    };
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }

  destroy(): void {
    this.unlockEditorBody();
  }

  onWheel(event: WheelEvent): void {
    if (!this.core.editingMap()) return;
    const viewport = this.viewportEl();
    if (!viewport) return;
    const overMap = viewport.contains(event.target as Node);
    if (!event.ctrlKey && !event.metaKey) return;
    if (!overMap) return;

    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const before = this.scale();
    const after = clampDungeonEditorScale(before, event.deltaY > 0 ? -0.12 : 0.12);
    const pan = dungeonZoomTowardPointer({
      mx,
      my,
      panX: this.panX(),
      panY: this.panY(),
      before,
      after,
    });
    if (!pan) return;
    this.scale.set(after);
    this.panX.set(pan.panX);
    this.panY.set(pan.panY);
  }

  clampScale(value: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  }

  viewportEl(): HTMLDivElement | undefined {
    return this.core.viewportEl();
  }

  private unlockEditorBody(): void {
    if (!this.editorBodyLocked || typeof document === 'undefined') return;
    document.body.style.overflow = this.previousBodyOverflow;
    this.editorBodyLocked = false;
  }
}
