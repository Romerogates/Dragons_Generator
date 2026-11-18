import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SkillsStep } from '../skills-step';

@Component({
  selector: 'app-skills-expertise-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './skills-expertise-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SkillsExpertisePanel {
  readonly host = input.required<SkillsStep>();
}
