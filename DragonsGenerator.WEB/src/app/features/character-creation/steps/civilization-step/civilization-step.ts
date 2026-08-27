// features/character-creation/steps/civilization-step/civilization-step.ts

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  untracked,
  Injector,
  afterNextRender,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  viewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '@core/services/data.service';
import {
  CharacterBuilderService,
  CivilizationSelection,
} from '@core/services/character-builder.service';
import type { Civilisation } from '@core/models/Civilisations/civilisations';
import { EANA_MAP_RATIO, getEanaMapCoordinates } from '@core/utils/eana-map';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.35;

@Component({
  selector: 'app-civilization-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './civilization-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: {
    class: 'flex flex-1 flex-col min-h-0 w-full',
  },
})
export class CivilizationStep implements OnInit, OnDestroy {
  private dataService = inject(DataService);
  private injector = inject(Injector);
  readonly builder = inject(CharacterBuilderService);

  readonly mapViewport = viewChild<ElementRef<HTMLElement>>('mapViewport');

  readonly allCivilizations = signal<Civilisation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedCivId = signal<string | null>(null);

  /** Fitted map size inside viewport (contain). */
  readonly mapWidth = signal(0);
  readonly mapHeight = signal(0);
  /** True once measured — avoids native-size flash (looks mega-zoomed). */
  readonly mapReady = signal(false);

  /** Map camera */
  readonly scale = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly isPanning = signal(false);

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
    // Whenever the atlas map is shown, fit it after Angular paints the DOM.
    effect(() => {
      const showMap = !this.loading() && !this.error() && !this.selectedCivId();
      if (!showMap) {
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

  readonly selectedCiv = computed<Civilisation | null>(() => {
    const id = this.selectedCivId();
    if (!id) return null;
    return this.allCivilizations().find((c) => c.id === id) ?? null;
  });

  readonly officialLanguages = computed<string[]>(() => {
    return this.selectedCiv()?.linguistics.officialLanguages.map((l) => l.label) ?? [];
  });

  readonly writingSystems = computed<string[]>(() => {
    return this.selectedCiv()?.linguistics.writingSystems.map((w) => w.label) ?? [];
  });

  readonly primarySpecies = computed<string[]>(() => {
    return this.selectedCiv()?.demographics.primarySpecies.map((s) => s.label) ?? [];
  });

  readonly secondarySpecies = computed<string[]>(() => {
    return this.selectedCiv()?.demographics.secondarySpecies.map((s) => s.label) ?? [];
  });

  readonly isConfirmed = computed(() => {
    const builderId = this.builder.creation().civilizationId;
    return builderId === this.selectedCivId() && builderId !== null;
  });

  readonly mapTransform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.scale()})`,
  );

  /** Seuil d'affichage des noms sur la carte (plus bas sur mobile). */
  pinLabelMinScale(): number {
    if (typeof window === 'undefined') return 1.35;
    return window.matchMedia('(max-width: 1023px)').matches ? 1 : 1.35;
  }

  readonly pinCounterScale = computed(() => 1 / this.scale());

  readonly canZoomOut = computed(() => this.scale() > MIN_SCALE + 0.01);
  readonly canZoomIn = computed(() => this.scale() < MAX_SCALE - 0.01);

  ngOnInit(): void {
    this.loadCivilizations();
    const current = this.builder.creation();
    if (current.civilizationId) {
      this.selectedCivId.set(current.civilizationId);
    }
  }

  ngOnDestroy(): void {
    this.pointers.clear();
    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.refitMap(this.scale() <= MIN_SCALE + 0.01);
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

  private loadCivilizations(): void {
    this.loading.set(true);
    this.dataService.getCivilisations().subscribe({
      next: (civs) => {
        this.allCivilizations.set(civs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les civilisations.');
        this.loading.set(false);
      },
    });
  }

  selectCiv(civId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.moved) return;
    if (this.selectedCivId() !== civId) {
      this.builder.clearCivilization();
    }
    this.selectedCivId.set(civId);
    afterNextRender(
      () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }

  focusCivOnMap(civId: string): void {
    const coords = this.getMapCoordinates(civId);
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport || !this.mapReady()) {
      this.selectCiv(civId);
      return;
    }

    const targetScale = Math.max(this.scale(), 2.2);
    const { w: worldW, h: worldH } = this.worldSize();
    const worldX = (coords.x / 100) * worldW;
    const worldY = (coords.y / 100) * worldH;

    this.scale.set(targetScale);
    this.panX.set(viewport.clientWidth / 2 - worldX * targetScale);
    this.panY.set(viewport.clientHeight / 2 - worldY * targetScale);
    this.clampPan();
    this.selectCiv(civId);
  }

  confirmSelection(): void {
    const civ = this.selectedCiv();
    if (!civ) return;
    const selection: CivilizationSelection = {
      civilizationId: civ.id,
      civilizationName: civ.name,
      languages: civ.linguistics.officialLanguages.map((l) => l.label),
      writingSystems: civ.linguistics.writingSystems.map((w) => w.label),
    };
    this.builder.setCivilization(selection);
    this.builder.nextStep();
  }

  clearSelection(): void {
    this.selectedCivId.set(null);
    this.builder.clearCivilization();
  }

  prevStep(): void {
    this.builder.previousStep();
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
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const delta = event.deltaY > 0 ? -ZOOM_STEP * 0.6 : ZOOM_STEP * 0.6;
    this.zoomAt(this.scale() + delta, localX, localY);
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
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      this.pinchOrigin = {
        dist,
        scale: this.scale(),
        panX: this.panX(),
        panY: this.panY(),
        midX,
        midY,
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
      const localX = midX - rect.left;
      const localY = midY - rect.top;
      this.applyZoom(
        nextScale,
        localX,
        localY,
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

  /** Wait for DOM + layout, then measure and contain-fit the map. */
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
    else if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      // Mobile : second passage après layout flex pour garantir le zoom 1:1 utilisable au pinch.
      requestAnimationFrame(() => {
        this.scale.set(1);
        this.refitMap(true);
      });
    }
  }

  private retryFit(resetScale: boolean): void {
    if (this.fitRetries >= 12) return;
    this.fitRetries += 1;
    requestAnimationFrame(() => this.bindViewport(resetScale));
  }

  /** @returns false if viewport not ready yet */
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

  private worldSize(): { w: number; h: number } {
    return { w: this.mapWidth(), h: this.mapHeight() };
  }

  private clampPan(): void {
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport) return;
    const { w: worldW, h: worldH } = this.worldSize();
    const s = this.scale();
    const scaledW = worldW * s;
    const scaledH = worldH * s;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;

    if (scaledW <= vw) {
      this.panX.set((vw - scaledW) / 2);
    } else {
      const minX = vw - scaledW;
      this.panX.set(Math.min(0, Math.max(minX, this.panX())));
    }

    if (scaledH <= vh) {
      this.panY.set((vh - scaledH) / 2);
    } else {
      const minY = vh - scaledH;
      this.panY.set(Math.min(0, Math.max(minY, this.panY())));
    }
  }
}
