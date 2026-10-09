import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DungeonMapsHost } from './dungeon-maps-host';
import { DungeonMapsGenerator } from './dungeon-maps-generator';

@Component({
  selector: 'app-dungeon-maps-library',
  standalone: true,
  imports: [DungeonMapsGenerator],
  templateUrl: './dungeon-maps-library.html',
  styleUrl: './campaign-dungeon-maps.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DungeonMapsLibrary {
  readonly host = input.required<DungeonMapsHost>();
}
