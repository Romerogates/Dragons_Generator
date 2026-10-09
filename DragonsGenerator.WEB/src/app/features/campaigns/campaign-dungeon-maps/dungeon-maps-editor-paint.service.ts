import { computed, inject, Injectable, signal } from '@angular/core';
import { roomAt } from '@core/utils/dungeon-render.util';
import { gridLine } from '@core/utils/dungeon-paint.util';
import { normalizeGridRect, type GridRect } from '@core/utils/dungeon-room-edit.util';
import {
  dungeonEditorCursorClass,
  DUNGEON_EDITOR_TOOLS,
  type DungeonEditorTool,
} from '@core/utils/dungeon-editor-ui.util';
import {
  applyDungeonEditorPaint,
  applyDungeonRoomDefinition,
  clientToDungeonTile,
} from '@core/utils/dungeon-map-edit.util';
import { DungeonMapsCore } from './dungeon-maps-core.service';
import { DungeonMapsEditorHistory } from './dungeon-maps-editor-history.service';
import { DungeonMapsEditorRooms } from './dungeon-maps-editor-rooms.service';
import { DungeonMapsEditorViewport } from './dungeon-maps-editor-viewport.service';

type EditorTool = DungeonEditorTool;
export type BrushSize = 1 | 2 | 3;

/** Outils, pointeur, brosse. Persist via le core / store. */
@Injectable()
export class DungeonMapsEditorPaint {
  private readonly core = inject(DungeonMapsCore);
  private readonly view = inject(DungeonMapsEditorViewport);
  private readonly hist = inject(DungeonMapsEditorHistory);
  private readonly rooms = inject(DungeonMapsEditorRooms);

  readonly activeTool = signal<EditorTool>('select');
  readonly brushSize = signal<BrushSize>(1);
  readonly fillKind = signal<'floor' | 'wall'>('floor');
  readonly spaceHeld = signal(false);
  readonly isPanning = signal(false);
  readonly isPainting = signal(false);
  readonly pinchActive = signal(false);
  readonly roomDragRect = signal<GridRect | null>(null);

  readonly tools = DUNGEON_EDITOR_TOOLS;
  readonly brushSizes: BrushSize[] = [1, 2, 3];

  readonly mapLocksPageScroll = computed(
    () => this.isPanning() || this.isPainting() || this.pinchActive(),
  );

  private panOrigin: { x: number; y: number; panX: number; panY: number } | null = null;
  private touchPointers = new Map<number, { x: number; y: number }>();
  private pinchStartDistance = 0;
  private pinchStartScale = 1;
  private lastPaintKey: string | null = null;
  private lastPaintTile: { x: number; y: number } | null = null;
  private strokeStarted = false;
  private strokeDragged = false;
  private roomDragStart: { x: number; y: number } | null = null;
  private isDefiningRoom = false;

  cursorClass(): string {
    return dungeonEditorCursorClass({
      isPanning: this.isPanning(),
      spaceHeld: this.spaceHeld(),
      tool: this.activeTool(),
    });
  }

  setBrushSize(size: BrushSize): void {
    this.brushSize.set(size);
  }

  setFillKind(kind: 'floor' | 'wall'): void {
    this.fillKind.set(kind);
  }

  setTool(tool: EditorTool): void {
    this.activeTool.set(tool);
    this.isDefiningRoom = false;
    this.roomDragStart = null;
    this.roomDragRect.set(null);
  }

  applyTileAt(x: number, y: number, recordUndo: boolean, fromStrokeMove = false): void {
    const map = this.core.editingMap();
    if (!map) return;
    const result = applyDungeonEditorPaint({
      map,
      tool: this.activeTool(),
      x,
      y,
      fillKind: this.fillKind(),
      brushSize: this.brushSize(),
      lastPaintKey: this.lastPaintKey,
      fromStrokeMove,
      strokeDragged: this.strokeDragged,
    });
    if (result.kind === 'oob') return;
    if ('paintKey' in result && result.paintKey) this.lastPaintKey = result.paintKey;
    if (result.kind === 'select') {
      this.rooms.selectedRoomId.set(result.roomId);
      this.rooms.selectedMarkerId.set(result.markerId);
      return;
    }
    if (result.kind === 'noop') return;
    if (recordUndo && !this.strokeStarted) {
      this.hist.push(map);
      this.strokeStarted = true;
    }
    if (result.kind === 'tiles') this.core.updateMap({ ...map, tiles: result.tiles }, false, false);
    else this.core.updateMap({ ...map, markers: result.markers }, false, false);
  }

  onPointerDown(event: PointerEvent): void {
    const map = this.core.editingMap();
    const viewport = this.view.viewportEl();
    if (!map || !viewport) return;

    this.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.touchPointers.size === 2) {
      this.pinchActive.set(true);
      this.isPainting.set(false);
      this.isPanning.set(false);
      this.isDefiningRoom = false;
      this.roomDragRect.set(null);
      const pts = [...this.touchPointers.values()];
      this.pinchStartDistance = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      this.pinchStartScale = this.view.scale();
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
        panX: this.view.panX(),
        panY: this.view.panY(),
      };
      viewport.setPointerCapture(event.pointerId);
      return;
    }

    if (event.button !== 0) return;
    if (this.core.readOnly() && this.activeTool() !== 'select') return;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);

    const tile = this.clientToTile(event.clientX, event.clientY);
    if (!tile || !roomAt(map, tile.x, tile.y)) {
      this.rooms.clearMapSelection();
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
      const next = this.view.clampScale(this.pinchStartScale * (dist / this.pinchStartDistance));
      this.view.scale.set(+next.toFixed(2));
      return;
    }
    if (this.isPanning() && this.panOrigin) {
      const dx = event.clientX - this.panOrigin.x;
      const dy = event.clientY - this.panOrigin.y;
      this.view.panX.set(this.panOrigin.panX + dx);
      this.view.panY.set(this.panOrigin.panY + dy);
      return;
    }

    if (this.isDefiningRoom && this.roomDragStart) {
      const map = this.core.editingMap();
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
    if (this.touchPointers.size < 2) {
      this.pinchStartDistance = 0;
      this.pinchActive.set(false);
    }
    const viewport = this.view.viewportEl();
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
    if (wasPainting) this.core.commitDraftTimestamp();
  }

  commitRoomDefinition(rect: GridRect): void {
    const map = this.core.editingMap();
    if (!map || this.core.readOnly()) return;

    this.hist.push(map);
    const next = applyDungeonRoomDefinition(map, rect, this.rooms.selectedRoomId());
    this.core.updateMap(next.map, false, true);
    this.rooms.selectedRoomId.set(next.selectedRoomId);
    this.core.setEditorMessage(next.message);
    this.core.commitDraftTimestamp();
  }

  private clientToTile(clientX: number, clientY: number): { x: number; y: number } | null {
    const viewport = this.view.viewportEl();
    const map = this.core.editingMap();
    if (!viewport || !map) return null;
    const rect = viewport.getBoundingClientRect();
    return clientToDungeonTile({
      clientX,
      clientY,
      rectLeft: rect.left,
      rectTop: rect.top,
      panX: this.view.panX(),
      panY: this.view.panY(),
      scale: this.view.scale(),
      gridWidth: map.gridWidth,
      gridHeight: map.gridHeight,
    });
  }
}
