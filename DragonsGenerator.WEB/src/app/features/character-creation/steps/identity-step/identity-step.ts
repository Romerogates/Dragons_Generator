// features/character-creation/steps/identity-step/identity-step.ts

import { Component, inject, computed, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CharacterBuilderService,
  IdentitySelection,
} from '@core/services/character-builder.service';
import { ALIGNMENTS } from '@core/models/Character/character';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-identity-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './identity-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityStep {
  readonly builder = inject(CharacterBuilderService);
  readonly dataService = inject(DataService);
  readonly alignments = ALIGNMENTS;

  /** État de la génération IA */
  readonly isGenerating = signal(false);
  readonly generationError = signal<string | null>(null);

  /** Raccourci vers l'état actuel de la création. */
  readonly c = computed(() => this.builder.creation());

  /** Résumé contextuel (Race · Classe). */
  readonly charSummary = computed(() => {
    const cr = this.c();
    const parts: string[] = [];
    if (cr.speciesName) {
      parts.push(cr.subspeciesName ? `${cr.speciesName} (${cr.subspeciesName})` : cr.speciesName);
    }
    if (cr.className) parts.push(cr.className);
    return parts.join(' · ') || 'Personnage';
  });

  /** Met à jour les champs de l'identité. */
  updateField(field: keyof IdentitySelection, value: string): void {
    this.builder.setIdentity({ [field]: value });
  }

  /** Appelle l'API pour générer l'histoire. */
  generateStory(): void {
    const char = this.c();

    if (!char.name.trim()) {
      this.generationError.set("Le nom est requis pour l'inspiration.");
      return;
    }

    if (!char.speciesName || !char.className) {
      this.generationError.set("L'espèce et la classe sont nécessaires.");
      return;
    }

    this.isGenerating.set(true);
    this.generationError.set(null);

    this.dataService
      .generateBackstory({
        name: char.name,
        speciesName: char.speciesName,
        subspeciesName: char.subspeciesName,
        civilizationName: char.civilizationName ?? 'Inconnue',
        className: char.className,
        alignment: char.alignment || null,
        traits: char.traits || null,
        bonds: char.bonds || null,
        flaws: char.flaws || null,
        background: char.background || null,
      })
      .subscribe({
        next: (response) => {
          this.builder.setIdentity({ story: response.story });
          this.isGenerating.set(false);
        },
        error: (err) => {
          console.error('Erreur IA:', err);
          this.generationError.set("L'IA est momentanément indisponible.");
          this.isGenerating.set(false);
        },
      });
  }

  confirm(): void {
    if (this.c().name.trim()) {
      this.builder.nextStep();
    }
  }

  prevStep(): void {
    this.builder.previousStep();
  }
}
