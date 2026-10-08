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
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
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
import { CreatureSummary } from '@core/models/Creatures/creature-summary';
import {
  formatChallengeRating,
  getCreatureCategoryLabel,
} from '@core/utils/creature-display.util';
import { AiGenerationProgressBar } from '@shared/components/ai-generation-progress-bar/ai-generation-progress-bar';
import { AI_GENERATION_BUSY } from '@core/models/ai-generation.model';

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
  /** Info non bloquante (ex. secours après échec du lot). */
  readonly fallbackNotice = signal<string | null>(null);
  readonly kindQuery = signal<Record<string, string>>({});

  readonly catalog = toSignal(
    this.dataService.getCreaturesSummary().pipe(catchError(() => of([] as CreatureSummary[]))),
    { initialValue: [] as CreatureSummary[] },
  );

  readonly roles = Object.entries(CREATURE_ROLE_LABELS) as [CreatureRole, string][];

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateName(creatureId: string, name: string): void {
    this.builder.updateCreature(creatureId, { customName: name });
  }

  kindQueryFor(creatureId: string): string {
    return this.kindQuery()[creatureId] || '';
  }

  setKindQuery(creatureId: string, query: string): void {
    this.kindQuery.update((m) => ({ ...m, [creatureId]: query }));
  }

  kindOptions(currentId: string): CreatureSummary[] {
    const list = this.catalog() ?? [];
    const taken = new Set(this.builder.creatures().map((c) => c.creatureId));
    taken.delete(currentId);
    const q = (this.kindQuery()[currentId] ?? '').trim().toLowerCase();
    const current = list.find((c) => c.id === currentId);
    const filtered = list
      .filter((c) => {
        if (taken.has(c.id)) return false;
        if (!q) return true;
        if (c.id === currentId) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          getCreatureCategoryLabel(c.category).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (current && !filtered.some((c) => c.id === currentId)) {
      return [current, ...filtered];
    }
    return filtered;
  }

  changeKind(currentId: string, nextId: string): void {
    if (!nextId || nextId === currentId) return;
    const next = (this.catalog() ?? []).find((c) => c.id === nextId);
    if (!next) return;
    this.builder.replaceCreatureKind(currentId, next);
    this.kindQuery.update((m) => {
      const rest = { ...m };
      delete rest[currentId];
      return rest;
    });
  }

  protected categoryLabel = getCreatureCategoryLabel;

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
    if (this.aiProgress.active()) {
      this.generationError.set(this.aiProgress.busyMessage());
      return;
    }
    if (this.aiRateLimit.showIfBlocked()) return;

    this.generatingId.set(creatureId);
    this.generationError.set(null);

    this.aiProgress
      .run(
        'creature-backstory',
        () =>
          this.dataService.generateCreatureStory({
            creatureId: creature.creatureId,
            customName: creature.customName.trim(),
            role: creature.role,
            setting: this.builder.setting().trim() || null,
          }),
        {
          onSuccess: (res) => {
            this.builder.updateCreature(creatureId, { backstory: res.backstory });
            this.generatingId.set(null);
          },
          onError: (err) => {
            this.generatingId.set(null);
            if (isAiRateLimitHttpError(err)) return;
            const busy = err as { code?: string; message?: string };
            if (busy.code === AI_GENERATION_BUSY) {
              this.generationError.set(busy.message ?? this.aiProgress.busyMessage());
              return;
            }
            this.generationError.set(this.extractError(err));
          },
        },
      )
      .subscribe({
        error: () => undefined,
        complete: () => this.generatingId.set(null),
      });
  }

  generateAllBackstories(): void {
    const pending = this.builder
      .creatures()
      .filter((c) => !c.backstory.trim() && c.customName.trim());
    if (pending.length === 0) return;
    if (this.aiProgress.active()) {
      this.generationError.set(this.aiProgress.busyMessage());
      return;
    }
    if (this.aiRateLimit.showIfBlocked()) return;

    this.generationError.set(null);
    this.fallbackNotice.set(null);
    void this.generateBackstoriesSequentially(pending);
  }

  private async generateBackstoriesSequentially(pending: StoryCreatureSelection[]): Promise<void> {
    this.generatingId.set(pending[0]?.creatureId ?? null);
    this.generationError.set(null);
    let failed = 0;
    let ok = 0;

    await this.aiProgress.begin('creature-batch', { batchIndex: 0, batchTotal: pending.length });

    for (let i = 0; i < pending.length; i++) {
      if (this.aiProgress.isAborted()) break;
      const creature = pending[i];
      this.generatingId.set(creature.creatureId);
      this.aiProgress.setBatchProgress(i, pending.length);
      this.aiProgress.setStageLabel(`Vie ${i + 1} / ${pending.length} — ${creature.customName.trim()}…`);
      try {
        const res = await this.aiProgress.awaitWhileActive(
          this.dataService.generateCreatureStory({
            creatureId: creature.creatureId,
            customName: creature.customName.trim(),
            role: creature.role,
            setting: this.builder.setting().trim() || null,
          }),
        );
        if (this.aiProgress.isAborted()) break;
        this.builder.updateCreature(creature.creatureId, { backstory: res.backstory });
        ok++;
      } catch (err) {
        if (this.aiProgress.isAborted()) break;
        if (isAiRateLimitHttpError(err)) {
          failed += pending.length - i;
          break;
        }
        failed++;
      }
    }

    if (this.aiProgress.isAborted()) {
      this.generatingId.set(null);
      this.fallbackNotice.set(null);
      return;
    }

    this.aiProgress.complete();
    this.generatingId.set(null);
    this.fallbackNotice.set(null);
    if (failed > 0) {
      this.generationError.set(
        failed === pending.length
          ? "L'inspiration cosmique est momentanément indisponible (délai ou service IA)."
          : `${ok} vie(s) générée(s), ${failed} échec(s). Réessayez individuellement sur les cartes restantes.`,
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
    if (http.status === 502 || http.status === 503 || http.status === 504)
      return 'Le service de génération IA a dépassé le délai (Ollama local lent ou proxy). Réessayez, ou générez carte par carte.';
    return "L'inspiration cosmique est momentanément indisponible.";
  }
}
