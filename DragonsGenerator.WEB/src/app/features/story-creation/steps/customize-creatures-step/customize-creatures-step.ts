import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '@core/services/data.service';
import { StoryBuilderService } from '@core/services/story-builder.service';
import {
  ADVENTURE_TONE_LABELS,
  CREATURE_ROLE_LABELS,
  CreatureRole,
} from '@core/models/Story/story';
import { formatChallengeRating } from '@core/utils/creature-display.util';

@Component({
  selector: 'app-customize-creatures-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customize-creatures-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CustomizeCreaturesStep implements OnInit {
  readonly builder = inject(StoryBuilderService);
  private dataService = inject(DataService);

  readonly generatingId = signal<string | null>(null);
  readonly generationError = signal<string | null>(null);

  readonly roles = Object.entries(CREATURE_ROLE_LABELS) as [CreatureRole, string][];

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateName(creatureId: string, name: string): void {
    this.builder.updateCreature(creatureId, { customName: name });
  }

  updateRole(creatureId: string, role: CreatureRole): void {
    this.builder.updateCreature(creatureId, { role });
  }

  updateBackstory(creatureId: string, backstory: string): void {
    this.builder.updateCreature(creatureId, { backstory });
  }

  generateBackstory(creatureId: string): void {
    const creature = this.builder.creatures().find((c) => c.creatureId === creatureId);
    if (!creature || !creature.customName.trim()) {
      this.generationError.set('Donnez un nom à la créature avant de générer sa vie.');
      return;
    }

    this.generatingId.set(creatureId);
    this.generationError.set(null);

    this.dataService
      .generateCreatureStory({
        creatureId: creature.creatureId,
        customName: creature.customName.trim(),
        role: creature.role,
        setting: this.builder.setting().trim() || null,
      })
      .subscribe({
        next: (res) => {
          this.builder.updateCreature(creatureId, { backstory: res.backstory });
          this.generatingId.set(null);
        },
        error: (err) => {
          this.generationError.set(this.extractError(err));
          this.generatingId.set(null);
        },
      });
  }

  generateAllBackstories(): void {
    const pending = this.builder.creatures().filter((c) => !c.backstory.trim());
    if (pending.length === 0) return;

    let index = 0;
    const runNext = (): void => {
      if (index >= pending.length) {
        this.generatingId.set(null);
        return;
      }
      const creature = pending[index++];
      this.generatingId.set(creature.creatureId);
      this.dataService
        .generateCreatureStory({
          creatureId: creature.creatureId,
          customName: creature.customName.trim(),
          role: creature.role,
          setting: this.builder.setting().trim() || null,
        })
        .subscribe({
          next: (res) => {
            this.builder.updateCreature(creature.creatureId, { backstory: res.backstory });
            runNext();
          },
          error: (err) => {
            this.generationError.set(this.extractError(err));
            this.generatingId.set(null);
          },
        });
    };
    runNext();
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  confirm(): void {
    this.builder.nextStep();
  }

  protected formatCr = formatChallengeRating;

  private extractError(err: unknown): string {
    const e = (err as { error?: Record<string, unknown> })?.error;
    const general = (e?.['errors'] as { generalErrors?: string[] })?.generalErrors?.[0];
    const apiMsg = general || (e?.['message'] as string) || null;
    return apiMsg && apiMsg !== 'One or more errors occurred!'
      ? apiMsg
      : "L'inspiration cosmique est momentanément indisponible.";
  }
}
