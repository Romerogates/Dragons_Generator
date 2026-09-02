// features/character-creation/character-creation.component.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CharacterBuilderService } from '../../core/services/character-builder.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';

// Steps
import { SpeciesStep } from './steps/species-step/species-step';
import { CivilizationStep } from './steps/civilization-step/civilization-step';
import { ClassStep } from './steps/class-step/class-step';
import { AbilitiesStep } from './steps/abilities-step/abilities-step';
import { SkillsStep } from './steps/skills-step/skills-step';
import { EquipmentStep } from './steps/equipment-step/equipment-step';
import { LanguagesStep } from './steps/languages-step/languages-step';
import { IdentityStep } from './steps/identity-step/identity-step';
import { SummaryStep } from './steps/summary-step/summary-step';
import { MagicStep } from './steps/magic-step/magic-step';
import { BackgroundStep } from './steps/background-step/background-step';

@Component({
  selector: 'app-character-creation',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SpeciesStep,
    CivilizationStep,
    BackgroundStep,
    ClassStep,
    AbilitiesStep,
    SkillsStep,
    EquipmentStep,
    LanguagesStep,
    IdentityStep,
    SummaryStep,
    MagicStep,
  ],
  templateUrl: './character-creation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <-- Autorise la balise <iconify-icon>
})
export class CharacterCreation implements OnInit {
  readonly builder = inject(CharacterBuilderService);
  private readonly router = inject(Router);
  private readonly connectivity = inject(ConnectivityService);
  private readonly offlineCodex = inject(OfflineCodexService);
  private readonly handoff = inject(CharacterHandoffService);

  readonly isOnline = this.connectivity.isOnline;
  readonly codexReady = signal(this.offlineCodex.isDownloaded());

  /** Affiche l'overlay de choix brouillon. */
  readonly showDraftPrompt = signal(false);

  /** Niveaux sélectionnables dans le bandeau. */
  readonly levels = Array.from({ length: 20 }, (_, i) => i + 1);

  ngOnInit(): void {
    // 1. Mode édition depuis /characters → priorité absolue
    const hasEditData = this.handoff.hasEditPending();
    if (hasEditData) {
      this.builder.checkForEditMode();
      return;
    }

    // 2. Brouillon détecté → demander à l'utilisateur
    if (this.builder.hasPendingDraft() && !this.builder.isEditMode) {
      this.showDraftPrompt.set(true);
    }
  }

  resumeDraft(): void {
    this.showDraftPrompt.set(false);
  }

  startFresh(): void {
    this.showDraftPrompt.set(false);
    this.builder.reset();
  }

  onLevelChange(event: Event): void {
    if (this.builder.isLevelLocked()) return;
    const value = Number((event.target as HTMLSelectElement).value);
    this.builder.setTargetLevel(value);
  }

  onReset(): void {
    if (confirm('Êtes-vous sûr de vouloir recommencer ? Toutes les données seront perdues.')) {
      this.builder.reset();
    }
  }

  finishCreation(): void {
    const character = this.builder.build();
    this.handoff.setCurrent(character);
    this.router.navigate(['/character-sheet']);
  }
}
