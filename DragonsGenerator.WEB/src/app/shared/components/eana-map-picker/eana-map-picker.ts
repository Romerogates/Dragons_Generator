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

/** Contain fit lives at scale 1 — do not remap pin % coords. */
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.35;
const MOVE_THRESHOLD_PX = 6;
const FOCUS_SCALE = 2.15;

/**
 * Carte d'Eana. Une fois zoomée, le stage est un conteneur à défilement natif :
 * le doigt (Android / iOS) déplace la carte sans JS. La souris glisse via scrollLeft/Top.
 */
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
  readonly viewportWidth = signal(0);
  readonly viewportHeight = signal(0);
  readonly mapReady = signal(false);
  readonly scale = signal(1);
  readonly isPanning = signal(false);

  readonly regionLabel = computed(() => storyRegionLabel(this.selectedRegion()));
  readonly regionStatusLabel = computed(() => {
    const label = this.regionLabel() || 'Région inconnue';
    return `Région : ${label}`;
  });
  readonly displayMapWidth = computed(() => this.mapWidth() * this.scale());
  readonly displayMapHeight = computed(() => this.mapHeight() * this.scale());
  readonly contentWidth = computed(() => Math.max(this.viewportWidth(), this.displayMapWidth()));
  readonly contentHeight = computed(() =>
    Math.max(this.viewportHeight(), this.displayMapHeight()),
  );
  readonly layerLeft = computed(() => (this.contentWidth() - this.displayMapWidth()) / 2);
  readonly layerTop = computed(() => (this.contentHeight() - this.displayMapHeight()) / 2);
  readonly canZoomOut = computed(() => this.scale() > MIN_SCALE + 0.01);
  readonly canZoomIn = computed(() => this.scale() < MAX_SCALE - 0.01);

  /** Moitié des civs au-dessus de la carte, moitié en dessous (plus de file horizontale illisible). */
  readonly civilizationsTop = computed(() => {
    const list = this.civilizations();
    return list.slice(0, Math.ceil(list.length / 2));
  });
  readonly civilizationsBottom = computed(() => {
    const list = this.civilizations();
    return list.slice(Math.ceil(list.length / 2));
  });

  private mouseDrag: { pointerId: number; x: number; y: number; left: number; top: number } | null =
    null;
  private moved = false;
  private pinch: { dist: number; scale: number; midX: number; midY: number } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private boundViewport: HTMLElement | null = null;
  private fitRetries = 0;

  private readonly onViewportResize = (): void => {
    this.refitMap();
  };

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
      untracked(() => this.scheduleFit());
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
    window.visualViewport?.addEventListener('resize', this.onViewportResize);
  }

  ngOnDestroy(): void {
    this.unbindTouch();
    this.resizeObserver?.disconnect();
    window.visualViewport?.removeEventListener('resize', this.onViewportResize);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.refitMap();
  }

  @HostListener('window:orientationchange')
  onOrientationChange(): void {
    setTimeout(() => this.refitMap(), 180);
  }

  isSelectedCiv(civId: string): boolean {
    const region = this.selectedRegion();
    return region?.kind === 'civilization' && region.id === civId;
  }

  isUnknownSelected(): boolean {
    const region = this.selectedRegion();
    return !region || region.kind === 'unknown';
  }

  pickCivilizationFromList(civ: Civilisation): void {
    this.emitCivilization(civ);
    this.focusPin(civ.id);
  }

  onPinClick(civ: Civilisation, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.moved) return;
    this.emitCivilization(civ);
    this.focusPin(civ.id);
  }

  pickUnknown(): void {
    this.regionChange.emit({ kind: 'unknown' });
    this.resetView();
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
      'civ-ellerina': 'fluent-emoji:evergreen-tree',
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
    this.zoomAt(MIN_SCALE);
  }

  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const local = this.localPoint(event.clientX, event.clientY);
    const delta = event.deltaY > 0 ? -ZOOM_STEP * 0.6 : ZOOM_STEP * 0.6;
    this.zoomAt(this.scale() + delta, local?.x, local?.y);
  }

  onDoubleClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('[data-map-pin]')) return;
    const local = this.localPoint(event.clientX, event.clientY);
    if (this.canZoomOut()) {
      this.resetView();
    } else {
      this.zoomAt(FOCUS_SCALE, local?.x, local?.y);
    }
  }

  /** Souris uniquement : le tactile défile nativement. */
  onPointerDown(event: PointerEvent): void {
    this.moved = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport || !this.canZoomOut()) return;
    this.mouseDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
    this.isPanning.set(true);
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.mouseDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) this.moved = true;
    viewport.scrollLeft = drag.left - dx;
    viewport.scrollTop = drag.top - dy;
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.mouseDrag || this.mouseDrag.pointerId !== event.pointerId) return;
    this.mouseDrag = null;
    this.isPanning.set(false);
  }

  /** Deux doigts = zoom ; un doigt = défilement natif (jamais bloqué). */
  private readonly onTouchStart = (event: TouchEvent): void => {
    this.moved = false;
    if (event.touches.length !== 2) return;
    const [a, b] = [event.touches[0], event.touches[1]];
    const mid = this.localPoint((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    this.pinch = {
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      scale: this.scale(),
      midX: mid?.x ?? 0,
      midY: mid?.y ?? 0,
    };
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length === 1) {
      this.moved = true;
      return;
    }
    if (event.touches.length !== 2 || !this.pinch || this.pinch.dist < 1) return;
    event.preventDefault();
    this.moved = true;
    const [a, b] = [event.touches[0], event.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    this.zoomAt(this.pinch.scale * (dist / this.pinch.dist), this.pinch.midX, this.pinch.midY);
  };

  private readonly onTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length < 2) this.pinch = null;
  };

  private bindTouch(el: HTMLElement): void {
    if (this.boundViewport === el) return;
    this.unbindTouch();
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', this.onTouchEnd, { passive: true });
    this.boundViewport = el;
  }

  private unbindTouch(): void {
    const el = this.boundViewport;
    if (!el) return;
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    el.removeEventListener('touchend', this.onTouchEnd);
    el.removeEventListener('touchcancel', this.onTouchEnd);
    this.boundViewport = null;
  }

  private emitCivilization(civ: Civilisation): void {
    this.regionChange.emit({ kind: 'civilization', id: civ.id, name: civ.name });
  }

  private focusPin(civId: string): void {
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport || !this.mapReady()) return;
    const coords = getEanaMapCoordinates(civId);
    const next = this.clampScale(Math.max(this.scale(), FOCUS_SCALE));
    const worldX = (coords.x / 100) * this.mapWidth();
    const worldY = (coords.y / 100) * this.mapHeight();
    this.applyScale(next, worldX, worldY, this.viewportWidth() / 2, this.viewportHeight() / 2);
  }

  private localPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const viewport = this.mapViewport()?.nativeElement;
    if (!viewport) return null;
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  /** Zoom en gardant sous (localX, localY) le même point de la carte. */
  private zoomAt(next: number, localX?: number, localY?: number): void {
    const viewport = this.mapViewport()?.nativeElement;
    const clamped = this.clampScale(next);
    if (!viewport || !this.mapReady()) {
      this.scale.set(clamped);
      return;
    }
    const lx = localX ?? this.viewportWidth() / 2;
    const ly = localY ?? this.viewportHeight() / 2;
    const s = this.scale();
    const worldX = (viewport.scrollLeft + lx - this.layerLeft()) / s;
    const worldY = (viewport.scrollTop + ly - this.layerTop()) / s;
    this.applyScale(clamped, worldX, worldY, lx, ly);
  }

  /** Change l’échelle puis place (worldX, worldY) sous (localX, localY) après rendu. */
  private applyScale(
    next: number,
    worldX: number,
    worldY: number,
    localX: number,
    localY: number,
  ): void {
    this.scale.set(next);
    const vw = this.viewportWidth();
    const vh = this.viewportHeight();
    const w = this.mapWidth() * next;
    const h = this.mapHeight() * next;
    const left = Math.max(0, (vw - w) / 2);
    const top = Math.max(0, (vh - h) / 2);
    const scrollLeft = worldX * next + left - localX;
    const scrollTop = worldY * next + top - localY;
    afterNextRender(
      () => {
        const viewport = this.mapViewport()?.nativeElement;
        if (!viewport) return;
        viewport.scrollLeft = scrollLeft;
        viewport.scrollTop = scrollTop;
      },
      { injector: this.injector },
    );
  }

  private scheduleFit(): void {
    this.fitRetries = 0;
    afterNextRender(
      () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => this.bindViewport());
        });
      },
      { injector: this.injector },
    );
  }

  private bindViewport(): void {
    const el = this.mapViewport()?.nativeElement;
    if (!el) {
      this.retryFit();
      return;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.refitMap());
    this.resizeObserver.observe(el);
    this.bindTouch(el);
    this.scale.set(MIN_SCALE);
    if (!this.refitMap()) this.retryFit();
  }

  private retryFit(): void {
    if (this.fitRetries >= 12) return;
    this.fitRetries += 1;
    requestAnimationFrame(() => this.bindViewport());
  }

  /** Contain : carte entière visible dans le stage à l’échelle 1. */
  private refitMap(): boolean {
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

    this.viewportWidth.set(vw);
    this.viewportHeight.set(vh);
    this.mapWidth.set(w);
    this.mapHeight.set(h);
    this.mapReady.set(true);
    return true;
  }

  private clampScale(v: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
  }
}
