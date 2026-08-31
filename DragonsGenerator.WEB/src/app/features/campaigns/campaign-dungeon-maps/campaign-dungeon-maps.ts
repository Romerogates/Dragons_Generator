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
  exportDungeonPdf,
  exportDungeonPng,
  roomAt,
  tileAt,
} from '@core/utils/dungeon-render.util';
import { rollRandomEncounter, suggestThemeFromRegion } from '@core/utils/dungeon-theme-pools';

type EditorTool = 'select' | 'floor' | 'wall' | 'door' | 'trap' | 'chest' | 'stairs';

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

@Component({
  selector: 'app-campaign-dungeon-maps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaign-dungeon-maps.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDungeonMaps {
  readonly campaign = input.required<CampaignDetail>();
  readonly dataChange = output<Partial<CampaignData>>();

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('mapCanvas');

  readonly editingMapId = signal<string | null>(null);
  readonly showGenerator = signal(false);
  readonly exportBusy = signal(false);
  readonly message = signal<string | null>(null);

  readonly scale = signal(1);
  readonly selectedRoomId = signal<string | null>(null);
  readonly selectedMarkerId = signal<string | null>(null);
  readonly activeTool = signal<EditorTool>('select');

  readonly genName = signal('Donjon');
  readonly genGridW = signal(56);
  readonly genGridH = signal(56);
  readonly genRoomCount = signal(10);
  readonly genCorridorDensity = signal(50);
  readonly genTheme = signal<DungeonTheme>('generic');

  readonly themeLabels = DUNGEON_THEME_LABELS;
  readonly markerLabels = DUNGEON_MARKER_LABELS;
  readonly themes: DungeonTheme[] = ['crypt', 'cave', 'ruins', 'temple', 'sewer', 'forest', 'generic'];
  readonly cellPx = 14;

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

  constructor() {
    effect(() => {
      const map = this.editingMap();
      const canvas = this.canvasRef()?.nativeElement;
      if (!map || !canvas) return;
      drawDungeonToCanvas(map, canvas, this.cellPx, {
        showRoomNumbers: true,
        selectedRoomId: this.selectedRoomId(),
      });
    });
  }

  openGenerator(): void {
    const c = this.campaign();
    this.genName.set(`Donjon — ${c.title}`);
    this.genTheme.set(suggestThemeFromRegion(c.data.regionName));
    this.showGenerator.set(true);
  }

  closeGenerator(): void {
    this.showGenerator.set(false);
  }

  generateMap(): void {
    const c = this.campaign();
    const params: DungeonGenParams = {
      gridWidth: this.genGridW(),
      gridHeight: this.genGridH(),
      roomCount: this.genRoomCount(),
      corridorDensity: this.genCorridorDensity(),
      theme: this.genTheme(),
    };
    const map = generateDungeonMap(params, {
      name: this.genName().trim() || 'Donjon',
      regionId: c.data.regionId,
      regionName: c.data.regionName,
    });
    this.persistMaps([...(c.data.dungeonMaps ?? []), map], true);
    this.showGenerator.set(false);
    this.editingMapId.set(map.id);
    this.selectedRoomId.set(map.rooms[0]?.id ?? null);
    this.message.set('Donjon généré.');
  }

  openEditor(mapId: string): void {
    this.editingMapId.set(mapId);
    this.selectedRoomId.set(null);
    this.selectedMarkerId.set(null);
    this.scale.set(1);
  }

  closeEditor(): void {
    this.editingMapId.set(null);
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

  markerAt(map: CampaignDungeonMap, x: number, y: number) {
    return map.markers.find((m) => m.x === x && m.y === y) ?? null;
  }

  rowIndices(map: CampaignDungeonMap): number[] {
    return Array.from({ length: map.gridHeight }, (_, i) => i);
  }

  colIndices(map: CampaignDungeonMap): number[] {
    return Array.from({ length: map.gridWidth }, (_, i) => i);
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

  onTileClick(x: number, y: number): void {
    const map = this.editingMap();
    if (!map) return;
    const tool = this.activeTool();

    if (tool === 'select') {
      const rid = roomAt(map, x, y);
      this.selectedRoomId.set(rid);
      const marker = map.markers.find((m) => m.x === x && m.y === y);
      this.selectedMarkerId.set(marker?.id ?? null);
      return;
    }

    if (tool === 'floor' || tool === 'wall' || tool === 'door') {
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
        markers.splice(existing, 1);
      }
      markers.push({
        id: crypto.randomUUID?.() ?? `mk-${Date.now()}`,
        x,
        y,
        kind: markerKind,
        label: DUNGEON_MARKER_LABELS[markerKind],
        linkedRoomId: roomAt(map, x, y),
      });
      this.updateMap({ ...map, markers });
    }
  }

  removeMarker(markerId: string): void {
    const map = this.editingMap();
    if (!map) return;
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
    this.scale.update((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)));
  }

  tileClass(map: CampaignDungeonMap, x: number, y: number): string {
    const kind = tileAt(map, x, y);
    const marker = map.markers.find((m) => m.x === x && m.y === y);
    const rid = roomAt(map, x, y);
    const base =
      kind === 'wall'
        ? 'bg-[#1e2430]'
        : kind === 'door'
          ? 'bg-amber-700'
          : 'bg-[#3d4a5c]';
    const selected = rid && rid === this.selectedRoomId() ? ' ring-1 ring-amber-400 ring-inset' : '';
    const markerRing = marker ? ' outline outline-1 outline-violet-400' : '';
    return base + selected + markerRing;
  }

  markerIcon(kind: DungeonMarkerKind): string {
    switch (kind) {
      case 'door':
        return 'D';
      case 'trap':
        return '!';
      case 'chest':
        return '$';
      case 'stairs':
        return 'S';
      default:
        return '?';
    }
  }

  encounterLabel(room: CampaignDungeonMap['rooms'][0], encounters: EncounterGroup[]): string {
    if (room.encounterId) {
      const enc = encounters.find((e) => e.id === room.encounterId);
      if (enc) {
        return enc.creatures.map((c) => `${c.quantity}× ${c.customName || c.creatureName}`).join(', ');
      }
    }
    if (room.randomEncounter?.creatures.length) {
      return room.randomEncounter.creatures
        .map((c) => `${c.quantity}× ${c.name}`)
        .join(', ');
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
    const body = buildHandoutBody(map, this.encounters());
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

  onThemeChange(raw: string): void {
    this.genTheme.set(normalizeDungeonTheme(raw));
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

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

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (!this.editingMap()) return;
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.zoom(event.deltaY > 0 ? -0.1 : 0.1);
  }
}
