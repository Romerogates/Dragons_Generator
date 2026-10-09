import { computed, inject, Injectable, signal } from '@angular/core';
import {
  CampaignDungeonMap,
  DungeonTileKind,
} from '@core/models/Campaign/dungeon-map';
import { DungeonUndoStack } from '@core/utils/dungeon-undo.util';
import { DungeonMapsCore } from './dungeon-maps-core.service';

interface UndoSnapshot {
  tiles: DungeonTileKind[][];
  markers: CampaignDungeonMap['markers'];
  rooms: CampaignDungeonMap['rooms'];
}

const MAX_UNDO = 40;

/** Undo/redo géométrie. Persist via le core / store. */
@Injectable()
export class DungeonMapsEditorHistory {
  private readonly core = inject(DungeonMapsCore);

  readonly undoDepth = signal(0);
  readonly redoDepth = signal(0);
  readonly canUndo = computed(() => this.undoDepth() > 0);
  readonly canRedo = computed(() => this.redoDepth() > 0);

  private readonly history = new DungeonUndoStack<
    DungeonTileKind[][],
    CampaignDungeonMap['markers'],
    CampaignDungeonMap['rooms']
  >(MAX_UNDO);

  clear(): void {
    this.history.clear();
    this.syncDepth();
  }

  push(map: CampaignDungeonMap): void {
    this.history.push(this.snapshotOf(map));
    this.syncDepth();
  }

  undo(): void {
    const map = this.core.editingMap();
    if (!map) return;
    const snap = this.history.undoOnce(this.snapshotOf(map));
    if (!snap) return;
    this.syncDepth();
    this.core.updateMap(
      { ...map, tiles: snap.tiles, markers: snap.markers, rooms: snap.rooms },
      false,
      true,
    );
    this.core.setEditorMessage('Annulé.');
  }

  redo(): void {
    const map = this.core.editingMap();
    if (!map) return;
    const snap = this.history.redoOnce(this.snapshotOf(map));
    if (!snap) return;
    this.syncDepth();
    this.core.updateMap(
      { ...map, tiles: snap.tiles, markers: snap.markers, rooms: snap.rooms },
      false,
      true,
    );
    this.core.setEditorMessage('Rétabli.');
  }

  private snapshotOf(map: CampaignDungeonMap): UndoSnapshot {
    return {
      tiles: map.tiles.map((row) => [...row]),
      markers: map.markers.map((m) => ({ ...m })),
      rooms: map.rooms.map((r) => ({ ...r })),
    };
  }

  private syncDepth(): void {
    this.undoDepth.set(this.history.undoDepth);
    this.redoDepth.set(this.history.redoDepth);
  }
}
