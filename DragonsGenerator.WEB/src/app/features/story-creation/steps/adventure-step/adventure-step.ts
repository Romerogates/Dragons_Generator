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
import { ADVENTURE_TONE_LABELS, AdventureTone } from '@core/models/Story/story';

@Component({
  selector: 'app-adventure-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './adventure-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AdventureStep implements OnInit {
  readonly builder = inject(StoryBuilderService);
  private dataService = inject(DataService);

  readonly isGenerating = signal(false);
  readonly generationError = signal<string | null>(null);

  readonly tones = Object.entries(ADVENTURE_TONE_LABELS) as [AdventureTone, string][];
  readonly levels = Array.from({ length: 20 }, (_, i) => i + 1);

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  generateAdventure(): void {
    if (!this.builder.title().trim()) {
      this.generationError.set("Donnez un titre à l'aventure.");
      return;
    }

    this.isGenerating.set(true);
    this.generationError.set(null);

    this.dataService
      .generateAdventure({
        title: this.builder.title().trim(),
        setting: this.builder.setting().trim() || null,
        partyLevel: this.builder.partyLevel(),
        tone: this.builder.tone(),
        creatures: this.builder.creatures().map((c) => ({
          creatureId: c.creatureId,
          creatureName: c.creatureName,
          customName: c.customName.trim(),
          role: c.role,
          backstory: c.backstory.trim() || null,
        })),
      })
      .subscribe({
        next: (res) => {
          this.builder.setAdventure(res.adventure);
          this.isGenerating.set(false);
        },
        error: (err) => {
          this.generationError.set(this.extractError(err));
          this.isGenerating.set(false);
        },
      });
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  confirm(): void {
    this.builder.nextStep();
  }

  private extractError(err: unknown): string {
    const e = (err as { error?: Record<string, unknown> })?.error;
    const general = (e?.['errors'] as { generalErrors?: string[] })?.generalErrors?.[0];
    const apiMsg = general || (e?.['message'] as string) || null;
    return apiMsg && apiMsg !== 'One or more errors occurred!'
      ? apiMsg
      : "L'inspiration cosmique est momentanément indisponible.";
  }
}
