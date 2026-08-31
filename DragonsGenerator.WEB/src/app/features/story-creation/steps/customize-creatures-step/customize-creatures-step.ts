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
import { AiRateLimitDialogService } from '@core/services/ai-rate-limit-dialog.service';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';
import { isAiRateLimitHttpError } from '@core/utils/ai-rate-limit.util';
import { StoryBuilderService } from '@core/services/story-builder.service';
import {
  CREATURE_ROLE_LABELS,
  CreatureRole,
  StoryCreatureSelection,
} from '@core/models/Story/story';
import { formatChallengeRating } from '@core/utils/creature-display.util';
import { AiGenerationProgressBar } from '@shared/components/ai-generation-progress-bar/ai-generation-progress-bar';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-customize-creatures-step',
  standalone: true,
  imports: [CommonModule, FormsModule, AiGenerationProgressBar],
  templateUrl: './customize-creatures-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CustomizeCreaturesStep implements OnInit {
  readonly builder = inject(StoryBuilderService);
  private readonly dataService = inject(DataService);
  private readonly aiRateLimit = inject(AiRateLimitDialogService);
  readonly aiProgress = inject(AiGenerationProgressService);

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
    if (this.aiRateLimit.showIfBlocked()) return;

    this.generatingId.set(creatureId);
    this.generationError.set(null);

    this.aiProgress
      .run('creature-backstory', () =>
        this.dataService.generateCreatureStory({
          creatureId: creature.creatureId,
          customName: creature.customName.trim(),
          role: creature.role,
          setting: this.builder.setting().trim() || null,
        }),
      )
      .subscribe({
        next: (res) => {
          this.builder.updateCreature(creatureId, { backstory: res.backstory });
          this.generatingId.set(null);
        },
        error: (err) => {
          if (isAiRateLimitHttpError(err)) {
            this.generatingId.set(null);
            return;
          }
          this.generationError.set(this.extractError(err));
          this.generatingId.set(null);
        },
      });
  }

  generateAllBackstories(): void {
    const pending = this.builder
      .creatures()
      .filter((c) => !c.backstory.trim() && c.customName.trim());
    if (pending.length === 0) return;
    if (this.aiRateLimit.showIfBlocked()) return;

    this.generationError.set(null);
    this.generatingId.set('batch');

    if (pending.length === 1) {
      this.generateBackstory(pending[0].creatureId);
      return;
    }

    this.aiProgress
      .run(
        'creature-batch',
        () =>
          this.dataService.generateCreatureStoriesBatch({
            setting: this.builder.setting().trim() || null,
            creatures: pending.map((c) => ({
              creatureId: c.creatureId,
              customName: c.customName.trim(),
              role: c.role,
            })),
          }),
        { batchTotal: pending.length },
      )
      .subscribe({
        next: (res) => {
          const generated = new Set(res.backstories.map((item) => item.creatureId));
          for (const item of res.backstories) {
            this.builder.updateCreature(item.creatureId, { backstory: item.backstory });
          }
          const missing = pending.filter((c) => !generated.has(c.creatureId));
          if (missing.length) {
            void this.generateBackstoriesSequentially(missing);
          } else {
            this.generatingId.set(null);
          }
        },
        error: (err) => {
          if (isAiRateLimitHttpError(err)) {
            this.generatingId.set(null);
            return;
          }
          void this.generateBackstoriesSequentially(pending);
        },
      });
  }

  private async generateBackstoriesSequentially(pending: StoryCreatureSelection[]): Promise<void> {
    this.generatingId.set('batch');
    this.generationError.set(null);
    let failed = 0;

    await this.aiProgress.begin('creature-batch', { batchIndex: 0, batchTotal: pending.length });

    for (let i = 0; i < pending.length; i++) {
      const creature = pending[i];
      this.aiProgress.setBatchProgress(i, pending.length);
      try {
        const res = await firstValueFrom(
          this.dataService.generateCreatureStory({
            creatureId: creature.creatureId,
            customName: creature.customName.trim(),
            role: creature.role,
            setting: this.builder.setting().trim() || null,
          }),
        );
        this.builder.updateCreature(creature.creatureId, { backstory: res.backstory });
      } catch {
        failed++;
      }
    }

    this.aiProgress.complete();
    this.generatingId.set(null);
    if (failed > 0) {
      this.generationError.set(
        failed === pending.length
          ? "L'inspiration cosmique est momentanément indisponible."
          : `${failed} créature(s) n'ont pas pu être générées. Réessayez individuellement.`,
      );
    }
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  confirm(): void {
    this.builder.nextStep();
  }

  protected formatCr = formatChallengeRating;

  private extractError(err: unknown): string {
    const http = err as {
      status?: number;
      error?: Record<string, unknown> | string;
    };
    if (typeof http.error === 'string' && http.error.trim()) return http.error.trim();
    const e = typeof http.error === 'object' ? http.error : undefined;
    const general = (e?.['errors'] as { generalErrors?: string[] })?.generalErrors?.[0];
    const detail = e?.['detail'] as string | undefined;
    const apiMsg = general || detail || (e?.['message'] as string) || null;
    if (apiMsg && apiMsg !== 'One or more errors occurred!') return apiMsg;
    if (http.status === 502)
      return 'Le service de génération IA est indisponible. Vérifiez la clé Groq ou réessayez dans quelques instants.';
    return "L'inspiration cosmique est momentanément indisponible.";
  }
}
