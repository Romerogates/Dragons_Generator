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
import { firstValueFrom, forkJoin } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CharacterBuilderService } from '../../core/services/character-builder.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { DataService } from '@core/services/data.service';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { CharacterAutoGeneratorService } from '@core/services/character-auto-generator.service';
import { autoCompleteRemainingCreation } from '@core/utils/character-auto-complete.util';
import { normalizeCharacterClasses } from '@core/utils/class-data.adapter';
import type { CharacterCreation as CreationState } from '@core/models/Character/character';

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
  private readonly data = inject(DataService);
  private readonly autoGenerator = inject(CharacterAutoGeneratorService);

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

  readonly autoCompleteBusy = signal(false);
  readonly autoCompleteHint = signal<string | null>(null);
  readonly canUndoAutoComplete = signal(false);
  private autoCompleteUndo: CreationState | null = null;
  private autoCompleteUndoStep: number | null = null;

  readonly quickGenerateBusy = signal(false);

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

  /** Complète aléatoirement les choix encore ouverts (langues / magie / compétences). */
  async autoCompleteRemaining(): Promise<void> {
    if (this.autoCompleteBusy() || this.builder.currentStep() >= this.builder.summaryStep()) return;
    this.autoCompleteBusy.set(true);
    this.autoCompleteHint.set(null);
    try {
      const c = this.builder.creation();
      const catalogs = await firstValueFrom(
        forkJoin({
          languages: this.data.getLanguages(),
          spells: this.data.getSpells(),
          classes: this.data.getClasses(),
        }),
      );
      const classes = normalizeCharacterClasses(catalogs.classes);
      const cls = c.classId ? (classes.find((x) => x.id === c.classId) ?? null) : null;
      const before = structuredClone(c) as CreationState;
      const { creation, filled } = autoCompleteRemainingCreation(c, {
        languages: catalogs.languages,
        spells: catalogs.spells,
        classJson: cls,
        abilityModifiers: this.builder.abilityModifiers(),
      });
      if (!filled.length) {
        this.autoCompleteHint.set('Rien à compléter pour l’instant.');
        return;
      }
      this.autoCompleteUndo = before;
      this.canUndoAutoComplete.set(true);
      this.builder.replaceCreation(creation);
      this.autoCompleteHint.set(`Complété : ${filled.join(', ')}.`);
    } catch {
      this.autoCompleteHint.set('Impossible de compléter automatiquement.');
    } finally {
      this.autoCompleteBusy.set(false);
    }
  }

  /**
   * Génère un héros L1 complet dans la forge (espèce → récap) pour jouer vite.
   * L’utilisateur revoit le récap puis sauvegarde — compte dans « Mes héros ».
   */
  async generateQuickHero(): Promise<void> {
    if (this.quickGenerateBusy() || this.builder.isEditMode) return;
    this.quickGenerateBusy.set(true);
    this.autoCompleteHint.set(null);
    this.showDraftPrompt.set(false);
    this.showDraftDiscardConfirm.set(false);
    try {
      const before = structuredClone(this.builder.creation()) as CreationState;
      const beforeStep = this.builder.currentStep();
      await this.autoGenerator.populateWizardWithRandomLevel1();
      this.autoCompleteUndo = before;
      this.autoCompleteUndoStep = beforeStep;
      this.canUndoAutoComplete.set(true);
      this.autoCompleteHint.set('Héros généré — vérifiez le récap puis sauvegardez.');
    } catch (err) {
      this.autoCompleteHint.set(
        err instanceof Error ? err.message : 'Impossible de générer un héros.',
      );
    } finally {
      this.quickGenerateBusy.set(false);
    }
  }

  undoAutoComplete(): void {
    if (!this.autoCompleteUndo) return;
    this.builder.replaceCreation(this.autoCompleteUndo);
    if (this.autoCompleteUndoStep != null) {
      this.builder.goToStep(this.autoCompleteUndoStep);
      this.autoCompleteUndoStep = null;
    }
    this.autoCompleteUndo = null;
    this.canUndoAutoComplete.set(false);
    this.autoCompleteHint.set('Génération / auto-complétion annulée.');
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
