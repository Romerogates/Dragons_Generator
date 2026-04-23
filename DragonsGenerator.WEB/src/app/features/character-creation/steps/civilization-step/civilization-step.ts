// features/character-creation/steps/civilization-step/civilization-step.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '@core/services/data.service';
import {
  CharacterBuilderService,
  CivilizationSelection,
} from '@core/services/character-builder.service';
import type { Civilisation } from '@core/models/Civilisations/civilisations';

@Component({
  selector: 'app-civilization-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './civilization-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CivilizationStep implements OnInit {
  private dataService = inject(DataService);
  readonly builder = inject(CharacterBuilderService);

  readonly allCivilizations = signal<Civilisation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedCivId = signal<string | null>(null);

  readonly selectedCiv = computed<Civilisation | null>(() => {
    const id = this.selectedCivId();
    if (!id) return null;
    return this.allCivilizations().find((c) => c.id === id) ?? null;
  });

  readonly officialLanguages = computed<string[]>(() => {
    return this.selectedCiv()?.linguistics.officialLanguages.map((l) => l.label) ?? [];
  });

  readonly writingSystems = computed<string[]>(() => {
    return this.selectedCiv()?.linguistics.writingSystems.map((w) => w.label) ?? [];
  });

  readonly primarySpecies = computed<string[]>(() => {
    return this.selectedCiv()?.demographics.primarySpecies.map((s) => s.label) ?? [];
  });

  readonly secondarySpecies = computed<string[]>(() => {
    return this.selectedCiv()?.demographics.secondarySpecies.map((s) => s.label) ?? [];
  });

  readonly isConfirmed = computed(() => {
    const builderId = this.builder.creation().civilizationId;
    return builderId === this.selectedCivId() && builderId !== null;
  });

  ngOnInit(): void {
    this.loadCivilizations();
    const current = this.builder.creation();
    if (current.civilizationId) {
      this.selectedCivId.set(current.civilizationId);
    }
  }

  getIconForCiv(id: string): string {
    const icons: Record<string, string> = {
      'civ-acoatl': '🛕',
      'civ-ajagar': '🐘',
      'civ-arolavie': '🌲',
      'civ-iles-barbaresques': '⛵',
      'civ-cite-franche': '🏛️',
      'civ-cyrillane': '👑',
      'civ-drakenbergen': '⛰️',
      'civ-ellerina': '🌿',
      'civ-iles-eoliennes': '☁️',
      'civ-inframonde': '🕷️',
      'civ-kaan': '🐎',
      'civ-lothrienne': '🛡️',
      'civ-mibu': '🦁',
      'civ-rachamangekr': '🐉',
      'civ-royaumes-des-sables': '🏜️',
      'civ-septentrion': '❄️',
      'civ-shi-huang': '🏯',
      'civ-torea': '🏝️',
    };
    return icons[id] || '🗺️';
  }

  getMapCoordinates(id: string): { x: number; y: number } {
    const coords: Record<string, { x: number; y: number }> = {
      'civ-cyrillane': { x: 60, y: 45 },
      'civ-cite-franche': { x: 45, y: 45 },
      'civ-lothrienne': { x: 50, y: 15 },
      'civ-drakenbergen': { x: 55, y: 25 },
      'civ-arolavie': { x: 65, y: 15 },
      'civ-septentrion': { x: 55, y: 3 },
      'civ-kaan': { x: 77, y: 38 },
      'civ-shi-huang': { x: 92, y: 88 },
      'civ-mibu': { x: 55, y: 72 },
      'civ-royaumes-des-sables': { x: 54, y: 60 },
      'civ-ajagar': { x: 78, y: 65 },
      'civ-acoatl': { x: 15, y: 73 },
      'civ-iles-barbaresques': { x: 28, y: 56 },
      'civ-ellerina': { x: 16, y: 22 },
      'civ-torea': { x: 20, y: 95 },
      'civ-rachamangekr': { x: 65, y: 90 },
      'civ-iles-eoliennes': { x: 22, y: 40 },
      'civ-inframonde': { x: 25, y: 10 },
    };
    return coords[id] || { x: 50, y: 50 };
  }

  private loadCivilizations(): void {
    this.loading.set(true);
    this.dataService.getCivilisations().subscribe({
      next: (civs) => {
        this.allCivilizations.set(civs);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Impossible de charger les civilisations.');
        this.loading.set(false);
      },
    });
  }

  selectCiv(civId: string): void {
    if (this.selectedCivId() !== civId) {
      this.builder.clearCivilization();
    }
    this.selectedCivId.set(civId);
  }

  confirmSelection(): void {
    const civ = this.selectedCiv();
    if (!civ) return;
    const selection: CivilizationSelection = {
      civilizationId: civ.id,
      civilizationName: civ.name,
      languages: civ.linguistics.officialLanguages.map((l) => l.label),
      writingSystems: civ.linguistics.writingSystems.map((w) => w.label),
    };

    // 1. On sauvegarde le choix
    this.builder.setCivilization(selection);

    // 2. On passe à l'étape suivante après une micro-pause pour la fluidité visuelle
    this.builder.nextStep();
  }

  clearSelection(): void {
    this.selectedCivId.set(null);
    this.builder.clearCivilization();
  }
  /** Navigation autonome : Retour à l'étape précédente (Espèce) */
  prevStep(): void {
    this.builder.previousStep();
  }
}
