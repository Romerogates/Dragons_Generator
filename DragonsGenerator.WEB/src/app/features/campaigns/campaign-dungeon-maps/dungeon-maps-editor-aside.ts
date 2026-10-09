import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { DungeonMapsHost } from './dungeon-maps-host';

@Component({
  selector: 'app-dungeon-maps-editor-aside',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './dungeon-maps-editor-aside.html',
  styleUrl: './campaign-dungeon-maps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DungeonMapsEditorAside {
  readonly host = input.required<DungeonMapsHost>();
}
