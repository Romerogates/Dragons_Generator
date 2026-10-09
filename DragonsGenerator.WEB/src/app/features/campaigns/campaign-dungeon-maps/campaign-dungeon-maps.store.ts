import { Injectable, inject, signal } from '@angular/core';
import type { CampaignData, CampaignDetail } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import {
  DungeonCloudService,
  MAX_DUNGEONS_PER_USER,
  type CloudDungeonSummary,
} from '@core/services/dungeon-cloud.service';
import {
  geometryPayloadForLibrary,
  hasEmbeddedGeometry,
  linkLibraryDungeon,
  mapsForCampaignPersist,
} from '@core/utils/campaign-dungeon-map-ref.util';

export type MapSaveState = 'idle' | 'pending' | 'saving' | 'saved';

export type DungeonMapsStoreHooks = {
  campaign: () => CampaignDetail;
  libraryMode: () => boolean;
  draftMap: () => CampaignDungeonMap | null;
  editingMapId: () => string | null;
  setDraftMap: (map: CampaignDungeonMap | null) => void;
  emitData: (patch: Partial<CampaignData>) => void;
};

/**
 * Bibliothèque Mes Donjons + persist debounce des cartes campagne.
 * Fourni sur `CampaignDungeonMaps` (une instance par éditeur).
 */
@Injectable()
export class CampaignDungeonMapsStore {
  private readonly dungeonCloud = inject(DungeonCloudService);
  private hooks: DungeonMapsStoreHooks | null = null;

  readonly libraryList = signal<CloudDungeonSummary[]>([]);
  readonly libraryBusy = signal(false);
  readonly libraryGeometryCache = signal(new Map<string, CampaignDungeonMap>());
  readonly hydratingEditor = signal(false);
  readonly mapSaveState = signal<MapSaveState>('idle');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveStateTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMaps: CampaignDungeonMap[] | null = null;
  private readonly migratingIds = new Set<string>();

  configure(hooks: DungeonMapsStoreHooks): void {
    this.hooks = hooks;
  }

  destroy(): void {
    this.flushPendingSave();
    if (this.saveStateTimer) {
      clearTimeout(this.saveStateTimer);
      this.saveStateTimer = null;
    }
  }

  loadLibraryList(onError: () => void): void {
    this.libraryBusy.set(true);
    this.dungeonCloud.list().subscribe({
      next: (list) => {
        this.libraryList.set(list);
        this.libraryBusy.set(false);
      },
      error: () => {
        this.libraryBusy.set(false);
        onError();
      },
    });
  }

  importFromLibrary(
    summary: CloudDungeonSummary,
    onOk: (linked: CampaignDungeonMap) => void,
    onError: () => void,
  ): void {
    if (this.libraryBusy()) return;
    this.libraryBusy.set(true);
    this.dungeonCloud.get(summary.id).subscribe({
      next: (detail) => {
        const linked = linkLibraryDungeon(detail.data, detail.id, detail.name);
        const c = this.requireCampaign();
        this.cacheLibraryGeometry(detail.id, detail.data);
        this.persistMaps([...(c.data.dungeonMaps ?? []), linked], true);
        this.libraryBusy.set(false);
        onOk(linked);
      },
      error: () => {
        this.libraryBusy.set(false);
        onError();
      },
    });
  }

  saveEditingToLibrary(
    map: CampaignDungeonMap,
    onLinked: (linked: CampaignDungeonMap) => void,
    onUpdated: () => void,
    onQuota: () => void,
  ): void {
    if (this.libraryMode() || this.libraryBusy()) return;
    this.libraryBusy.set(true);
    const payload = geometryPayloadForLibrary(map);
    const existingLibId = map.libraryDungeonId;
    const req$ = existingLibId
      ? this.dungeonCloud.update(existingLibId, payload, map.name)
      : this.dungeonCloud.create(payload, map.name);
    req$.subscribe({
      next: (summary) => {
        this.libraryBusy.set(false);
        this.cacheLibraryGeometry(summary.id, payload);
        if (!existingLibId) {
          onLinked({ ...map, libraryDungeonId: summary.id, updatedAt: new Date().toISOString() });
        } else {
          onUpdated();
        }
      },
      error: () => {
        this.libraryBusy.set(false);
        onQuota();
      },
    });
  }

  duplicateLinkedToLibrary(
    map: CampaignDungeonMap,
    onOk: (list: CampaignDungeonMap[]) => void,
    onQuota: () => void,
  ): void {
    if (this.libraryMode() || this.libraryBusy() || !hasEmbeddedGeometry(map)) return;
    this.libraryBusy.set(true);
    const payload = geometryPayloadForLibrary({
      ...map,
      name: `${map.name} (copie)`,
      id: crypto.randomUUID?.() ?? `map-${Date.now()}`,
    });
    this.dungeonCloud.create(payload, payload.name).subscribe({
      next: (summary) => {
        const linked = linkLibraryDungeon(payload, summary.id, payload.name);
        this.cacheLibraryGeometry(summary.id, payload);
        const list = (this.requireCampaign().data.dungeonMaps ?? []).map((m) =>
          m.id === map.id
            ? {
                ...linked,
                id: map.id,
                handoutId: map.handoutId,
                fogOfWarEnabled: map.fogOfWarEnabled,
                revealedRoomIds: map.revealedRoomIds,
                revealedCorridorCells: map.revealedCorridorCells,
              }
            : m,
        );
        this.persistMaps(list, true);
        this.libraryBusy.set(false);
        onOk(list);
      },
      error: () => {
        this.libraryBusy.set(false);
        onQuota();
      },
    });
  }

  publishGeneratedMap(
    named: CampaignDungeonMap,
    onOk: (map: CampaignDungeonMap) => void,
    onQuota: () => void,
  ): void {
    const c = this.requireCampaign();
    if (this.libraryMode()) {
      this.persistMaps([...(c.data.dungeonMaps ?? []), named], true);
      onOk(named);
      return;
    }
    const payload = geometryPayloadForLibrary(named);
    this.dungeonCloud.create(payload, named.name).subscribe({
      next: (summary) => {
        const linked = linkLibraryDungeon(payload, summary.id, named.name);
        this.cacheLibraryGeometry(summary.id, payload);
        this.persistMaps([...(this.requireCampaign().data.dungeonMaps ?? []), linked], true);
        onOk(linked);
      },
      error: () => onQuota(),
    });
  }

  ensureLibraryHydrated(libraryId: string, then?: () => void, onError?: () => void): void {
    if (this.libraryGeometryCache().has(libraryId)) {
      then?.();
      return;
    }
    this.hydratingEditor.set(true);
    this.dungeonCloud.get(libraryId).subscribe({
      next: (detail) => {
        this.cacheLibraryGeometry(libraryId, detail.data);
        this.hydratingEditor.set(false);
        then?.();
      },
      error: () => {
        this.hydratingEditor.set(false);
        onError?.();
      },
    });
  }

  cacheLibraryGeometry(libraryId: string, data: CampaignDungeonMap): void {
    const next = new Map(this.libraryGeometryCache());
    next.set(libraryId, structuredClone(data));
    this.libraryGeometryCache.set(next);
  }

  commitDraftTimestamp(): void {
    const draft = this.hooks?.draftMap() ?? null;
    const id = this.hooks?.editingMapId() ?? null;
    if (!draft || !id || draft.id !== id) return;
    const stamped = { ...draft, updatedAt: new Date().toISOString() };
    this.hooks?.setDraftMap(stamped);
    const list = (this.requireCampaign().data.dungeonMaps ?? []).map((m) =>
      m.id === stamped.id ? stamped : m,
    );
    this.persistMaps(list, false);
  }

  flushPendingSave(): void {
    this.commitDraftTimestamp();
    if (!this.saveTimer && !this.pendingMaps) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.emitPendingMaps();
  }

  persistMaps(maps: CampaignDungeonMap[], immediate = false): void {
    this.pendingMaps = maps;
    if (!this.libraryMode()) {
      this.mapSaveState.set(immediate ? 'saving' : 'pending');
    }
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

  quotaMessage(kind: 'save' | 'duplicate' | 'generate'): string {
    if (kind === 'duplicate') {
      return `Limite atteinte : maximum ${MAX_DUNGEONS_PER_USER} donjons dans Mes Donjons. Impossible de dupliquer.`;
    }
    if (kind === 'generate') {
      return `Limite atteinte : maximum ${MAX_DUNGEONS_PER_USER} donjons dans Mes Donjons. Génération annulée.`;
    }
    return `Limite atteinte : maximum ${MAX_DUNGEONS_PER_USER} donjons dans Mes Donjons. Supprimez-en un ou synchronisez une carte déjà liée.`;
  }

  private emitPendingMaps(): void {
    if (!this.pendingMaps) return;
    let maps = this.pendingMaps;
    this.pendingMaps = null;
    const draft = this.hooks?.draftMap() ?? null;
    if (draft) {
      const now = new Date().toISOString();
      maps = maps.map((m) => (m.id === draft.id ? { ...draft, updatedAt: now } : m));
      this.hooks?.setDraftMap({ ...draft, updatedAt: now });
    }

    if (!this.libraryMode()) {
      this.mapSaveState.set('saving');
    }

    for (const m of maps) {
      if (!m.libraryDungeonId || !hasEmbeddedGeometry(m) || this.libraryMode()) continue;
      const payload = geometryPayloadForLibrary(m);
      this.cacheLibraryGeometry(m.libraryDungeonId, payload);
      this.dungeonCloud.update(m.libraryDungeonId, payload, m.name).subscribe({
        error: () => {
          /* soft-fail : overlay campagne déjà persisté */
        },
      });
    }

    const migrated = maps.map((m) => {
      if (m.libraryDungeonId || !hasEmbeddedGeometry(m) || this.libraryMode()) return m;
      this.tryMigrateLegacyMap(m);
      return m;
    });

    this.hooks?.emitData({ dungeonMaps: mapsForCampaignPersist(migrated) });

    if (!this.libraryMode()) {
      if (this.saveStateTimer) clearTimeout(this.saveStateTimer);
      this.saveStateTimer = setTimeout(() => {
        this.saveStateTimer = null;
        this.mapSaveState.set('saved');
      }, 400);
    }
  }

  private tryMigrateLegacyMap(map: CampaignDungeonMap): void {
    if (this.migratingIds.has(map.id) || !hasEmbeddedGeometry(map)) return;
    this.migratingIds.add(map.id);
    const payload = geometryPayloadForLibrary(map);
    this.dungeonCloud.create(payload, map.name).subscribe({
      next: (summary) => {
        this.cacheLibraryGeometry(summary.id, payload);
        const linked = {
          ...linkLibraryDungeon(payload, summary.id, map.name),
          id: map.id,
          handoutId: map.handoutId,
          fogOfWarEnabled: map.fogOfWarEnabled,
          revealedRoomIds: map.revealedRoomIds,
          rooms: map.rooms,
        };
        const list = (this.requireCampaign().data.dungeonMaps ?? []).map((m) =>
          m.id === map.id ? linked : m,
        );
        this.migratingIds.delete(map.id);
        this.hooks?.emitData({ dungeonMaps: mapsForCampaignPersist(list) });
      },
      error: () => {
        this.migratingIds.delete(map.id);
      },
    });
  }

  private requireCampaign(): CampaignDetail {
    const c = this.hooks?.campaign();
    if (!c) throw new Error('CampaignDungeonMapsStore: campaign not bound');
    return c;
  }

  private libraryMode(): boolean {
    return this.hooks?.libraryMode() === true;
  }
}
