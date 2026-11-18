import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SkillsStep } from '../skills-step';

@Component({
  selector: 'app-skills-tools-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './skills-tools-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SkillsToolsPanel {
  readonly host = input.required<SkillsStep>();
}
