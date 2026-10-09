import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  OnDestroy,
  output,
  viewChild,
} from '@angular/core';
import type { CampaignData, CampaignDetail } from '@core/models/Campaign/campaign';
import { DungeonMapsLibrary } from './dungeon-maps-library';
import { DungeonMapsEditor } from './dungeon-maps-editor';
import { DungeonMapsOverlays } from './dungeon-maps-overlays';
import { CampaignDungeonMapsStore } from './campaign-dungeon-maps.store';
import { DungeonMapsCore } from './dungeon-maps-core.service';
import { DungeonMapsGenerateService } from './dungeon-maps-generate.service';
import { DungeonMapsEditorFiles } from './dungeon-maps-editor-files.service';
import { DungeonMapsEditorHistory } from './dungeon-maps-editor-history.service';
import { DungeonMapsEditorPaint } from './dungeon-maps-editor-paint.service';
import { DungeonMapsEditorRooms } from './dungeon-maps-editor-rooms.service';
import { DungeonMapsEditorSession } from './dungeon-maps-editor-session.service';
import { DungeonMapsEditorViewport } from './dungeon-maps-editor-viewport.service';
import { DungeonMapsWorkspace } from './dungeon-maps-workspace.service';

@Component({
  selector: 'app-campaign-dungeon-maps',
  standalone: true,
  imports: [DungeonMapsLibrary, DungeonMapsEditor, DungeonMapsOverlays],
  templateUrl: './campaign-dungeon-maps.html',
  styleUrl: './campaign-dungeon-maps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    CampaignDungeonMapsStore,
    DungeonMapsCore,
    DungeonMapsEditorViewport,
    DungeonMapsEditorHistory,
    DungeonMapsEditorRooms,
    DungeonMapsEditorPaint,
    DungeonMapsEditorFiles,
    DungeonMapsEditorSession,
    DungeonMapsGenerateService,
    DungeonMapsWorkspace,
  ],
})
export class CampaignDungeonMaps implements OnDestroy {
  readonly campaign = input.required<CampaignDetail>();
  readonly focusMapId = input<string | null>(null);
  readonly libraryMode = input(false);
  readonly readOnly = input(false);
  readonly autoAction = input<'generate' | 'import' | null>(null);
  readonly dataChange = output<Partial<CampaignData>>();

  private readonly editorView = viewChild(DungeonMapsEditor);
  readonly workspace = inject(DungeonMapsWorkspace);

  constructor() {
    this.workspace.bind({
      campaign: () => this.campaign(),
      libraryMode: () => this.libraryMode(),
      readOnly: () => this.readOnly(),
      focusMapId: () => this.focusMapId(),
      autoAction: () => this.autoAction(),
      emitData: (patch) => this.dataChange.emit(patch),
      viewportEl: () => this.editorView()?.viewport()?.nativeElement,
    });
  }

  ngOnDestroy(): void {
    this.workspace.destroy();
  }

  flushPendingSave(): void {
    this.workspace.flushPendingSave();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.workspace.onKeyDown(event);
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.workspace.onKeyUp(event);
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    this.workspace.onWheel(event);
  }
}
