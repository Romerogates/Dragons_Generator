import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { parseAdventureSections } from '@core/utils/adventure-synopsis.util';

@Component({
  selector: 'app-adventure-synopsis-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './adventure-synopsis-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdventureSynopsisView {
  readonly text = input.required<string>();
  readonly emptyLabel = input('Aucun synopsis pour l’instant.');

  readonly sections = computed(() => parseAdventureSections(this.text()));
}
