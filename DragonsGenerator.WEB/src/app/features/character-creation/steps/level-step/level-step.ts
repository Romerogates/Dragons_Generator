// features/character-creation/steps/level-step/level-step.ts

import { Component, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterBuilderService } from '@core/services/character-builder.service';

@Component({
  selector: 'app-level-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './level-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LevelStep {
  readonly builder = inject(CharacterBuilderService);

  /** Niveaux sélectionnables (1 à 20). */
  readonly levels = Array.from({ length: 20 }, (_, i) => i + 1);

  selectLevel(level: number): void {
    this.builder.setTargetLevel(level);
  }

  continueToNextStep(): void {
    this.builder.nextStep();
  }
}
