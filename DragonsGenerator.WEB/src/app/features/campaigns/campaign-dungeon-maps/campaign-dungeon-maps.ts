import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CampaignData,
  CampaignDetail,
  CampaignHandout,
  createCampaignHandout,
  EncounterGroup,
} from '@core/models/Campaign/campaign';
import {
  CampaignDungeonMap,
  DUNGEON_MARKER_LABELS,
  DUNGEON_THEME_LABELS,
  DungeonGenParams,
  DungeonMarkerKind,
  DungeonTheme,
  DungeonTileKind,
  normalizeDungeonTheme,
} from '@core/models/Campaign/dungeon-map';
import { generateDungeonMap } from '@core/utils/dungeon-generator.util';
import {
  buildHandoutBody,
  drawDungeonToCanvas,
  dungeonMapToPngDataUrl,
  exportDungeonPdf,
  exportDungeonPng,
  fogRevealSet,
  roomAt,
  themePalette,
} from '@core/utils/dungeon-render.util';
import { rollRandomEncounter, suggestThemeFromRegion } from '@core/utils/dungeon-theme-pools';

type EditorTool = 'select' | 'floor' | 'wall' | 'door' | 'trap' | 'chest' | 'stairs';

interface UndoSnapshot {
  tiles: DungeonTileKind[][];
  markers: CampaignDungeonMap['markers'];
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 3;
const EDITOR_CELL = 12;
const PREVIEW_CELL = 4;
const THUMB_CELL = 3;
const MAX_UNDO = 40;

@Component({
  selector: 'app-campaign-dungeon-maps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-dungeon-maps.html',
  styleUrl: './campaign-dungeon-maps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDungeonMaps {
  readonly campaign = input.required<CampaignDetail>();
  readonly focusMapId = input<string | null>(null);
  readonly dataChange = output<Partial<CampaignData>>();

  readonly editorCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('editorCanvas');
  readonly previewCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('previewCanvas');
  readonly viewportRef = viewChild<ElementRef<HTMLDivElement>>('viewport');

  readonly editingMapId = signal<string | null>(null);
  readonly showGenerator = signal(false);
  readonly exportBusy = signal(false);
  readonly generating = signal(false);
  readonly revealMap = signal(false);
  readonly message = signal<string | null>(null);
  readonly thumbUrls = signal<Record<string, string>>({});

  readonly scale = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly selectedRoomId = signal<string | null>(null);
  readonly selectedMarkerId = signal<string | null>(null);
  readonly activeTool = signal<EditorTool>('select');
  readonly spaceHeld = signal(false);
  readonly isPanning = signal(false);
  readonly isPainting = signal(false);
  readonly previewMap = signal<CampaignDungeonMap | null>(null);

  readonly genName = signal('Donjon');
  readonly genGridW = signal(56);
  readonly genGridH = signal(56);
  readonly genRoomCount = signal(10);
  readonly genCorridorDensity = signal(50);
  readonly genTheme = signal<DungeonTheme>('generic');

  readonly themeLabels = DUNGEON_THEME_LABELS;
  readonly markerLabels = DUNGEON_MARKER_LABELS;
  readonly themes: DungeonTheme[] = ['crypt', 'cave', 'ruins', 'temple', 'sewer', 'forest', 'generic'];
  readonly tools: { id: EditorTool; label: string; hint: string }[] = [
    { id: 'select', label: 'Sélection', hint: 'Cliquer une salle' },
    { id: 'floor', label: 'Sol', hint: 'Peindre le sol' },
    { id: 'wall', label: 'Mur', hint: 'Peindre des murs' },
    { id: 'door', label: 'Porte', hint: 'Poser une porte' },
    { id: 'trap', label: 'Piège', hint: 'Marqueur piège' },
    { id: 'chest', label: 'Coffre', hint: 'Marqueur coffre' },
    { id: 'stairs', label: 'Escalier', hint: 'Marqueur escalier' },
  ];
  readonly legendTiles: { kind: 'wall' | 'floor' | 'door'; label: string; desc: string }[] = [
    { kind: 'wall', label: 'Mur', desc: 'Blocage — impassable' },
    { kind: 'floor', label: 'Sol', desc: 'Salles et couloirs praticables' },
    { kind: 'door', label: 'Porte', desc: 'Passage entre deux zones' },
  ];
  readonly legendMarkers: { symbol: string; label: string; desc: string; color: string }[] = [
    { symbol: '1', label: 'Numéro de salle', desc: 'Chaque pièce générée (Salle 1, 2…)', color: '#e2e8f0' },
    { symbol: '!', label: 'Piège', desc: 'Zone dangereuse MJ', color: '#ef4444' },
    { symbol: '$', label: 'Coffre', desc: 'Butin, trésor ou secret', color: '#eab308' },
    { symbol: 'S', label: 'Escalier', desc: 'Étage, sortie ou fosse', color: '#8b5cf6' },
  ];
  readonly genParamHints: { label: string; desc: string }[] = [
    { label: 'Grille', desc: 'Taille de la carte en cases (ex. 56×56)' },
    { label: 'Salles', desc: 'Nombre de pièces avec rencontre possible' },
    { label: 'Couloirs', desc: 'Plus c’est haut, plus les salles sont reliées' },
    { label: 'Thème', desc: 'Palette visuelle + créatures du pool thématique' },
  ];

  readonly maps = computed(() => this.campaign().data.dungeonMaps ?? []);
  readonly encounters = computed(() => this.campaign().data.encounters ?? []);

  readonly editingMap = computed(() => {
    const id = this.editingMapId();
    if (!id) return null;
    return this.maps().find((m) => m.id === id) ?? null;
  });

  readonly sortedMaps = computed(() =>
    [...this.maps()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  );

  readonly themeAccent = computed(() => {
    const map = this.editingMap() ?? this.previewMap();
    return themePalette(map?.theme ?? this.genTheme()).accent;
  });

  readonly undoDepth = signal(0);
  readonly canUndo = computed(() => this.undoDepth() > 0);

  private undoStack: UndoSnapshot[] = [];
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private panOrigin: { x: number; y: number; panX: number; panY: number } | null = null;
  private touchPointers = new Map<number, { x: number; y: number }>();
  private pinchStartDistance = 0;
  private pinchStartScale = 1;
  private lastPaintKey: string | null = null;
  private strokeStarted = false;

  constructor() {
    effect(() => {
      const id = this.focusMapId();
      if (!id) return;
      if (!this.maps().some((m) => m.id === id)) return;
      if (this.editingMapId() === id) return;
      this.openEditor(id);
    });

    effect(() => {
      const map = this.editingMap();
      const canvas = this.editorCanvasRef()?.nativeElement;
      if (!map || !canvas) return;
      drawDungeonToCanvas(map, canvas, EDITOR_CELL, {
        showRoomNumbers: true,
        selectedRoomId: this.selectedRoomId(),
        vignette: true,
        revealedRoomIds: fogRevealSet(map),
      });
    });

    effect(() => {
      const preview = this.previewMap();
      const canvas = this.previewCanvasRef()?.nativeElement;
      if (!this.showGenerator()) return;
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
      });
    });

    effect(() => {
      const maps = this.sortedMaps();
      const next: Record<string, string> = {};
      for (const map of maps) {
        try {
          next[map.id] = dungeonMapToPngDataUrl(map, THUMB_CELL, {
            showRoomNumbers: false,
            vignette: true,
          });
        } catch {
          /* ignore thumb failures in SSR-like contexts */
        }
      }
      this.thumbUrls.set(next);
    });

    effect(() => {
      if (!this.showGenerator()) return;
      this.genGridW();
      this.genGridH();
      this.genRoomCount();
      this.genCorridorDensity();
      this.genTheme();
      this.scheduleLivePreview();
    });
  }

  openGenerator(): void {
    const c = this.campaign();
    this.genName.set(`Donjon — ${c.title}`);
    this.genTheme.set(suggestThemeFromRegion(c.data.regionName));
    this.showGenerator.set(true);
    this.scheduleLivePreview(true);
  }

  closeGenerator(): void {
    this.showGenerator.set(false);
    this.previewMap.set(null);
  }

  async generateMap(): Promise<void> {
    if (this.generating()) return;
    this.generating.set(true);
    this.revealMap.set(false);
    await new Promise((r) => setTimeout(r, 420));

    const c = this.campaign();
    const map =
      this.previewMap() ??
      generateDungeonMap(this.buildGenParams(), {
        name: this.genName().trim() || 'Donjon',
        regionId: c.data.regionId,
        regionName: c.data.regionName,
      });
    const named = {
      ...map,
      name: this.genName().trim() || map.name,
      id: crypto.randomUUID?.() ?? `map-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.persistMaps([...(c.data.dungeonMaps ?? []), named], true);
    this.showGenerator.set(false);
    this.previewMap.set(null);
    this.editingMapId.set(named.id);
    this.selectedRoomId.set(named.rooms[0]?.id ?? null);
    this.undoStack = [];
    this.undoDepth.set(0);
    this.fitMapInView(named);
    this.generating.set(false);
    this.revealMap.set(true);
    this.message.set('Donjon gravé — peignez, zoomez, partagez.');
    setTimeout(() => this.revealMap.set(false), 900);
  }

  regenerateEditingMap(): void {
    const current = this.editingMap();
    if (!current || !confirm('Régénérer ce donjon ? Les modifications de cases seront perdues.')) {
      return;
    }
    this.pushUndo(current);
    const c = this.campaign();
    const next = generateDungeonMap(
      {
        gridWidth: current.gridWidth,
        gridHeight: current.gridHeight,
        roomCount: Math.max(4, current.rooms.length || 8),
        corridorDensity: 50,
        theme: current.theme,
      },
      {
        name: current.name,
        regionId: c.data.regionId,
        regionName: c.data.regionName,
      },
    );
    const merged: CampaignDungeonMap = {
      ...next,
      id: current.id,
      name: current.name,
      handoutId: current.handoutId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.updateMap(merged);
    this.selectedRoomId.set(merged.rooms[0]?.id ?? null);
    this.fitMapInView(merged);
    this.message.set('Donjon régénéré.');
  }

  openEditor(mapId: string): void {
    this.editingMapId.set(mapId);
    this.selectedRoomId.set(null);
    this.selectedMarkerId.set(null);
    this.undoStack = [];
    this.undoDepth.set(0);
    const map = this.maps().find((m) => m.id === mapId);
    if (map) this.fitMapInView(map);
  }

  closeEditor(): void {
    this.editingMapId.set(null);
    this.undoStack = [];
    this.undoDepth.set(0);
  }

  deleteMap(mapId: string): void {
    if (!confirm('Supprimer cette carte ?')) return;
    const c = this.campaign();
    this.persistMaps((c.data.dungeonMaps ?? []).filter((m) => m.id !== mapId), true);
    if (this.editingMapId() === mapId) this.closeEditor();
  }

  updateMap(map: CampaignDungeonMap): void {
    const now = new Date().toISOString();
    const updated = { ...map, updatedAt: now };
    const list = (this.campaign().data.dungeonMaps ?? []).map((m) =>
      m.id === map.id ? updated : m,
    );
    this.persistMaps(list);
  }

  patchEditingMap(patch: Partial<CampaignDungeonMap>): void {
    const current = this.editingMap();
    if (!current) return;
    this.updateMap({ ...current, ...patch });
  }

  patchRoom(roomId: string, patch: Partial<CampaignDungeonMap['rooms'][0]>): void {
    const map = this.editingMap();
    if (!map) return;
    const rooms = map.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r));
    this.updateMap({ ...map, rooms });
  }

  onEncounterChange(roomId: string, encounterId: string): void {
    const map = this.editingMap();
    if (!map) return;
    const room = map.rooms.find((r) => r.id === roomId);
    if (!room) return;
    if (encounterId) {
      this.patchRoom(roomId, { encounterId, randomEncounter: null });
    } else {
      const isBoss = room === map.rooms[map.rooms.length - 1];
      this.patchRoom(roomId, {
        encounterId: null,
        randomEncounter: rollRandomEncounter(map.theme, isBoss),
      });
    }
  }

  rerollRoomEncounter(roomId: string): void {
    const map = this.editingMap();
    if (!map) return;
    const room = map.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const isBoss = room === map.rooms[map.rooms.length - 1];
    this.patchRoom(roomId, {
      randomEncounter: rollRandomEncounter(map.theme, isBoss),
      encounterId: null,
    });
  }

  focusRoom(roomId: string): void {
    const map = this.editingMap();
    if (!map) return;
    this.selectedRoomId.set(roomId);
    const room = map.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const viewport = this.viewportRef()?.nativeElement;
    if (!viewport) return;
    const s = this.scale();
    const cx = (room.x + room.width / 2) * EDITOR_CELL * s;
    const cy = (room.y + room.height / 2) * EDITOR_CELL * s;
    this.panX.set(viewport.clientWidth / 2 - cx);
    this.panY.set(viewport.clientHeight / 2 - cy);
  }

  applyTileAt(x: number, y: number, recordUndo: boolean): void {
    const map = this.editingMap();
    if (!map) return;
    if (x < 0 || y < 0 || x >= map.gridWidth || y >= map.gridHeight) return;

    const tool = this.activeTool();
    if (tool === 'select') {
      const rid = roomAt(map, x, y);
      this.selectedRoomId.set(rid);
      const marker = map.markers.find((m) => m.x === x && m.y === y);
      this.selectedMarkerId.set(marker?.id ?? null);
      return;
    }

    const key = `${tool}:${x},${y}`;
    if (this.lastPaintKey === key) return;
    this.lastPaintKey = key;

    if (recordUndo && !this.strokeStarted) {
      this.pushUndo(map);
      this.strokeStarted = true;
    }

    if (tool === 'floor' || tool === 'wall' || tool === 'door') {
      if (map.tiles[y][x] === tool) return;
      const tiles = map.tiles.map((row, ry) =>
        row.map((cell, rx) => (rx === x && ry === y ? (tool as DungeonTileKind) : cell)),
      );
      this.updateMap({ ...map, tiles });
      return;
    }

    const markerKind = tool as DungeonMarkerKind;
    if (markerKind === 'trap' || markerKind === 'chest' || markerKind === 'stairs') {
      const existing = map.markers.findIndex((m) => m.x === x && m.y === y);
      const markers = [...map.markers];
      if (existing >= 0) {
        if (markers[existing].kind === markerKind) {
          markers.splice(existing, 1);
        } else {
          markers[existing] = {
            ...markers[existing],
            kind: markerKind,
            label: DUNGEON_MARKER_LABELS[markerKind],
          };
        }
      } else {
        markers.push({
          id: crypto.randomUUID?.() ?? `mk-${Date.now()}`,
          x,
          y,
          kind: markerKind,
          label: DUNGEON_MARKER_LABELS[markerKind],
          linkedRoomId: roomAt(map, x, y),
        });
      }
      this.updateMap({ ...map, markers });
    }
  }

  onPointerDown(event: PointerEvent): void {
    const map = this.editingMap();
    const viewport = this.viewportRef()?.nativeElement;
    if (!map || !viewport) return;

    this.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.touchPointers.size === 2) {
      this.isPainting.set(false);
      this.isPanning.set(false);
      const pts = [...this.touchPointers.values()];
      this.pinchStartDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      this.pinchStartScale = this.scale();
      return;
    }

    const wantPan =
      event.button === 1 || event.button === 2 || this.spaceHeld() || this.activeTool() === 'select' && event.altKey;

    if (wantPan || (this.activeTool() === 'select' && event.button === 0 && event.shiftKey)) {
      event.preventDefault();
      this.isPanning.set(true);
      this.panOrigin = {
        x: event.clientX,
        y: event.clientY,
        panX: this.panX(),
        panY: this.panY(),
      };
      viewport.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0) return;
    event.preventDefault();
    this.isPainting.set(true);
    this.strokeStarted = false;
    this.lastPaintKey = null;
    viewport.setPointerCapture(event.pointerId);
    const tile = this.clientToTile(event.clientX, event.clientY);
    if (tile) this.applyTileAt(tile.x, tile.y, true);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.touchPointers.has(event.pointerId)) {
      this.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (this.touchPointers.size === 2 && this.pinchStartDistance > 0) {
      const pts = [...this.touchPointers.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, this.pinchStartScale * (dist / this.pinchStartDistance)),
      );
      this.scale.set(+next.toFixed(2));
      return;
    }
    if (this.isPanning() && this.panOrigin) {
      const dx = event.clientX - this.panOrigin.x;
      const dy = event.clientY - this.panOrigin.y;
      this.panX.set(this.panOrigin.panX + dx);
      this.panY.set(this.panOrigin.panY + dy);
      return;
    }
    if (!this.isPainting()) return;
    if (this.activeTool() === 'select') return;
    const tile = this.clientToTile(event.clientX, event.clientY);
    if (tile) this.applyTileAt(tile.x, tile.y, true);
  }

  onPointerUp(event: PointerEvent): void {
    this.touchPointers.delete(event.pointerId);
    if (this.touchPointers.size < 2) this.pinchStartDistance = 0;
    const viewport = this.viewportRef()?.nativeElement;
    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    this.isPanning.set(false);
    this.isPainting.set(false);
    this.panOrigin = null;
    this.lastPaintKey = null;
    this.strokeStarted = false;
  }

  undo(): void {
    const map = this.editingMap();
    const snap = this.undoStack.pop();
    if (!map || !snap) return;
    this.undoDepth.set(this.undoStack.length);
    this.updateMap({ ...map, tiles: snap.tiles, markers: snap.markers });
    this.message.set('Annulé.');
  }

  removeMarker(markerId: string): void {
    const map = this.editingMap();
    if (!map) return;
    this.pushUndo(map);
    this.updateMap({
      ...map,
      markers: map.markers.filter((m) => m.id !== markerId),
    });
    this.selectedMarkerId.set(null);
  }

  setTool(tool: EditorTool): void {
    this.activeTool.set(tool);
  }

  zoom(delta: number): void {
    this.scale.update((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));
  }

  resetView(): void {
    const map = this.editingMap();
    if (map) this.fitMapInView(map);
  }

  encounterLabel(room: CampaignDungeonMap['rooms'][0], encounters: EncounterGroup[]): string {
    if (room.encounterId) {
      const enc = encounters.find((e) => e.id === room.encounterId);
      if (enc) {
        return enc.creatures.map((c) => `${c.quantity}× ${c.customName || c.creatureName}`).join(', ');
      }
    }
    if (room.randomEncounter?.creatures.length) {
      return room.randomEncounter.creatures.map((c) => `${c.quantity}× ${c.name}`).join(', ');
    }
    return '—';
  }

  handoutForMap(map: CampaignDungeonMap): CampaignHandout | null {
    if (!map.handoutId) return null;
    return (this.campaign().data.handouts ?? []).find((h) => h.id === map.handoutId) ?? null;
  }

  async exportPng(): Promise<void> {
    const map = this.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      await exportDungeonPng(map, `${map.name.replace(/\s+/g, '-')}.png`);
      this.message.set('PNG exporté.');
    } finally {
      this.exportBusy.set(false);
    }
  }

  async sharePng(): Promise<void> {
    const map = this.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      const dataUrl = dungeonMapToPngDataUrl(map);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${map.name.replace(/\s+/g, '-')}.png`, { type: 'image/png' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: map.name });
        this.message.set('Carte partagée.');
      } else {
        await exportDungeonPng(map, `${map.name.replace(/\s+/g, '-')}.png`);
        this.message.set('PNG téléchargé (partage natif indisponible).');
      }
    } finally {
      this.exportBusy.set(false);
    }
  }

  async exportPdf(): Promise<void> {
    const map = this.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      await exportDungeonPdf(map, this.encounters(), `${map.name.replace(/\s+/g, '-')}.pdf`);
      this.message.set('PDF exporté.');
    } finally {
      this.exportBusy.set(false);
    }
  }

  createOrUpdateHandout(): void {
    const map = this.editingMap();
    if (!map) return;
    const c = this.campaign();
    const body = buildHandoutBody(map, this.encounters(), {
      playerFog: !!map.fogOfWarEnabled,
    });
    const now = new Date().toISOString();
    let handouts = [...(c.data.handouts ?? [])];
    let handoutId = map.handoutId ?? null;

    if (handoutId) {
      handouts = handouts.map((h) =>
        h.id === handoutId
          ? { ...h, title: map.name, body, kind: 'map' as const, updatedAt: now }
          : h,
      );
    } else {
      const handout = createCampaignHandout(map.name);
      handout.kind = 'map';
      handout.body = body;
      handout.published = false;
      handoutId = handout.id;
      handouts.push(handout);
    }

    const maps = (c.data.dungeonMaps ?? []).map((m) =>
      m.id === map.id ? { ...m, handoutId, updatedAt: now } : m,
    );
    this.dataChange.emit({ dungeonMaps: maps, handouts });
    this.message.set('Handout brouillon enregistré (Documents).');
  }

  exportJson(): void {
    const map = this.editingMap();
    if (!map) return;
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.message.set('JSON exporté.');
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  toggleFogOfWar(): void {
    const map = this.editingMap();
    if (!map) return;
    const enabled = !map.fogOfWarEnabled;
    this.patchEditingMap({
      fogOfWarEnabled: enabled,
      revealedRoomIds: enabled ? (map.revealedRoomIds ?? []) : [],
    });
    this.message.set(enabled ? 'Fog of war activé — révélez les salles une par une.' : 'Fog of war désactivé.');
  }

  isRoomRevealed(roomId: string): boolean {
    const map = this.editingMap();
    if (!map?.fogOfWarEnabled) return true;
    return (map.revealedRoomIds ?? []).includes(roomId);
  }

  toggleRoomReveal(roomId: string, event?: Event): void {
    event?.stopPropagation();
    const map = this.editingMap();
    if (!map) return;
    const current = new Set(map.revealedRoomIds ?? []);
    if (current.has(roomId)) current.delete(roomId);
    else current.add(roomId);
    this.patchEditingMap({ revealedRoomIds: [...current] });
  }

  revealAllRooms(): void {
    const map = this.editingMap();
    if (!map) return;
    this.patchEditingMap({ revealedRoomIds: map.rooms.map((r) => r.id) });
    this.message.set('Toutes les salles révélées.');
  }

  hideAllRooms(): void {
    const map = this.editingMap();
    if (!map) return;
    this.patchEditingMap({ revealedRoomIds: [] });
    this.message.set('Salles masquées — régénérez le handout pour les joueurs.');
  }

  onThemeChange(raw: string): void {
    this.genTheme.set(normalizeDungeonTheme(raw));
  }

  themeSwatch(theme: DungeonTheme): string {
    return themePalette(theme).floor;
  }

  legendTileColor(kind: 'wall' | 'floor' | 'door', theme?: DungeonTheme): string {
    const p = themePalette(theme ?? this.editingMap()?.theme ?? this.genTheme());
    if (kind === 'wall') return p.wall;
    if (kind === 'door') return p.door;
    return p.floor;
  }

  cursorClass(): string {
    if (this.isPanning() || this.spaceHeld()) return 'cursor-grabbing';
    if (this.activeTool() === 'select') return 'cursor-default';
    return 'cursor-crosshair';
  }

  private buildGenParams(): DungeonGenParams {
    return {
      gridWidth: this.genGridW(),
      gridHeight: this.genGridH(),
      roomCount: this.genRoomCount(),
      corridorDensity: this.genCorridorDensity(),
      theme: this.genTheme(),
    };
  }

  private scheduleLivePreview(immediate = false): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    const run = () => {
      this.previewTimer = null;
      if (!this.showGenerator()) return;
      const c = this.campaign();
      const map = generateDungeonMap(this.buildGenParams(), {
        name: this.genName().trim() || 'Aperçu',
        regionId: c.data.regionId,
        regionName: c.data.regionName,
      });
      this.previewMap.set(map);
    };
    if (immediate) run();
    else this.previewTimer = setTimeout(run, 280);
  }

  private pushUndo(map: CampaignDungeonMap): void {
    this.undoStack.push({
      tiles: map.tiles.map((row) => [...row]),
      markers: map.markers.map((m) => ({ ...m })),
    });
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.undoDepth.set(this.undoStack.length);
  }

  private fitMapInView(map: CampaignDungeonMap): void {
    queueMicrotask(() => {
      const viewport = this.viewportRef()?.nativeElement;
      if (!viewport) {
        this.scale.set(1);
        this.panX.set(16);
        this.panY.set(16);
        return;
      }
      const pad = 48;
      const sx = (viewport.clientWidth - pad) / (map.gridWidth * EDITOR_CELL);
      const sy = (viewport.clientHeight - pad) / (map.gridHeight * EDITOR_CELL);
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(sx, sy, 1.25)));
      this.scale.set(+next.toFixed(2));
      const w = map.gridWidth * EDITOR_CELL * next;
      const h = map.gridHeight * EDITOR_CELL * next;
      this.panX.set((viewport.clientWidth - w) / 2);
      this.panY.set((viewport.clientHeight - h) / 2);
    });
  }

  private clientToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const viewport = this.viewportRef()?.nativeElement;
    const map = this.editingMap();
    if (!viewport || !map) return null;
    const rect = viewport.getBoundingClientRect();
    const localX = (clientX - rect.left - this.panX()) / this.scale();
    const localY = (clientY - rect.top - this.panY()) / this.scale();
    const x = Math.floor(localX / EDITOR_CELL);
    const y = Math.floor(localY / EDITOR_CELL);
    if (x < 0 || y < 0 || x >= map.gridWidth || y >= map.gridHeight) return null;
    return { x, y };
  }

  private persistMaps(maps: CampaignDungeonMap[], immediate = false): void {
    if (immediate) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      this.dataChange.emit({ dungeonMaps: maps });
      return;
    }
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.dataChange.emit({ dungeonMaps: maps });
    }, 600);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && this.editingMap()) {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        this.spaceHeld.set(true);
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && this.editingMap()) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      this.undo();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') this.spaceHeld.set(false);
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (!this.editingMap()) return;
    const viewport = this.viewportRef()?.nativeElement;
    if (!viewport) return;
    if (!viewport.contains(event.target as Node) && !event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const before = this.scale();
    const delta = event.deltaY > 0 ? -0.12 : 0.12;
    const after = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(before + delta).toFixed(2)));
    if (after === before) return;

    const worldX = (mx - this.panX()) / before;
    const worldY = (my - this.panY()) / before;
    this.scale.set(after);
    this.panX.set(mx - worldX * after);
    this.panY.set(my - worldY * after);
  }
}
