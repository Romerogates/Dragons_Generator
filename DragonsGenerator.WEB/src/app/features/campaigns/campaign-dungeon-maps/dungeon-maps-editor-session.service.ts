import { inject, Injectable } from '@angular/core';
import { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';
import { generateDungeonMap } from '@core/utils/dungeon-generator.util';
import { mergeRegeneratedDungeonMap } from '@core/utils/dungeon-map-edit.util';
import {
  hasEmbeddedGeometry,
  needsLibraryHydration,
} from '@core/utils/campaign-dungeon-map-ref.util';
import { DungeonMapsCore } from './dungeon-maps-core.service';
import { DungeonMapsEditorFiles } from './dungeon-maps-editor-files.service';
import { DungeonMapsEditorHistory } from './dungeon-maps-editor-history.service';
import { DungeonMapsEditorPaint } from './dungeon-maps-editor-paint.service';
import { DungeonMapsEditorRooms } from './dungeon-maps-editor-rooms.service';
import { DungeonMapsEditorViewport } from './dungeon-maps-editor-viewport.service';

/**
 * Compose session éditeur : view / hist / paint / rooms / files.
 * Persist via le core / store.
 */
@Injectable()
export class DungeonMapsEditorSession {
  private readonly core = inject(DungeonMapsCore);
  readonly view = inject(DungeonMapsEditorViewport);
  readonly hist = inject(DungeonMapsEditorHistory);
  readonly paint = inject(DungeonMapsEditorPaint);
  readonly rooms = inject(DungeonMapsEditorRooms);
  readonly files = inject(DungeonMapsEditorFiles);

  afterGenerate(named: CampaignDungeonMap): void {
    this.rooms.selectedRoomId.set(named.rooms?.[0]?.id ?? null);
    this.hist.clear();
    this.view.fitMapInView(named);
  }

  saveEditingToLibrary(): void {
    const map = this.core.editingMap();
    if (!map || this.core.libraryMode() || this.core.libraryBusy()) return;
    this.files.closeActionMenus();
    this.core.mapsStore.saveEditingToLibrary(
      map,
      (linked) => {
        this.core.commitMapPatch(linked, true);
        this.core.setEditorMessage('Lié à Mes Donjons (live).');
      },
      () => this.core.setEditorMessage('Mes Donjons mis à jour.'),
      () => this.core.setEditorMessage(this.core.mapsStore.quotaMessage('save')),
    );
  }

  duplicateLinkedToLibrary(): void {
    const map = this.core.editingMap();
    if (!map || this.core.libraryMode() || this.core.libraryBusy() || !hasEmbeddedGeometry(map)) {
      return;
    }
    this.files.closeActionMenus();
    this.core.mapsStore.duplicateLinkedToLibrary(
      map,
      () => {
        this.core.draftMap.set(null);
        this.core.setEditorMessage('Copie isolée dans Mes Donjons — cette table pointe dessus.');
        this.openEditor(map.id);
      },
      () => this.core.setEditorMessage(this.core.mapsStore.quotaMessage('duplicate')),
    );
  }

  regenerateEditingMap(): void {
    const current = this.core.editingMap();
    if (!current) return;
    this.core.askConfirm(
      'Régénérer le donjon',
      'Régénérer ce donjon ? Les modifications de cases seront perdues.',
      () => {
        this.hist.push(current);
        const c = this.core.campaign();
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
        const merged = mergeRegeneratedDungeonMap(
          current,
          next,
          new Date().toISOString(),
        );
        this.core.updateMap(merged, false, true);
        this.rooms.selectedRoomId.set(merged.rooms[0]?.id ?? null);
        this.view.fitMapInView(merged);
        this.core.setEditorMessage('Donjon régénéré.', { coaching: true });
      },
      'Régénérer',
    );
  }

  openEditor(mapId: string): void {
    this.files.closeActionMenus();
    this.core.editingMapId.set(mapId);
    this.core.draftMap.set(null);
    this.rooms.selectedRoomId.set(null);
    this.rooms.selectedMarkerId.set(null);
    this.hist.clear();
    const map = this.core.maps().find((m) => m.id === mapId);
    if (!map) return;
    if (needsLibraryHydration(map) && map.libraryDungeonId) {
      this.core.mapsStore.ensureLibraryHydrated(
        map.libraryDungeonId,
        () => {
          const hydrated = this.core.editingMap();
          if (hydrated) this.view.fitMapInView(hydrated);
        },
        () => this.core.setEditorMessage('Impossible de charger la géométrie depuis Mes Donjons.'),
      );
      return;
    }
    this.view.fitMapInView(map);
  }

  closeEditor(): void {
    this.files.closeActionMenus();
    this.view.setEditorFullscreen(false);
    this.core.flushPendingSave();
    this.core.draftMap.set(null);
    this.core.editingMapId.set(null);
    this.hist.clear();
  }

  deleteMap(mapId: string): void {
    this.core.askConfirm('Supprimer la carte', 'Supprimer cette carte ?', () => {
      this.core.persistMaps((this.core.campaign().data.dungeonMaps ?? []).filter((m) => m.id !== mapId), true);
      if (this.core.editingMapId() === mapId) this.closeEditor();
    });
  }

  destroy(): void {
    this.view.destroy();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.view.editorFullscreen()) {
      event.preventDefault();
      this.view.setEditorFullscreen(false);
      return;
    }
    if (event.key === 'Escape' && (this.files.exportMenuOpen() || this.files.docMenuOpen())) {
      this.files.closeActionMenus();
      return;
    }
    if (event.key === 'Escape' && this.core.editingMap()) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      this.rooms.clearMapSelection();
      return;
    }
    if (event.code === 'Space' && this.core.editingMap()) {
      if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        this.paint.spaceHeld.set(true);
      }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && this.core.editingMap()) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      if (event.shiftKey) this.hist.redo();
      else this.hist.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && this.core.editingMap()) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      this.hist.redo();
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') this.paint.spaceHeld.set(false);
  }

  onWheel(event: WheelEvent): void {
    this.view.onWheel(event);
  }
}
