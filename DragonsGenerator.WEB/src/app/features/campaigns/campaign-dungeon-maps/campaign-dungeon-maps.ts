import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  dungeonDrawOrigin,
  dungeonMapToPngDataUrl,
  exportDungeonPdf,
  exportDungeonPng,
  fogRevealSet,
  playerExportDrawOptions,
  roomAt,
  themePalette,
} from '@core/utils/dungeon-render.util';
import { floodFillTiles, gridLine, paintBrushDisk, setTileAt } from '@core/utils/dungeon-paint.util';
import {
  fillRectFloor,
  findRoomToResize,
  nextRoomLabel,
  normalizeGridRect,
  type GridRect,
} from '@core/utils/dungeon-room-edit.util';
import { rollRandomEncounter, suggestThemeFromRegion } from '@core/utils/dungeon-theme-pools';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { FullscreenEnterBtn } from '@shared/components/fullscreen-enter-btn/fullscreen-enter-btn';
import {
  UI_BANNER_IDS,
  UiBannerPreferencesService,
} from '@core/services/ui-banner-preferences.service';
import {
  DungeonCloudService,
  type CloudDungeonSummary,
} from '@core/services/dungeon-cloud.service';

type EditorTool =
  | 'select'
  | 'room'
  | 'floor'
  | 'wall'
  | 'fill'
  | 'door'
  | 'trap'
  | 'chest'
  | 'stairs';
type BrushSize = 1 | 2 | 3;
type SizePresetId = 'compact' | 'standard' | 'large' | 'custom';

interface UndoSnapshot {
  tiles: DungeonTileKind[][];
  markers: CampaignDungeonMap['markers'];
  rooms: CampaignDungeonMap['rooms'];
}

interface SizePreset {
  id: Exclude<SizePresetId, 'custom'>;
  label: string;
  hint: string;
  gridWidth: number;
  gridHeight: number;
  roomCount: number;
  corridorDensity: number;
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 3;
const FIT_MAX_SCALE = 1.75;
const EDITOR_CELL = 12;
const EDITOR_EDGE_PAD = 2;
const PREVIEW_CELL = 4;
const THUMB_CELL = 3;
const MAX_UNDO = 40;
const PREVIEW_DEBOUNCE_MS = 480;

const SIZE_PRESETS: SizePreset[] = [
  {
    id: 'compact',
    label: 'Compact',
    hint: '36×36 · ~6 salles',
    gridWidth: 36,
    gridHeight: 36,
    roomCount: 6,
    corridorDensity: 45,
  },
  {
    id: 'standard',
    label: 'Standard',
    hint: '48×48 · ~10 salles',
    gridWidth: 48,
    gridHeight: 48,
    roomCount: 10,
    corridorDensity: 50,
  },
  {
    id: 'large',
    label: 'Large',
    hint: '64×64 · ~14 salles',
    gridWidth: 64,
    gridHeight: 64,
    roomCount: 14,
    corridorDensity: 55,
  },
];

@Component({
  selector: 'app-campaign-dungeon-maps',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialog, FullscreenEnterBtn],
  templateUrl: './campaign-dungeon-maps.html',
  styleUrl: './campaign-dungeon-maps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDungeonMaps implements OnDestroy {
  private readonly banners = inject(UiBannerPreferencesService);
  private readonly dungeonCloud = inject(DungeonCloudService);

  readonly campaign = input.required<CampaignDetail>();
  readonly focusMapId = input<string | null>(null);
  /** Hub bibliothèque : pas de handouts campagne, une carte cloud. */
  readonly libraryMode = input(false);
  readonly readOnly = input(false);
  readonly dataChange = output<Partial<CampaignData>>();

  readonly editorCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('editorCanvas');
  readonly previewCanvasRef = viewChild<ElementRef<HTMLCanvasElement>>('previewCanvas');
  readonly viewportRef = viewChild<ElementRef<HTMLDivElement>>('viewport');

  readonly editingMapId = signal<string | null>(null);
  /** Copie de travail live (paint immédiat) — le save parent reste debounce. */
  readonly draftMap = signal<CampaignDungeonMap | null>(null);
  readonly confirmDialog = signal<{
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  readonly showGenerator = signal(false);
  readonly exportBusy = signal(false);
  readonly generating = signal(false);
  readonly revealMap = signal(false);
  /** Éditeur carte en overlay plein viewport (canvas + outils). */
  readonly editorFullscreen = signal(false);
  readonly message = signal<string | null>(null);
  /** Lien vers l’onglet Documents après création / publication d’un handout carte. */
  readonly lastHandoutNav = signal<{ handoutId: string } | null>(null);
  readonly thumbUrls = signal<Record<string, string>>({});
  readonly sizePreset = signal<SizePresetId>('standard');
  readonly showAdvanced = signal(false);
  readonly previewSeed = signal(1);
  readonly exportMenuOpen = signal(false);
  readonly docMenuOpen = signal(false);
  readonly libraryPickerOpen = signal(false);
  readonly libraryList = signal<CloudDungeonSummary[]>([]);
  readonly libraryBusy = signal(false);

  private previousBodyOverflow = '';
  private editorBodyLocked = false;
  /** Cache vignettes : clé = `${id}:${updatedAt}` → dataURL. */
  private thumbCache = new Map<string, string>();

  readonly scale = signal(1);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly selectedRoomId = signal<string | null>(null);
  readonly selectedMarkerId = signal<string | null>(null);
  readonly activeTool = signal<EditorTool>('select');
  /** Taille brosse Sol/Mur : 1 = 1 case, 2 ≈ 3×3, 3 ≈ 5×5. */
  readonly brushSize = signal<BrushSize>(1);
  /** Kind utilisé par l’outil Remplir. */
  readonly fillKind = signal<'floor' | 'wall'>('floor');
  readonly spaceHeld = signal(false);
  readonly isPanning = signal(false);
  readonly isPainting = signal(false);
  readonly previewMap = signal<CampaignDungeonMap | null>(null);
  /** Aperçu rectangle outil Salle pendant le drag. */
  readonly roomDragRect = signal<GridRect | null>(null);

  readonly genName = signal('Donjon');
  readonly genGridW = signal(48);
  readonly genGridH = signal(48);
  readonly genRoomCount = signal(10);
  readonly genCorridorDensity = signal(50);
  readonly genTheme = signal<DungeonTheme>('generic');

  readonly sizePresets = SIZE_PRESETS;
  readonly themeLabels = DUNGEON_THEME_LABELS;
  readonly markerLabels = DUNGEON_MARKER_LABELS;
  readonly themes: DungeonTheme[] = ['crypt', 'cave', 'ruins', 'temple', 'sewer', 'forest', 'generic'];
  readonly tools: { id: EditorTool; label: string; hint: string }[] = [
    { id: 'select', label: 'Sélection', hint: 'Cliquer une salle' },
    { id: 'room', label: 'Salle', hint: 'Clic-glisser pour définir une salle' },
    { id: 'floor', label: 'Sol', hint: 'Peindre le sol' },
    { id: 'wall', label: 'Mur', hint: 'Peindre des murs' },
    { id: 'fill', label: 'Remplir', hint: 'Remplir une zone connectée (sol ou mur)' },
    { id: 'door', label: 'Porte', hint: 'Poser une porte' },
    { id: 'trap', label: 'Piège', hint: 'Marqueur piège' },
    { id: 'chest', label: 'Coffre', hint: 'Marqueur coffre' },
    { id: 'stairs', label: 'Escalier', hint: 'Marqueur escalier' },
  ];
  readonly brushSizes: BrushSize[] = [1, 2, 3];
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
    { label: 'Grille', desc: 'Taille de la carte en cases' },
    { label: 'Salles', desc: 'Nombre de pièces avec rencontre possible' },
    { label: 'Couloirs', desc: 'Plus c’est haut, plus les salles sont reliées' },
  ];

  readonly maps = computed(() => this.campaign().data.dungeonMaps ?? []);
  readonly encounters = computed(() => this.campaign().data.encounters ?? []);

  readonly editingMap = computed(() => {
    const id = this.editingMapId();
    if (!id) return null;
    const draft = this.draftMap();
    if (draft && draft.id === id) return draft;
    return this.maps().find((m) => m.id === id) ?? null;
  });

  readonly selectedMarker = computed(() => {
    const map = this.editingMap();
    const mid = this.selectedMarkerId();
    if (!map || !mid) return null;
    return map.markers.find((m) => m.id === mid) ?? null;
  });

  readonly viewportBg = computed(() => themePalette(this.editingMap()?.theme ?? this.genTheme()).bg);

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
  readonly redoDepth = signal(0);
  readonly canUndo = computed(() => this.undoDepth() > 0);
  readonly canRedo = computed(() => this.redoDepth() > 0);

  private undoStack: UndoSnapshot[] = [];
  private redoStack: UndoSnapshot[] = [];
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private messageIsCoaching = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMaps: CampaignDungeonMap[] | null = null;
  private panOrigin: { x: number; y: number; panX: number; panY: number } | null = null;
  private touchPointers = new Map<number, { x: number; y: number }>();
  private pinchStartDistance = 0;
  private pinchStartScale = 1;
  private lastPaintKey: string | null = null;
  private lastPaintTile: { x: number; y: number } | null = null;
  private strokeStarted = false;
  /** true après le premier pointermove du stroke (pas de toggle-suppression marqueur). */
  private strokeDragged = false;
  private roomDragStart: { x: number; y: number } | null = null;
  private isDefiningRoom = false;

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
        previewRoomRect: this.roomDragRect(),
        vignette: true,
        revealedRoomIds: fogRevealSet(map),
        edgePadCells: EDITOR_EDGE_PAD,
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
        edgePadCells: 1,
      });
    });

    effect(() => {
      const maps = this.sortedMaps();
      const nextUrls: Record<string, string> = {};
      const liveKeys = new Set<string>();

      for (const map of maps) {
        const cacheKey = `${map.id}:${map.updatedAt}`;
        liveKeys.add(cacheKey);
        let url = this.thumbCache.get(cacheKey);
        if (!url) {
          try {
            url = dungeonMapToPngDataUrl(map, THUMB_CELL, {
              showRoomNumbers: false,
              vignette: true,
            });
            this.thumbCache.set(cacheKey, url);
          } catch {
            continue;
          }
        }
        nextUrls[map.id] = url;
      }

      for (const key of [...this.thumbCache.keys()]) {
        if (!liveKeys.has(key)) this.thumbCache.delete(key);
      }
      this.thumbUrls.set(nextUrls);
    });
  }

  openGenerator(): void {
    const c = this.campaign();
    this.genName.set(`Donjon — ${c.title}`);
    this.genTheme.set(suggestThemeFromRegion(c.data.regionName));
    this.applySizePreset('standard', false);
    this.showAdvanced.set(false);
    this.previewSeed.set((Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0 || 1);
    this.showGenerator.set(true);
    this.scheduleLivePreview(true);
  }

  openLibraryPicker(): void {
    if (this.libraryMode() || !this.campaign().isOwner) return;
    this.libraryBusy.set(true);
    this.libraryPickerOpen.set(true);
    this.dungeonCloud.list().subscribe({
      next: (list) => {
        this.libraryList.set(list);
        this.libraryBusy.set(false);
      },
      error: () => {
        this.libraryBusy.set(false);
        this.setEditorMessage('Impossible de charger la bibliothèque.');
      },
    });
  }

  closeLibraryPicker(): void {
    this.libraryPickerOpen.set(false);
  }

  importFromLibrary(summary: CloudDungeonSummary): void {
    if (this.libraryBusy()) return;
    this.libraryBusy.set(true);
    this.dungeonCloud.get(summary.id).subscribe({
      next: (detail) => {
        const copy = this.cloneMapForCampaign(detail.data, detail.name);
        const c = this.campaign();
        this.persistMaps([...(c.data.dungeonMaps ?? []), copy], true);
        this.libraryBusy.set(false);
        this.libraryPickerOpen.set(false);
        this.setEditorMessage(`« ${copy.name} » importé (copie indépendante).`);
        this.openEditor(copy.id);
      },
      error: () => {
        this.libraryBusy.set(false);
        this.setEditorMessage('Import bibliothèque impossible.');
      },
    });
  }

  saveEditingToLibrary(): void {
    const map = this.editingMap();
    if (!map || this.libraryMode() || this.libraryBusy()) return;
    this.libraryBusy.set(true);
    this.closeActionMenus();
    const payload = {
      ...map,
      handoutId: null,
      fogOfWarEnabled: false,
      revealedRoomIds: [],
      updatedAt: new Date().toISOString(),
    };
    this.dungeonCloud.create(payload, map.name).subscribe({
      next: () => {
        this.libraryBusy.set(false);
        this.setEditorMessage('Copie enregistrée dans Mes Donjons.');
      },
      error: () => {
        this.libraryBusy.set(false);
        this.setEditorMessage('Enregistrement bibliothèque impossible.');
      },
    });
  }

  private cloneMapForCampaign(src: CampaignDungeonMap, name: string): CampaignDungeonMap {
    const now = new Date().toISOString();
    const id = crypto.randomUUID?.() ?? `map-${Date.now()}`;
    const roomIdMap = new Map<string, string>();
    const rooms = (src.rooms ?? []).map((r) => {
      const nid = crypto.randomUUID?.() ?? `room-${Date.now()}-${Math.random()}`;
      roomIdMap.set(r.id, nid);
      return { ...r, id: nid, encounterId: null };
    });
    const markers = (src.markers ?? []).map((m) => ({
      ...m,
      id: crypto.randomUUID?.() ?? `mk-${Date.now()}-${Math.random()}`,
      linkedRoomId: m.linkedRoomId ? (roomIdMap.get(m.linkedRoomId) ?? null) : m.linkedRoomId,
    }));
    return {
      ...structuredClone(src),
      id,
      name: name || src.name || 'Donjon',
      rooms,
      markers,
      handoutId: null,
      fogOfWarEnabled: false,
      revealedRoomIds: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  closeGenerator(): void {
    this.showGenerator.set(false);
    this.previewMap.set(null);
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
  }

  applySizePreset(id: Exclude<SizePresetId, 'custom'>, refreshPreview = true): void {
    const preset = SIZE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.sizePreset.set(id);
    this.genGridW.set(preset.gridWidth);
    this.genGridH.set(preset.gridHeight);
    this.genRoomCount.set(preset.roomCount);
    this.genCorridorDensity.set(preset.corridorDensity);
    if (refreshPreview) this.scheduleLivePreview();
  }

  toggleAdvanced(): void {
    this.showAdvanced.update((v) => !v);
  }

  onAdvancedParamInput(kind: 'w' | 'h' | 'rooms' | 'corridors', value: number): void {
    this.sizePreset.set('custom');
    if (kind === 'w') this.genGridW.set(value);
    else if (kind === 'h') this.genGridH.set(value);
    else if (kind === 'rooms') this.genRoomCount.set(value);
    else this.genCorridorDensity.set(value);
  }

  /** Regen aperçu uniquement au relâchement des sliders avancés. */
  onAdvancedParamCommit(): void {
    this.scheduleLivePreview();
  }

  reshufflePreview(): void {
    this.previewSeed.set((this.previewSeed() + 0x9e3779b9) >>> 0 || 1);
    this.scheduleLivePreview(true);
  }

  generateMap(): void {
    if (this.generating()) return;
    this.generating.set(true);
    this.revealMap.set(false);

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
    this.clearHistory();
    this.fitMapInView(named);
    this.generating.set(false);
    this.revealMap.set(true);
    this.setEditorMessage('Donjon gravé — peignez, zoomez, exportez.', { coaching: true });
    setTimeout(() => this.revealMap.set(false), 900);
  }

  toggleExportMenu(): void {
    this.docMenuOpen.set(false);
    this.exportMenuOpen.update((v) => !v);
  }

  toggleDocMenu(): void {
    this.exportMenuOpen.set(false);
    this.docMenuOpen.update((v) => !v);
  }

  closeActionMenus(): void {
    this.exportMenuOpen.set(false);
    this.docMenuOpen.set(false);
  }

  regenerateEditingMap(): void {
    const current = this.editingMap();
    if (!current) return;
    this.askConfirm(
      'Régénérer le donjon',
      'Régénérer ce donjon ? Les modifications de cases seront perdues.',
      () => {
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
        this.updateMap(merged, false, true);
        this.selectedRoomId.set(merged.rooms[0]?.id ?? null);
        this.fitMapInView(merged);
        this.setEditorMessage('Donjon régénéré.', { coaching: true });
      },
      'Régénérer',
    );
  }

  openEditor(mapId: string): void {
    this.closeActionMenus();
    this.editingMapId.set(mapId);
    this.draftMap.set(null);
    this.selectedRoomId.set(null);
    this.selectedMarkerId.set(null);
    this.clearHistory();
    const map = this.maps().find((m) => m.id === mapId);
    if (map) this.fitMapInView(map);
  }

  closeEditor(): void {
    this.closeActionMenus();
    this.setEditorFullscreen(false);
    this.flushPendingSave();
    this.draftMap.set(null);
    this.editingMapId.set(null);
    this.clearHistory();
  }

  toggleEditorFullscreen(): void {
    if (this.editorFullscreen()) return;
    this.setEditorFullscreen(true);
  }

  private setEditorFullscreen(open: boolean): void {
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

  private unlockEditorBody(): void {
    if (!this.editorBodyLocked || typeof document === 'undefined') return;
    document.body.style.overflow = this.previousBodyOverflow;
    this.editorBodyLocked = false;
  }

  deleteMap(mapId: string): void {
    this.askConfirm('Supprimer la carte', 'Supprimer cette carte ?', () => {
      const c = this.campaign();
      this.persistMaps((c.data.dungeonMaps ?? []).filter((m) => m.id !== mapId), true);
      if (this.editingMapId() === mapId) this.closeEditor();
    });
  }

  cancelConfirmDialog(): void {
    this.confirmDialog.set(null);
  }

  runConfirmDialog(): void {
    const dialog = this.confirmDialog();
    if (!dialog) return;
    this.confirmDialog.set(null);
    dialog.onConfirm();
  }

  private askConfirm(
    title: string,
    body: string,
    onConfirm: () => void,
    confirmLabel = 'Supprimer',
  ): void {
    this.confirmDialog.set({ title, body, confirmLabel, onConfirm });
  }

  /**
   * Met à jour la carte de travail tout de suite (canvas live).
   * `touchUpdatedAt` : horodatage pour thumbs / sync — à la fin de stroke ou save immédiat.
   */
  updateMap(map: CampaignDungeonMap, immediate = false, touchUpdatedAt = immediate): void {
    const updated = touchUpdatedAt ? { ...map, updatedAt: new Date().toISOString() } : { ...map };
    if (this.editingMapId() === map.id) {
      this.draftMap.set(updated);
    }
    const list = (this.campaign().data.dungeonMaps ?? []).map((m) =>
      m.id === map.id ? updated : m,
    );
    this.persistMaps(list, immediate);
  }

  patchEditingMap(patch: Partial<CampaignDungeonMap>, immediate = false): void {
    const current = this.editingMap();
    if (!current) return;
    this.updateMap({ ...current, ...patch }, immediate, immediate);
  }

  patchRoom(roomId: string, patch: Partial<CampaignDungeonMap['rooms'][0]>): void {
    const map = this.editingMap();
    if (!map) return;
    const rooms = map.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r));
    this.updateMap({ ...map, rooms });
  }

  markersForRoom(room: CampaignDungeonMap['rooms'][0]): CampaignDungeonMap['markers'] {
    const map = this.editingMap();
    if (!map) return [];
    return map.markers.filter((m) => {
      if (m.kind === 'door') return false;
      if (m.linkedRoomId === room.id) return true;
      return (
        m.x >= room.x &&
        m.y >= room.y &&
        m.x < room.x + room.width &&
        m.y < room.y + room.height
      );
    });
  }

  patchMarker(markerId: string, patch: Partial<CampaignDungeonMap['markers'][0]>): void {
    const map = this.editingMap();
    if (!map) return;
    const markers = map.markers.map((m) => (m.id === markerId ? { ...m, ...patch } : m));
    this.updateMap({ ...map, markers });
  }

  selectMarker(markerId: string): void {
    this.selectedMarkerId.set(markerId);
    const map = this.editingMap();
    const mk = map?.markers.find((m) => m.id === markerId);
    if (mk) {
      const rid = roomAt(map!, mk.x, mk.y);
      if (rid) this.selectedRoomId.set(rid);
    }
  }

  dismissMessage(): void {
    if (this.messageIsCoaching) {
      this.banners.dismiss(UI_BANNER_IDS.dungeonToast);
    }
    this.messageIsCoaching = false;
    this.message.set(null);
    this.lastHandoutNav.set(null);
  }

  private setEditorMessage(text: string, opts?: { coaching?: boolean }): void {
    if (this.banners.hideAllBanners()) return;
    if (opts?.coaching && !this.banners.isVisible(UI_BANNER_IDS.dungeonToast)) return;

    this.messageIsCoaching = !!opts?.coaching;
    this.message.set(text);
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.messageTimer = null;
      if (this.message() === text) {
        this.messageIsCoaching = false;
        this.message.set(null);
        this.lastHandoutNav.set(null);
      }
    }, 8_000);
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
    const origin = dungeonDrawOrigin(EDITOR_CELL, EDITOR_EDGE_PAD);
    const cx = (origin + (room.x + room.width / 2) * EDITOR_CELL) * s;
    const cy = (origin + (room.y + room.height / 2) * EDITOR_CELL) * s;
    this.panX.set(viewport.clientWidth / 2 - cx);
    this.panY.set(viewport.clientHeight / 2 - cy);
  }

  applyTileAt(x: number, y: number, recordUndo: boolean, fromStrokeMove = false): void {
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

    if (tool === 'fill') {
      if (fromStrokeMove) return;
      const key = `fill:${x},${y}:${this.fillKind()}`;
      if (this.lastPaintKey === key) return;
      this.lastPaintKey = key;
      if (recordUndo && !this.strokeStarted) {
        this.pushUndo(map);
        this.strokeStarted = true;
      }
      const tiles = floodFillTiles(map.tiles, x, y, this.fillKind());
      if (tiles === map.tiles) return;
      this.updateMap({ ...map, tiles }, false, false);
      return;
    }

    const key = `${tool}:${x},${y}`;
    if (this.lastPaintKey === key) return;
    this.lastPaintKey = key;

    if (recordUndo && !this.strokeStarted) {
      this.pushUndo(map);
      this.strokeStarted = true;
    }

    if (tool === 'floor' || tool === 'wall') {
      const radius = this.brushSize() - 1;
      const tiles = paintBrushDisk(map.tiles, x, y, radius, tool);
      if (tiles === map.tiles) return;
      this.updateMap({ ...map, tiles }, false, false);
      return;
    }

    if (tool === 'door') {
      if (map.tiles[y]?.[x] === tool) return;
      const tiles = setTileAt(map.tiles, x, y, tool);
      if (tiles === map.tiles) return;
      this.updateMap({ ...map, tiles }, false, false);
      return;
    }

    const markerKind = tool as DungeonMarkerKind;
    if (markerKind === 'trap' || markerKind === 'chest' || markerKind === 'stairs') {
      const existing = map.markers.findIndex((m) => m.x === x && m.y === y);
      const markers = [...map.markers];
      if (existing >= 0) {
        if (markers[existing].kind === markerKind) {
          // Toggle suppression seulement au clic initial, pas pendant un glissé.
          if (fromStrokeMove || this.strokeDragged) return;
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
      this.updateMap({ ...map, markers }, false, false);
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
      this.isDefiningRoom = false;
      this.roomDragRect.set(null);
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
    if (this.readOnly() && this.activeTool() !== 'select') return;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);

    const tile = this.clientToTile(event.clientX, event.clientY);
    // Clic hors salle (ou hors grille) → désélection, quel que soit l’outil.
    if (!tile || !roomAt(map, tile.x, tile.y)) {
      this.clearMapSelection();
    }

    if (this.activeTool() === 'room') {
      if (!tile) return;
      this.isDefiningRoom = true;
      this.isPainting.set(false);
      this.roomDragStart = tile;
      const rect = normalizeGridRect(tile.x, tile.y, tile.x, tile.y, map.gridWidth, map.gridHeight);
      this.roomDragRect.set(rect);
      return;
    }

    this.isPainting.set(true);
    this.strokeStarted = false;
    this.strokeDragged = false;
    this.lastPaintKey = null;
    this.lastPaintTile = null;
    if (tile) {
      this.lastPaintTile = tile;
      this.applyTileAt(tile.x, tile.y, true, false);
    }
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

    if (this.isDefiningRoom && this.roomDragStart) {
      const map = this.editingMap();
      const tile = this.clientToTile(event.clientX, event.clientY);
      if (!map || !tile) return;
      this.roomDragRect.set(
        normalizeGridRect(
          this.roomDragStart.x,
          this.roomDragStart.y,
          tile.x,
          tile.y,
          map.gridWidth,
          map.gridHeight,
        ),
      );
      return;
    }

    if (!this.isPainting()) return;
    if (this.activeTool() === 'select' || this.activeTool() === 'room' || this.activeTool() === 'fill')
      return;
    const tile = this.clientToTile(event.clientX, event.clientY);
    if (!tile) return;

    this.strokeDragged = true;
    const from = this.lastPaintTile;
    if (from) {
      for (const p of gridLine(from.x, from.y, tile.x, tile.y)) {
        this.applyTileAt(p.x, p.y, true, true);
      }
    } else {
      this.applyTileAt(tile.x, tile.y, true, true);
    }
    this.lastPaintTile = tile;
  }

  onPointerUp(event: PointerEvent): void {
    this.touchPointers.delete(event.pointerId);
    if (this.touchPointers.size < 2) this.pinchStartDistance = 0;
    const viewport = this.viewportRef()?.nativeElement;
    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    if (this.isDefiningRoom) {
      const rect = this.roomDragRect();
      this.isDefiningRoom = false;
      this.roomDragStart = null;
      this.roomDragRect.set(null);
      this.isPanning.set(false);
      if (rect) this.commitRoomDefinition(rect);
      return;
    }

    const wasPainting = this.isPainting();
    this.isPanning.set(false);
    this.isPainting.set(false);
    this.panOrigin = null;
    this.lastPaintKey = null;
    this.lastPaintTile = null;
    this.strokeStarted = false;
    this.strokeDragged = false;
    if (wasPainting) this.commitDraftTimestamp();
  }

  /** Crée ou redimensionne une salle depuis un rectangle grille. */
  commitRoomDefinition(rect: GridRect): void {
    const map = this.editingMap();
    if (!map || this.readOnly()) return;

    this.pushUndo(map);
    const target = findRoomToResize(map.rooms, rect, this.selectedRoomId());
    const tiles = fillRectFloor(map.tiles, rect);

    if (target) {
      const rooms = map.rooms.map((r) =>
        r.id === target.id
          ? { ...r, x: rect.x, y: rect.y, width: rect.width, height: rect.height }
          : r,
      );
      this.updateMap({ ...map, tiles, rooms }, false, true);
      this.selectedRoomId.set(target.id);
      this.setEditorMessage(`Contours de « ${target.label} » mis à jour.`);
    } else {
      const label = nextRoomLabel(map.rooms);
      const id = crypto.randomUUID?.() ?? `room-${Date.now()}`;
      const room = {
        id,
        label,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        encounterId: null,
        randomEncounter: null,
        notes: '',
      };
      this.updateMap({ ...map, tiles, rooms: [...map.rooms, room] }, false, true);
      this.selectedRoomId.set(id);
      this.setEditorMessage(`« ${label} » créée.`);
    }
    this.commitDraftTimestamp();
  }

  deleteRoom(roomId: string, event?: Event): void {
    event?.stopPropagation();
    const map = this.editingMap();
    if (!map || this.readOnly()) return;
    const room = map.rooms.find((r) => r.id === roomId);
    if (!room) return;
    this.pushUndo(map);
    const rooms = map.rooms.filter((r) => r.id !== roomId);
    const markers = map.markers.map((m) =>
      m.linkedRoomId === roomId ? { ...m, linkedRoomId: null } : m,
    );
    const revealedRoomIds = (map.revealedRoomIds ?? []).filter((id) => id !== roomId);
    this.updateMap({ ...map, rooms, markers, revealedRoomIds }, false, true);
    if (this.selectedRoomId() === roomId) this.selectedRoomId.set(null);
    this.setEditorMessage(`« ${room.label} » retirée (le dessin de la carte est conservé).`);
    this.commitDraftTimestamp();
  }

  undo(): void {
    const map = this.editingMap();
    const snap = this.undoStack.pop();
    if (!map || !snap) return;
    this.redoStack.push(this.snapshotOf(map));
    if (this.redoStack.length > MAX_UNDO) this.redoStack.shift();
    this.undoDepth.set(this.undoStack.length);
    this.redoDepth.set(this.redoStack.length);
    this.updateMap(
      { ...map, tiles: snap.tiles, markers: snap.markers, rooms: snap.rooms },
      false,
      true,
    );
    this.setEditorMessage('Annulé.');
  }

  redo(): void {
    const map = this.editingMap();
    const snap = this.redoStack.pop();
    if (!map || !snap) return;
    this.undoStack.push(this.snapshotOf(map));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.undoDepth.set(this.undoStack.length);
    this.redoDepth.set(this.redoStack.length);
    this.updateMap(
      { ...map, tiles: snap.tiles, markers: snap.markers, rooms: snap.rooms },
      false,
      true,
    );
    this.setEditorMessage('Rétabli.');
  }

  setBrushSize(size: BrushSize): void {
    this.brushSize.set(size);
  }

  setFillKind(kind: 'floor' | 'wall'): void {
    this.fillKind.set(kind);
  }

  async copyMemberMapLink(mapId?: string): Promise<void> {
    if (this.libraryMode()) return;
    const c = this.campaign();
    const id = mapId ?? this.editingMap()?.id;
    if (!c || !id) return;
    const url = `${window.location.origin}/campaigns/${c.id}?tab=maps&map=${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      this.setEditorMessage('Lien copié — accessible aux membres de la campagne.');
    } catch {
      this.setEditorMessage('Impossible de copier le lien (presse-papiers bloqué).');
    }
  }

  revealSelectedRoom(): void {
    const id = this.selectedRoomId();
    if (!id) return;
    const map = this.editingMap();
    if (!map?.fogOfWarEnabled) return;
    const current = new Set(map.revealedRoomIds ?? []);
    current.add(id);
    this.patchEditingMap({ revealedRoomIds: [...current] }, true);
    this.setEditorMessage('Salle révélée aux joueurs.');
  }

  hideSelectedRoom(): void {
    const id = this.selectedRoomId();
    if (!id) return;
    const map = this.editingMap();
    if (!map?.fogOfWarEnabled) return;
    const current = new Set(map.revealedRoomIds ?? []);
    current.delete(id);
    this.patchEditingMap({ revealedRoomIds: [...current] }, true);
    this.setEditorMessage('Salle masquée pour les joueurs.');
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

  clearMapSelection(): void {
    this.selectedRoomId.set(null);
    this.selectedMarkerId.set(null);
  }

  setTool(tool: EditorTool): void {
    this.activeTool.set(tool);
    this.isDefiningRoom = false;
    this.roomDragStart = null;
    this.roomDragRect.set(null);
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
    this.closeActionMenus();
    const map = this.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      await exportDungeonPng(map, `${map.name.replace(/\s+/g, '-')}.png`);
      this.setEditorMessage('PNG exporté.');
    } finally {
      this.exportBusy.set(false);
    }
  }

  async sharePng(): Promise<void> {
    this.closeActionMenus();
    const map = this.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      const dataUrl = dungeonMapToPngDataUrl(map, 10, playerExportDrawOptions(map));
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${map.name.replace(/\s+/g, '-')}.png`, { type: 'image/png' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: map.name });
        this.setEditorMessage('Carte partagée.');
      } else {
        await exportDungeonPng(map, `${map.name.replace(/\s+/g, '-')}.png`);
        this.setEditorMessage('PNG téléchargé (partage natif indisponible).');
      }
    } finally {
      this.exportBusy.set(false);
    }
  }

  async exportPdf(): Promise<void> {
    this.closeActionMenus();
    const map = this.editingMap();
    if (!map || this.exportBusy()) return;
    this.exportBusy.set(true);
    try {
      await exportDungeonPdf(map, this.encounters(), `${map.name.replace(/\s+/g, '-')}.pdf`);
      this.setEditorMessage('PDF exporté.');
    } finally {
      this.exportBusy.set(false);
    }
  }

  createOrUpdateHandout(opts?: { publish?: boolean }): void {
    this.closeActionMenus();
    const map = this.editingMap();
    if (!map) return;
    const c = this.campaign();
    const body = buildHandoutBody(map, this.encounters());
    const now = new Date().toISOString();
    const publish = opts?.publish === true;
    let handouts = [...(c.data.handouts ?? [])];
    let handoutId = map.handoutId ?? null;

    if (handoutId) {
      handouts = handouts.map((h) =>
        h.id === handoutId
          ? {
              ...h,
              title: map.name,
              body,
              kind: 'map' as const,
              updatedAt: now,
              ...(publish
                ? { published: true, publishedAt: h.publishedAt ?? now }
                : {}),
            }
          : h,
      );
    } else {
      const handout = createCampaignHandout(map.name);
      handout.kind = 'map';
      handout.body = body;
      handout.published = publish;
      if (publish) handout.publishedAt = now;
      handoutId = handout.id;
      handouts.push(handout);
    }

    const maps = (c.data.dungeonMaps ?? []).map((m) =>
      m.id === map.id ? { ...m, handoutId, updatedAt: now } : m,
    );
    this.dataChange.emit({ dungeonMaps: maps, handouts });
    this.lastHandoutNav.set({ handoutId: handoutId! });
    this.setEditorMessage(
      publish
        ? 'Document publié aux joueurs.'
        : 'Document brouillon enregistré — publiez pour les joueurs.',
    );
  }

  exportJson(): void {
    this.closeActionMenus();
    const map = this.editingMap();
    if (!map) return;
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.setEditorMessage('JSON exporté.');
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
    this.patchEditingMap(
      {
        fogOfWarEnabled: enabled,
        revealedRoomIds: enabled ? (map.revealedRoomIds ?? []) : [],
      },
      true,
    );
    this.setEditorMessage(
      enabled
        ? 'Brouillard de guerre activé — révélez les salles une par une.'
        : 'Brouillard de guerre désactivé.',
    );
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
    this.patchEditingMap({ revealedRoomIds: [...current] }, true);
  }

  revealAllRooms(): void {
    const map = this.editingMap();
    if (!map) return;
    this.patchEditingMap({ revealedRoomIds: map.rooms.map((r) => r.id) }, true);
    this.setEditorMessage('Toutes les salles révélées.');
  }

  hideAllRooms(): void {
    const map = this.editingMap();
    if (!map) return;
    this.patchEditingMap({ revealedRoomIds: [] }, true);
    this.setEditorMessage('Salles masquées — la table live se met à jour ; régénérez le document PNG si besoin.');
  }

  onThemeChange(raw: string): void {
    this.genTheme.set(normalizeDungeonTheme(raw));
    this.scheduleLivePreview();
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
    if (this.activeTool() === 'room' || this.activeTool() === 'fill') return 'cursor-crosshair';
    return 'cursor-crosshair';
  }

  private buildGenParams(): DungeonGenParams {
    return {
      gridWidth: this.genGridW(),
      gridHeight: this.genGridH(),
      roomCount: this.genRoomCount(),
      corridorDensity: this.genCorridorDensity(),
      theme: this.genTheme(),
      seed: this.previewSeed(),
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
    else this.previewTimer = setTimeout(run, PREVIEW_DEBOUNCE_MS);
  }

  private clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.undoDepth.set(0);
    this.redoDepth.set(0);
  }

  private snapshotOf(map: CampaignDungeonMap): UndoSnapshot {
    return {
      tiles: map.tiles.map((row) => [...row]),
      markers: map.markers.map((m) => ({ ...m })),
      rooms: map.rooms.map((r) => ({ ...r })),
    };
  }

  private pushUndo(map: CampaignDungeonMap): void {
    this.undoStack.push(this.snapshotOf(map));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.undoDepth.set(this.undoStack.length);
    this.redoStack = [];
    this.redoDepth.set(0);
  }

  private fitMapInView(map: CampaignDungeonMap): void {
    const apply = () => {
      const viewport = this.viewportRef()?.nativeElement;
      if (!viewport || viewport.clientWidth < 8 || viewport.clientHeight < 8) {
        this.scale.set(1);
        this.panX.set(16);
        this.panY.set(16);
        return;
      }
      const pad = 24;
      const drawW = (map.gridWidth + EDITOR_EDGE_PAD * 2) * EDITOR_CELL;
      const drawH = (map.gridHeight + EDITOR_EDGE_PAD * 2) * EDITOR_CELL;
      const sx = (viewport.clientWidth - pad) / drawW;
      const sy = (viewport.clientHeight - pad) / drawH;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(sx, sy, FIT_MAX_SCALE)));
      this.scale.set(+next.toFixed(2));
      const w = drawW * next;
      const h = drawH * next;
      this.panX.set((viewport.clientWidth - w) / 2);
      this.panY.set((viewport.clientHeight - h) / 2);
    };
    // Double rAF : le viewport a sa vraie taille après layout.
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }

  private clientToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const viewport = this.viewportRef()?.nativeElement;
    const map = this.editingMap();
    if (!viewport || !map) return null;
    const rect = viewport.getBoundingClientRect();
    const origin = dungeonDrawOrigin(EDITOR_CELL, EDITOR_EDGE_PAD);
    const localX = (clientX - rect.left - this.panX()) / this.scale() - origin;
    const localY = (clientY - rect.top - this.panY()) / this.scale() - origin;
    const x = Math.floor(localX / EDITOR_CELL);
    const y = Math.floor(localY / EDITOR_CELL);
    if (x < 0 || y < 0 || x >= map.gridWidth || y >= map.gridHeight) return null;
    return { x, y };
  }

  ngOnDestroy(): void {
    this.unlockEditorBody();
    this.flushPendingSave();
    this.draftMap.set(null);
  }

  /** Force l'émission d'un save debounce (changement d'onglet / navigation). */
  flushPendingSave(): void {
    this.commitDraftTimestamp();
    if (!this.saveTimer && !this.pendingMaps) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.emitPendingMaps();
  }

  /** Horodatage une fois en fin de stroke — évite de churn les thumbs à chaque case. */
  private commitDraftTimestamp(): void {
    const draft = this.draftMap();
    const id = this.editingMapId();
    if (!draft || !id || draft.id !== id) return;
    const stamped = { ...draft, updatedAt: new Date().toISOString() };
    this.draftMap.set(stamped);
    const list = (this.campaign().data.dungeonMaps ?? []).map((m) =>
      m.id === stamped.id ? stamped : m,
    );
    this.persistMaps(list, false);
  }

  private persistMaps(maps: CampaignDungeonMap[], immediate = false): void {
    this.pendingMaps = maps;
    if (immediate) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      this.emitPendingMaps();
      return;
    }
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.emitPendingMaps();
    }, 600);
  }

  private emitPendingMaps(): void {
    if (!this.pendingMaps) return;
    let maps = this.pendingMaps;
    this.pendingMaps = null;
    const draft = this.draftMap();
    if (draft) {
      const now = new Date().toISOString();
      maps = maps.map((m) => (m.id === draft.id ? { ...draft, updatedAt: now } : m));
      this.draftMap.set({ ...draft, updatedAt: now });
    }
    this.dataChange.emit({ dungeonMaps: maps });
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.editorFullscreen()) {
      event.preventDefault();
      this.setEditorFullscreen(false);
      return;
    }
    if (event.key === 'Escape' && (this.exportMenuOpen() || this.docMenuOpen())) {
      this.closeActionMenus();
      return;
    }
    if (event.key === 'Escape' && this.editingMap()) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      this.clearMapSelection();
      return;
    }
    if (event.code === 'Space' && this.editingMap()) {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        this.spaceHeld.set(true);
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && this.editingMap()) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && this.editingMap()) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      this.redo();
    }
  }

  @HostListener('document:keyup', ['$event'])
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
