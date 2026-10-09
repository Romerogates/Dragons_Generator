import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  CampaignData,
  CampaignDetail,
  CampaignHandout,
} from '@core/models/Campaign/campaign';
import {
  CampaignDungeonMap,
  DUNGEON_MARKER_LABELS,
  DUNGEON_THEME_LABELS,
} from '@core/models/Campaign/dungeon-map';
import { dungeonMapToPngDataUrl } from '@core/utils/dungeon-render.util';
import { formatDungeonMapDate } from '@core/utils/dungeon-editor-ui.util';
import {
  UI_BANNER_IDS,
  UiBannerPreferencesService,
} from '@core/services/ui-banner-preferences.service';
import {
  hasEmbeddedGeometry,
  mergeLibraryGeometry,
  needsLibraryHydration,
} from '@core/utils/campaign-dungeon-map-ref.util';
import { CampaignDungeonMapsStore } from './campaign-dungeon-maps.store';

export type DungeonMapsWorkspaceBind = {
  campaign: () => CampaignDetail;
  libraryMode: () => boolean;
  readOnly: () => boolean;
  focusMapId: () => string | null;
  autoAction: () => 'generate' | 'import' | null;
  emitData: (patch: Partial<CampaignData>) => void;
  viewportEl: () => HTMLDivElement | undefined;
};

const THUMB_CELL = 3;

/**
 * Cartes persistées, draft, messages — persist via `CampaignDungeonMapsStore` uniquement.
 */
@Injectable()
export class DungeonMapsCore {
  private readonly banners = inject(UiBannerPreferencesService);
  readonly mapsStore = inject(CampaignDungeonMapsStore);

  campaign!: () => CampaignDetail;
  libraryMode!: () => boolean;
  readOnly!: () => boolean;
  focusMapId!: () => string | null;
  autoAction!: () => 'generate' | 'import' | null;
  emitData!: (patch: Partial<CampaignData>) => void;
  private viewportHook!: () => HTMLDivElement | undefined;

  readonly editingMapId = signal<string | null>(null);
  readonly draftMap = signal<CampaignDungeonMap | null>(null);
  readonly confirmDialog = signal<{
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);
  readonly message = signal<string | null>(null);
  readonly lastHandoutNav = signal<{ handoutId: string } | null>(null);
  readonly thumbUrls = signal<Record<string, string>>({});
  readonly libraryPickerOpen = signal(false);

  readonly libraryList = this.mapsStore.libraryList;
  readonly libraryBusy = this.mapsStore.libraryBusy;
  readonly mapSaveState = this.mapsStore.mapSaveState;
  readonly libraryGeometryCache = this.mapsStore.libraryGeometryCache;
  readonly hydratingEditor = this.mapsStore.hydratingEditor;

  readonly themeLabels = DUNGEON_THEME_LABELS;
  readonly markerLabels = DUNGEON_MARKER_LABELS;
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

  private thumbCache = new Map<string, string>();
  private messageTimer: ReturnType<typeof setTimeout> | null = null;
  private messageIsCoaching = false;

  readonly maps = computed(() => this.campaign().data.dungeonMaps ?? []);
  readonly encounters = computed(() => this.campaign().data.encounters ?? []);

  readonly editingMap = computed(() => {
    const id = this.editingMapId();
    if (!id) return null;
    const draft = this.draftMap();
    if (draft && draft.id === id) return draft;
    const base = this.maps().find((m) => m.id === id) ?? null;
    if (!base) return null;
    if (!needsLibraryHydration(base)) return base;
    const libId = base.libraryDungeonId!;
    const cached = this.libraryGeometryCache().get(libId);
    return cached ? mergeLibraryGeometry(base, cached) : base;
  });

  readonly sortedMaps = computed(() =>
    [...this.maps()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  );

  bind(opts: DungeonMapsWorkspaceBind): void {
    this.campaign = opts.campaign;
    this.libraryMode = opts.libraryMode;
    this.readOnly = opts.readOnly;
    this.focusMapId = opts.focusMapId;
    this.autoAction = opts.autoAction;
    this.emitData = opts.emitData;
    this.viewportHook = opts.viewportEl;
    this.mapsStore.configure({
      campaign: () => this.campaign(),
      libraryMode: () => this.libraryMode(),
      draftMap: () => this.draftMap(),
      editingMapId: () => this.editingMapId(),
      setDraftMap: (map) => this.draftMap.set(map),
      emitData: (patch) => this.emitData(patch),
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

  viewportEl(): HTMLDivElement | undefined {
    return this.viewportHook?.();
  }

  commitMapPatch(map: CampaignDungeonMap, immediate = false): void {
    const list = (this.campaign().data.dungeonMaps ?? []).map((m) => (m.id === map.id ? map : m));
    this.draftMap.set(map);
    this.persistMaps(list, immediate);
  }

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

  persistMaps(maps: CampaignDungeonMap[], immediate = false): void {
    this.mapsStore.persistMaps(maps, immediate);
  }

  commitDraftTimestamp(): void {
    this.mapsStore.commitDraftTimestamp();
  }

  flushPendingSave(): void {
    this.mapsStore.flushPendingSave();
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

  askConfirm(
    title: string,
    body: string,
    onConfirm: () => void,
    confirmLabel = 'Supprimer',
  ): void {
    this.confirmDialog.set({ title, body, confirmLabel, onConfirm });
  }

  dismissMessage(): void {
    if (this.messageIsCoaching) {
      this.banners.dismiss(UI_BANNER_IDS.dungeonToast);
    }
    this.messageIsCoaching = false;
    this.message.set(null);
    this.lastHandoutNav.set(null);
  }

  setEditorMessage(text: string, opts?: { coaching?: boolean }): void {
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

  handoutForMap(map: CampaignDungeonMap): CampaignHandout | null {
    if (!map.handoutId) return null;
    return (this.campaign().data.handouts ?? []).find((h) => h.id === map.handoutId) ?? null;
  }

  formatDate(iso: string): string {
    return formatDungeonMapDate(iso);
  }

  canEmbedGeometry(map: CampaignDungeonMap): boolean {
    return hasEmbeddedGeometry(map);
  }

  destroy(): void {
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.mapsStore.destroy();
    this.draftMap.set(null);
  }
}
