import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { MagicStep } from '../magic-step';

@Component({
  selector: 'app-magic-caster-tabs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './magic-caster-tabs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MagicCasterTabs {
  readonly host = input.required<MagicStep>();
}
