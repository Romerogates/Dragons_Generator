import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '@core/services/data.service';
import type { Civilisation } from '@core/models/Civilisations/civilisations';
import { StoryRegionChoice } from '@core/models/Story/story';
import { EANA_MAP_RATIO, getEanaMapCoordinates } from '@core/utils/eana-map';
import { storyRegionLabel } from '@core/utils/story-location.util';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.35;

@Component({
  selector: 'app-eana-map-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './eana-map-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EanaMapPicker implements OnInit, OnDestroy {
  readonly selectedRegion = input<StoryRegionChoice | null>(null);
  readonly regionChange = output<StoryRegionChoice>();

  private readonly dataService = inject(DataService);
  private readonly injector = inject(Injector);

  readonly mapViewport = viewChild<ElementRef<HTMLElement>>('mapViewport');

  readonly civilizations = signal<Civilisation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly mapWidth = signal(0);
  readonly mapHeight = signal(0);
  readonly mapReady = signal(false);
  readonly scale = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly isPanning = signal(false);

  readonly regionLabel = computed(() => storyRegionLabel(this.selectedRegion()));
  readonly mapTransform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.scale()})`,
  );
  readonly pinCounterScale = computed(() => 1 / this.scale());
  readonly canZoomOut = computed(() => this.scale() > MIN_SCALE + 0.01);
  readonly canZoomIn = computed(() => this.scale() < MAX_SCALE - 0.01);

  private pointers = new Map<number, { x: number; y: number }>();
  private panOrigin: { x: number; y: number; panX: number; panY: number } | null = null;
  private pinchOrigin: {
    dist: number;
    scale: number;
    panX: number;
    panY: number;
    midX: number;
    midY: number;
  } | null = null;
  private moved = false;
  private resizeObserver: ResizeObserver | null = null;
  private fitRetries = 0;

  constructor() {
    effect(() => {
      const ready = !this.loading() && !this.error();
      if (!ready) {
        untracked(() => {
          this.mapReady.set(false);
          this.resizeObserver?.disconnect();
          this.resizeObserver = null;
        });
        return;
      }
      untracked(() => this.scheduleFit(true));
    });
  }

  ngOnInit(): void {
    this.dataService.getCivilisations().subscribe({
      next: (civs) => {
        this.civilizations.set(civs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger la carte des régions.');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.pointers.clear();
    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.refitMap(this.scale() <= MIN_SCALE + 0.01);
  }

  isSelectedCiv(civId: string): boolean {
    const region = this.selectedRegion();
    return region?.kind === 'civilization' && region.id === civId;
  }

  isUnknownSelected(): boolean {
    return this.selectedRegion()?.kind === 'unknown';
  }

  pickCivilization(civ: Civilisation, event?: Event): void {
    event?.stopPropagation();
    if (this.moved) return;
    this.regionChange.emit({ kind: 'civilization', id: civ.id, name: civ.name });
  }

  pickUnknown(): void {
    this.regionChange.emit({ kind: 'unknown' });
  }

  getIconForCiv(id: string): string {
    const icons: Record<string, string> = {
      'civ-acoatl': 'fluent-emoji:hindu-temple',
      'civ-ajagar': 'fluent-emoji:elephant',
      'civ-arolavie': 'fluent-emoji:evergreen-tree',
      'civ-iles-barbaresques': 'fluent-emoji:sailboat',
      'civ-cite-franche': 'fluent-emoji:classical-building',
      'civ-cyrillane': 'fluent-emoji:crown',
      'civ-drakenbergen': 'fluent-emoji:mountain',
      'civ-ellerina': 'fluent-emoji:herb',
      'civ-iles-eoliennes': 'fluent-emoji:cloud',
      'civ-inframonde': 'fluent-emoji:spider',
      'civ-kaan': 'fluent-emoji:horse',
      'civ-lothrienne': 'fluent-emoji:shield',
      'civ-mibu': 'fluent-emoji:lion',
      'civ-rachamangekr': 'fluent-emoji:dragon',
      'civ-royaumes-des-sables': 'fluent-emoji:desert',
      'civ-septentrion': 'fluent-emoji:snowflake',
      'civ-shi-huang': 'fluent-emoji:japanese-castle',
      'civ-torea': 'fluent-emoji:desert-island',
    };
    return icons[id] || 'fluent-emoji:world-map';
  }

  getMapCoordinates(id: string): { x: number; y: number } {
    return getEanaMapCoordinates(id);
  }

  zoomIn(): void {
    this.zoomAt(this.scale() + ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomAt(this.scale() - ZOOM_STEP);
  }

  resetView(): void {
    this.scale.set(1);
    this.refitMap(true);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const delta = event.deltaY > 0 ? -ZOOM_STEP * 0.6 : ZOOM_STEP * 0.6;
    this.zoomAt(this.scale() + delta, event.clientX - rect.left, event.clientY - rect.top);
  }

  onPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('[data-map-pin]')) {
      this.moved = false;
      return;
    }

    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport) return;

    viewport.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.moved = false;

    if (this.pointers.size === 1) {
      this.panOrigin = {
        x: event.clientX,
        y: event.clientY,
        panX: this.panX(),
        panY: this.panY(),
      };
      this.isPanning.set(true);
    } else if (this.pointers.size === 2) {
      this.isPanning.set(false);
      this.panOrigin = null;
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.pinchOrigin = {
        dist,
        scale: this.scale(),
        panX: this.panX(),
        panY: this.panY(),
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
      };
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2 && this.pinchOrigin) {
      this.isPanning.set(false);
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const viewport = this.mapViewport()?.nativeElement;
      if (!viewport || this.pinchOrigin.dist < 1) return;
      const rect = viewport.getBoundingClientRect();
      const ratio = dist / this.pinchOrigin.dist;
      const nextScale = this.clampScale(this.pinchOrigin.scale * ratio);
      this.applyZoom(
        nextScale,
        midX - rect.left,
        midY - rect.top,
        this.pinchOrigin.scale,
        this.pinchOrigin.panX,
        this.pinchOrigin.panY,
      );
      this.panX.update((x) => x + (midX - this.pinchOrigin!.midX));
      this.panY.update((y) => y + (midY - this.pinchOrigin!.midY));
      this.pinchOrigin = { ...this.pinchOrigin, midX, midY };
      this.clampPan();
      this.moved = true;
      return;
    }

    if (this.panOrigin && this.pointers.size === 1) {
      const dx = event.clientX - this.panOrigin.x;
      const dy = event.clientY - this.panOrigin.y;
      if (Math.hypot(dx, dy) > 4) this.moved = true;
      this.panX.set(this.panOrigin.panX + dx);
      this.panY.set(this.panOrigin.panY + dy);
      this.clampPan();
    }
  }

  onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchOrigin = null;
    if (this.pointers.size === 0) {
      this.panOrigin = null;
      this.isPanning.set(false);
    } else if (this.pointers.size === 1) {
      const remaining = [...this.pointers.entries()][0];
      this.panOrigin = {
        x: remaining[1].x,
        y: remaining[1].y,
        panX: this.panX(),
        panY: this.panY(),
      };
    }
  }

  private scheduleFit(resetScale: boolean): void {
    this.fitRetries = 0;
    afterNextRender(
      () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.bindViewport(resetScale));
        });
      },
      { injector: this.injector },
    );
  }

  private bindViewport(resetScale: boolean): void {
    const el = this.mapViewport()?.nativeElement;
    if (!el) {
      this.retryFit(resetScale);
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      this.refitMap(this.scale() <= MIN_SCALE + 0.01);
    });
    this.resizeObserver.observe(el);

    if (resetScale) this.scale.set(1);
    const ok = this.refitMap(true);
    if (!ok) this.retryFit(resetScale);
  }

  private retryFit(resetScale: boolean): void {
    if (this.fitRetries >= 12) return;
    this.fitRetries += 1;
    requestAnimationFrame(() => this.bindViewport(resetScale));
  }

  private refitMap(center: boolean): boolean {
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport) return false;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (vw < 8 || vh < 8) return false;

    let w: number;
    let h: number;
    if (vw / vh > EANA_MAP_RATIO) {
      h = vh;
      w = h * EANA_MAP_RATIO;
    } else {
      w = vw;
      h = w / EANA_MAP_RATIO;
    }

    this.mapWidth.set(w);
    this.mapHeight.set(h);
    this.mapReady.set(true);

    if (center || this.scale() <= MIN_SCALE + 0.01) {
      this.panX.set((vw - w * this.scale()) / 2);
      this.panY.set((vh - h * this.scale()) / 2);
    } else {
      this.clampPan();
    }
    return true;
  }

  private zoomAt(next: number, localX?: number, localY?: number): void {
    const viewport = this.mapViewport()?.nativeElement;
    const clamped = this.clampScale(next);
    if (!viewport) {
      this.scale.set(clamped);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const cx = localX ?? rect.width / 2;
    const cy = localY ?? rect.height / 2;
    this.applyZoom(clamped, cx, cy, this.scale(), this.panX(), this.panY());
    this.clampPan();
  }

  private applyZoom(
    nextScale: number,
    localX: number,
    localY: number,
    prevScale: number,
    prevPanX: number,
    prevPanY: number,
  ): void {
    const worldX = (localX - prevPanX) / prevScale;
    const worldY = (localY - prevPanY) / prevScale;
    this.scale.set(nextScale);
    this.panX.set(localX - worldX * nextScale);
    this.panY.set(localY - worldY * nextScale);
  }

  private clampScale(v: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
  }

  private clampPan(): void {
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport) return;
    const worldW = this.mapWidth();
    const worldH = this.mapHeight();
    const s = this.scale();
    const scaledW = worldW * s;
    const scaledH = worldH * s;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;

    if (scaledW <= vw) {
      this.panX.set((vw - scaledW) / 2);
    } else {
      this.panX.set(Math.min(0, Math.max(vw - scaledW, this.panX())));
    }

    if (scaledH <= vh) {
      this.panY.set((vh - scaledH) / 2);
    } else {
      this.panY.set(Math.min(0, Math.max(vh - scaledH, this.panY())));
    }
  }
}
