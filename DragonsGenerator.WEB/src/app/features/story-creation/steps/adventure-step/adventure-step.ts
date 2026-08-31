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
import { ConnectivityService } from '@core/services/connectivity.service';
import { ADVENTURE_TONE_LABELS, AdventureTone, StoryRegionChoice } from '@core/models/Story/story';
import { EanaMapPicker } from '@shared/components/eana-map-picker/eana-map-picker';
import { AiGenerationProgressBar } from '@shared/components/ai-generation-progress-bar/ai-generation-progress-bar';
import { storyLocationContext } from '@core/utils/story-location.util';

@Component({
  selector: 'app-adventure-step',
  standalone: true,
  imports: [CommonModule, FormsModule, EanaMapPicker, AiGenerationProgressBar],
  templateUrl: './adventure-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AdventureStep implements OnInit {
  readonly builder = inject(StoryBuilderService);
  private readonly dataService = inject(DataService);
  private readonly aiRateLimit = inject(AiRateLimitDialogService);
  private readonly connectivity = inject(ConnectivityService);

  readonly isOnline = this.connectivity.isOnline;
  readonly aiProgress = inject(AiGenerationProgressService);

  readonly generationError = signal<string | null>(null);

  readonly tones = Object.entries(ADVENTURE_TONE_LABELS) as [AdventureTone, string][];
  readonly levels = Array.from({ length: 20 }, (_, i) => i + 1);

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  generateAdventure(): void {
    if (!this.connectivity.isOnline()) {
      this.generationError.set('La génération IA nécessite une connexion. Rédige l\'aventure manuellement ci-dessous.');
      return;
    }
    if (!this.builder.title().trim()) {
      this.generationError.set("Donnez un titre à l'aventure.");
      return;
    }
    if (!this.builder.region()) {
      this.generationError.set('Choisissez une région sur la carte ou « Région inconnue ».');
      return;
    }
    if (this.aiRateLimit.showIfBlocked()) return;

    this.generationError.set(null);

    this.aiProgress
      .run('adventure', () =>
        this.dataService.generateAdventure({
          title: this.builder.title().trim(),
          setting: storyLocationContext(this.builder.region(), this.builder.setting()),
          partyLevel: this.builder.partyLevel(),
          tone: this.builder.tone(),
          creatures: this.builder.creatures().map((c) => ({
            creatureId: c.creatureId,
            creatureName: c.creatureName,
            customName: c.customName.trim(),
            role: c.role,
            backstory: c.backstory.trim() || null,
          })),
        }),
      )
      .subscribe({
        next: (res) => {
          this.builder.setAdventure(res.adventure);
        },
        error: (err) => {
          if (isAiRateLimitHttpError(err)) return;
          this.generationError.set(this.extractError(err));
        },
      });
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  confirm(): void {
    this.builder.nextStep();
  }

  onRegionChange(region: StoryRegionChoice): void {
    this.builder.setRegion(region);
    this.generationError.set(null);
  }

  private extractError(err: unknown): string {
    const http = err as {
      status?: number;
      error?: Record<string, unknown> | string;
      message?: string;
    };
    if (typeof http.error === 'string' && http.error.trim()) return http.error.trim();
    const e = typeof http.error === 'object' ? http.error : undefined;
    const general = (e?.['errors'] as { generalErrors?: string[] })?.generalErrors?.[0];
    const title = e?.['title'] as string | undefined;
    const detail = e?.['detail'] as string | undefined;
    const apiMsg = general || detail || title || (e?.['message'] as string) || null;
    if (apiMsg && apiMsg !== 'One or more errors occurred!') return apiMsg;
    if (http.status === 502 || http.status === 503 || http.status === 504)
      return 'Le service de génération IA est temporairement indisponible (quota ou surcharge Groq). Attendez une minute et réessayez.';
    return "L'inspiration cosmique est momentanément indisponible.";
  }
}
