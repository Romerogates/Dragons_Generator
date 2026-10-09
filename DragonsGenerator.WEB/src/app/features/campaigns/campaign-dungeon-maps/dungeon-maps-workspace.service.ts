import { effect, inject, Injectable } from '@angular/core';
import type { CloudDungeonSummary } from '@core/services/dungeon-cloud.service';
import {
  DungeonMapsCore,
  type DungeonMapsWorkspaceBind,
} from './dungeon-maps-core.service';
import { DungeonMapsGenerateService } from './dungeon-maps-generate.service';
import { DungeonMapsEditorSession } from './dungeon-maps-editor-session.service';

export type { DungeonMapsWorkspaceBind };

/**
 * Compose donjon : core (persist) + gen + editor.
 * Fourni sur `CampaignDungeonMaps`. Persist via `CampaignDungeonMapsStore`.
 */
@Injectable()
export class DungeonMapsWorkspace {
  readonly core = inject(DungeonMapsCore);
  readonly gen = inject(DungeonMapsGenerateService);
  readonly editor = inject(DungeonMapsEditorSession);

  private autoActionConsumed = false;

  bind(opts: DungeonMapsWorkspaceBind): void {
    this.core.bind(opts);

    effect(() => {
      const id = this.core.focusMapId();
      if (!id) return;
      if (!this.core.maps().some((m) => m.id === id)) return;
      if (this.core.editingMapId() === id) return;
      this.editor.openEditor(id);
    });

    effect(() => {
      const action = this.core.autoAction();
      if (!action || this.autoActionConsumed || this.core.libraryMode() || this.core.readOnly()) {
        return;
      }
      if (!this.core.campaign().isOwner) return;
      this.autoActionConsumed = true;
      queueMicrotask(() => {
        if (action === 'generate') this.gen.openGenerator();
        else if (action === 'import') this.openLibraryPicker();
      });
    });
  }

  openLibraryPicker(): void {
    if (this.core.libraryMode() || !this.core.campaign().isOwner) return;
    this.core.libraryPickerOpen.set(true);
    this.core.mapsStore.loadLibraryList(() =>
      this.core.setEditorMessage('Impossible de charger la bibliothèque.'),
    );
  }

  closeLibraryPicker(): void {
    this.core.libraryPickerOpen.set(false);
  }

  importFromLibrary(summary: CloudDungeonSummary): void {
    this.core.mapsStore.importFromLibrary(
      summary,
      (linked) => {
        this.core.libraryPickerOpen.set(false);
        this.core.setEditorMessage(`« ${linked.name} » lié (live) depuis Mes Donjons.`);
        this.editor.openEditor(linked.id);
      },
      () => this.core.setEditorMessage('Import bibliothèque impossible.'),
    );
  }

  destroy(): void {
    this.editor.destroy();
    this.gen.destroy();
    this.core.destroy();
  }

  flushPendingSave(): void {
    this.core.flushPendingSave();
  }

  onKeyDown(event: KeyboardEvent): void {
    this.editor.onKeyDown(event);
  }

  onKeyUp(event: KeyboardEvent): void {
    this.editor.onKeyUp(event);
  }

  onWheel(event: WheelEvent): void {
    this.editor.onWheel(event);
  }
}
