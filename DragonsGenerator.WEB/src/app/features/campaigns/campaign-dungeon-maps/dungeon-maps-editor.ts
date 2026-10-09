import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FullscreenEnterBtn } from '@shared/components/fullscreen-enter-btn/fullscreen-enter-btn';
import {
  drawDungeonToCanvas,
  fogRevealSet,
} from '@core/utils/dungeon-render.util';
import {
  DUNGEON_EDITOR_CELL,
  DUNGEON_EDITOR_EDGE_PAD,
} from '@core/utils/dungeon-editor-ui.util';
import type { DungeonMapsHost } from './dungeon-maps-host';
import { DungeonMapsEditorAside } from './dungeon-maps-editor-aside';

@Component({
  selector: 'app-dungeon-maps-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FullscreenEnterBtn, DungeonMapsEditorAside],
  templateUrl: './dungeon-maps-editor.html',
  styleUrl: './campaign-dungeon-maps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DungeonMapsEditor {
  readonly host = input.required<DungeonMapsHost>();
  readonly editorCanvas = viewChild<ElementRef<HTMLCanvasElement>>('editorCanvas');
  readonly viewport = viewChild<ElementRef<HTMLDivElement>>('viewport');

  constructor() {
    effect(() => {
      const h = this.host();
      const map = h.core.editingMap();
      const canvas = this.editorCanvas()?.nativeElement;
      if (!map || !canvas) return;
      drawDungeonToCanvas(map, canvas, DUNGEON_EDITOR_CELL, {
        showRoomNumbers: true,
        selectedRoomId: h.editor.rooms.selectedRoomId(),
        previewRoomRect: h.editor.paint.roomDragRect(),
        vignette: true,
        revealedRoomIds: fogRevealSet(map),
        edgePadCells: DUNGEON_EDITOR_EDGE_PAD,
      });
    });
  }
}
