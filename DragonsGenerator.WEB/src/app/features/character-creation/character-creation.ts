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
import { AuthService } from '@core/services/auth.service';
import { CharacterBuilderService } from '../../core/services/character-builder.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';

// Steps
import { LevelStep } from './steps/level-step/level-step';
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
    ConfirmDialog,
    LevelStep,
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
  private readonly auth = inject(AuthService);

  readonly isOnline = this.connectivity.isOnline;
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly codexReady = signal(this.offlineCodex.isDownloaded());
  readonly codexDownloading = this.offlineCodex.downloading;
  readonly codexDownloadError = this.offlineCodex.downloadError;

  /** Affiche l'overlay de choix brouillon. */
  readonly showDraftPrompt = signal(false);
  /** Confirm avant d’effacer le brouillon (Recommencer). */
  readonly showDraftDiscardConfirm = signal(false);
  /** Parcours level-up depuis la table (XP). */
  readonly levelUpMode = signal(false);

  ngOnInit(): void {
    // 1. Mode édition depuis /characters → priorité absolue
    const hasEditData = this.handoff.hasEditPending();
    if (hasEditData) {
      this.builder.checkForEditMode();
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('levelUp') === '1') {
        this.beginLevelUpFlow();
      }
      return;
    }

    // 2. Brouillon détecté → demander à l'utilisateur
    if (this.builder.hasPendingDraft() && !this.builder.isEditMode) {
      this.showDraftPrompt.set(true);
    }
  }

  /**
   * Level-up dédié : +1 niveau, reste sur Niveau pour valider, puis entrée ASI.
   * (Le niveau est verrouillé après l’étape Classe — d’où le passage par step 1.)
   */
  private beginLevelUpFlow(): void {
    this.levelUpMode.set(true);
    this.builder.goToStep(1);
    const cur = this.builder.targetLevel();
    if (cur < 20) {
      this.builder.setTargetLevel(cur + 1);
    }
  }

  /** Raccourci : aller aux caractéristiques (ASI / dons du nouveau niveau). */
  jumpToAbilitiesForLevelUp(): void {
    this.builder.goToStep(6);
  }

  resumeDraft(): void {
    this.showDraftPrompt.set(false);
  }

  /** Ouvre le confirm in-app (pas de reset immédiat). */
  requestStartFresh(): void {
    this.showDraftDiscardConfirm.set(true);
  }

  cancelStartFresh(): void {
    this.showDraftDiscardConfirm.set(false);
  }

  confirmStartFresh(): void {
    this.showDraftDiscardConfirm.set(false);
    this.showDraftPrompt.set(false);
    this.builder.reset();
  }

  /** Revenir à une étape déjà validée (barre de progression). */
  goToStep(step: number): void {
    this.builder.goToStep(step);
  }

  /** Raccourci après correction depuis le récap. */
  goToSummary(): void {
    this.builder.goToSummary();
  }

  downloadCodexHere(): void {
    this.offlineCodex.downloadCodex().subscribe({
      next: (ok) => {
        if (ok) this.codexReady.set(true);
      },
    });
  }

  onReset(): void {
    this.requestStartFresh();
  }

  finishCreation(): void {
    const character = this.builder.build();
    this.handoff.setCurrent(character);
    this.router.navigate(['/character-sheet']);
  }
}
