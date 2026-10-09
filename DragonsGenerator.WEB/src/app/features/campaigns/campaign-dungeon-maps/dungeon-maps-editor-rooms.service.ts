import { computed, inject, Injectable, signal } from '@angular/core';
import type { EncounterGroup } from '@core/models/Campaign/campaign';
import {
  CampaignDungeonMap,
  DungeonTheme,
} from '@core/models/Campaign/dungeon-map';
import {
  dungeonEncounterLabel,
  dungeonLegendTileColor,
  DUNGEON_EDITOR_CELL,
  DUNGEON_EDITOR_EDGE_PAD,
  markersInRoom,
} from '@core/utils/dungeon-editor-ui.util';
import { dungeonDrawOrigin, roomAt } from '@core/utils/dungeon-render.util';
import {
  encounterGroupFromRandomRoll,
  rollRandomEncounter,
} from '@core/utils/dungeon-theme-pools';
import { applyDungeonRoomDelete } from '@core/utils/dungeon-map-edit.util';
import {
  isRoomRevealedOnMap,
  withAllRoomsRevealed,
  withFogToggled,
  withNoRoomsRevealed,
  withRoomRevealed,
} from '@core/utils/dungeon-fog.util';
import { DungeonMapsCore } from './dungeon-maps-core.service';
import { DungeonMapsEditorHistory } from './dungeon-maps-editor-history.service';
import { DungeonMapsEditorViewport } from './dungeon-maps-editor-viewport.service';

const EDITOR_CELL = DUNGEON_EDITOR_CELL;
const EDITOR_EDGE_PAD = DUNGEON_EDITOR_EDGE_PAD;

/** Salles, marqueurs, FoW, rencontres. Persist via le core / store. */
@Injectable()
export class DungeonMapsEditorRooms {
  private readonly core = inject(DungeonMapsCore);
  private readonly hist = inject(DungeonMapsEditorHistory);
  private readonly view = inject(DungeonMapsEditorViewport);

  readonly selectedRoomId = signal<string | null>(null);
  readonly selectedMarkerId = signal<string | null>(null);

  readonly selectedMarker = computed(() => {
    const map = this.core.editingMap();
    const mid = this.selectedMarkerId();
    if (!map || !mid) return null;
    return (map.markers ?? []).find((m) => m.id === mid) ?? null;
  });

  patchRoom(roomId: string, patch: Partial<CampaignDungeonMap['rooms'][0]>): void {
    const map = this.core.editingMap();
    if (!map) return;
    const rooms = map.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r));
    this.core.updateMap({ ...map, rooms });
  }

  markersForRoom(room: CampaignDungeonMap['rooms'][0]): CampaignDungeonMap['markers'] {
    const map = this.core.editingMap();
    if (!map) return [];
    return markersInRoom(room, map.markers);
  }

  patchMarker(markerId: string, patch: Partial<CampaignDungeonMap['markers'][0]>): void {
    const map = this.core.editingMap();
    if (!map) return;
    const markers = map.markers.map((m) => (m.id === markerId ? { ...m, ...patch } : m));
    this.core.updateMap({ ...map, markers });
  }

  selectMarker(markerId: string): void {
    this.selectedMarkerId.set(markerId);
    const map = this.core.editingMap();
    const mk = map?.markers.find((m) => m.id === markerId);
    if (mk) {
      const rid = roomAt(map!, mk.x, mk.y);
      if (rid) this.selectedRoomId.set(rid);
    }
  }

  onEncounterChange(roomId: string, encounterId: string): void {
    const map = this.core.editingMap();
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
    const map = this.core.editingMap();
    if (!map) return;
    const room = map.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const isBoss = room === map.rooms[map.rooms.length - 1];
    this.patchRoom(roomId, {
      randomEncounter: rollRandomEncounter(map.theme, isBoss),
      encounterId: null,
    });
  }

  promoteRoomEncounter(roomId: string): void {
    if (this.core.libraryMode() || this.core.readOnly()) return;
    const map = this.core.editingMap();
    if (!map) return;
    const room = map.rooms.find((r) => r.id === roomId);
    if (!room?.randomEncounter?.creatures.length) {
      this.core.setEditorMessage('Aucune rencontre aléatoire à transformer.');
      return;
    }
    const group = encounterGroupFromRandomRoll(room.randomEncounter, {
      roomLabel: room.label,
      mapName: map.name,
      theme: map.theme,
      dungeonMapId: map.id,
    });
    const encounters = [...(this.core.campaign().data.encounters ?? []), group];
    this.core.emitData({ encounters });
    this.patchRoom(roomId, { encounterId: group.id, randomEncounter: null });
    this.core.setEditorMessage(`Rencontre « ${group.name} » ajoutée à la campagne.`);
  }

  focusRoom(roomId: string): void {
    const map = this.core.editingMap();
    if (!map) return;
    this.selectedRoomId.set(roomId);
    const room = map.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const viewport = this.view.viewportEl();
    if (!viewport) return;
    const s = this.view.scale();
    const origin = dungeonDrawOrigin(EDITOR_CELL, EDITOR_EDGE_PAD);
    const cx = (origin + (room.x + room.width / 2) * EDITOR_CELL) * s;
    const cy = (origin + (room.y + room.height / 2) * EDITOR_CELL) * s;
    this.view.panX.set(viewport.clientWidth / 2 - cx);
    this.view.panY.set(viewport.clientHeight / 2 - cy);
  }

  deleteRoom(roomId: string, event?: Event): void {
    event?.stopPropagation();
    const map = this.core.editingMap();
    if (!map || this.core.readOnly()) return;
    const next = applyDungeonRoomDelete(map, roomId);
    if (!next) return;
    this.hist.push(map);
    this.core.updateMap(next.map, false, true);
    if (this.selectedRoomId() === roomId) this.selectedRoomId.set(null);
    this.core.setEditorMessage(`« ${next.label} » retirée (le dessin de la carte est conservé).`);
    this.core.commitDraftTimestamp();
  }

  revealSelectedRoom(): void {
    const id = this.selectedRoomId();
    if (!id) return;
    const map = this.core.editingMap();
    if (!map?.fogOfWarEnabled) return;
    this.core.patchEditingMap(withRoomRevealed(map, id, true), true);
    this.core.setEditorMessage('Salle révélée aux joueurs.');
  }

  hideSelectedRoom(): void {
    const id = this.selectedRoomId();
    if (!id) return;
    const map = this.core.editingMap();
    if (!map?.fogOfWarEnabled) return;
    this.core.patchEditingMap(withRoomRevealed(map, id, false), true);
    this.core.setEditorMessage('Salle masquée pour les joueurs.');
  }

  removeMarker(markerId: string): void {
    const map = this.core.editingMap();
    if (!map) return;
    this.hist.push(map);
    this.core.updateMap({
      ...map,
      markers: map.markers.filter((m) => m.id !== markerId),
    });
    this.selectedMarkerId.set(null);
  }

  clearMapSelection(): void {
    this.selectedRoomId.set(null);
    this.selectedMarkerId.set(null);
  }

  encounterLabel(room: CampaignDungeonMap['rooms'][0], encounters: EncounterGroup[]): string {
    return dungeonEncounterLabel(room, encounters);
  }

  toggleFogOfWar(): void {
    const map = this.core.editingMap();
    if (!map) return;
    const patch = withFogToggled(map);
    this.core.patchEditingMap(patch, true);
    this.core.setEditorMessage(
      patch.fogOfWarEnabled
        ? 'Brouillard de guerre activé — révélez les salles (et couloirs case par case en session).'
        : 'Brouillard de guerre désactivé.',
    );
  }

  isRoomRevealed(roomId: string): boolean {
    const map = this.core.editingMap();
    if (!map) return true;
    return isRoomRevealedOnMap(map, roomId);
  }

  toggleRoomReveal(roomId: string, event?: Event): void {
    event?.stopPropagation();
    const map = this.core.editingMap();
    if (!map) return;
    const revealed = (map.revealedRoomIds ?? []).includes(roomId);
    this.core.patchEditingMap(withRoomRevealed(map, roomId, !revealed), true);
  }

  revealAllRooms(): void {
    const map = this.core.editingMap();
    if (!map) return;
    this.core.patchEditingMap(withAllRoomsRevealed(map), true);
    this.core.setEditorMessage('Toutes les salles révélées.');
  }

  hideAllRooms(): void {
    const map = this.core.editingMap();
    if (!map) return;
    this.core.patchEditingMap(withNoRoomsRevealed(), true);
    this.core.setEditorMessage('Salles masquées — la table live se met à jour ; régénérez le document PNG si besoin.');
  }

  legendTileColor(kind: 'wall' | 'floor' | 'door', theme?: DungeonTheme): string {
    return dungeonLegendTileColor(kind, theme ?? this.core.editingMap()?.theme ?? 'generic');
  }
}
