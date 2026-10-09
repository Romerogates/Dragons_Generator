// features/character-creation/character-creation.component.ts

import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
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
import { ForgePreferencesService } from '@core/services/forge-preferences.service';
import {
  UI_BANNER_IDS,
  UiBannerPreferencesService,
} from '@core/services/ui-banner-preferences.service';
import { autoCompleteRemainingCreation } from '@core/utils/character-auto-complete.util';
import { normalizeCharacterClasses } from '@core/utils/class-data.adapter';
import type { CharacterCreation as CreationState } from '@core/models/Character/character';
import {
  consumePendingForgeAction,
  nextLevelUpTarget,
  resolveForgeEntry,
  shouldFallbackAutoCompleteToGenerate,
  shouldStartLevelUp,
  type PendingForgeAction,
} from '@core/utils/forge-bootstrap.util';

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
  host: {
    class: 'forge-route block',
  },
})
export class CharacterCreation implements OnInit {
  // --- 1. Wiring ---
  readonly builder = inject(CharacterBuilderService);
  private readonly router = inject(Router);
  private readonly connectivity = inject(ConnectivityService);
  private readonly offlineCodex = inject(OfflineCodexService);
  private readonly handoff = inject(CharacterHandoffService);
  private readonly auth = inject(AuthService);
  private readonly data = inject(DataService);
  private readonly autoGenerator = inject(CharacterAutoGeneratorService);
  private readonly forgePrefs = inject(ForgePreferencesService);
  private readonly banners = inject(UiBannerPreferencesService);

  readonly isOnline = this.connectivity.isOnline;
  readonly isLoggedIn = this.auth.isLoggedIn;
  /** Liens guide contextuels (masquables dans Paramètres → Aide & bannières). */
  readonly showGuideLinks = computed(() =>
    this.banners.isVisible(UI_BANNER_IDS.contextualGuideLinks),
  );
  readonly codexReady = signal(this.offlineCodex.isDownloaded());
  readonly codexDownloading = this.offlineCodex.downloading;
  readonly codexDownloadError = this.offlineCodex.downloadError;

  // --- 2. Entrée (brouillon / mode / level-up) ---
  readonly showDraftPrompt = signal(false);
  /** Confirm avant d’effacer le brouillon (Recommencer). */
  readonly showDraftDiscardConfirm = signal(false);
  /** Parcours level-up depuis la table (XP). */
  readonly levelUpMode = signal(false);

  /** Entrée forge : pré-tiré vs manuel (désactivable dans Paramètres). */
  readonly showForgeModePrompt = signal(false);
  /** Rappeler de choisir un niveau avant Générer / Compléter. */
  readonly showLevelRequiredPrompt = signal(false);
  private pendingForgeAction: PendingForgeAction | null = null;

  // --- 3. Auto-génération ---
  readonly autoCompleteBusy = signal(false);
  readonly autoCompleteHint = signal<string | null>(null);
  readonly canUndoAutoComplete = signal(false);
  private autoCompleteUndo: CreationState | null = null;
  private autoCompleteUndoStep: number | null = null;

  readonly quickGenerateBusy = signal(false);
  private readonly forgeStepper = viewChild<ElementRef<HTMLElement>>('forgeStepper');

  constructor() {
    effect(() => {
      const step = this.builder.currentStep();
      queueMicrotask(() => this.scrollActiveForgeStepIntoView(step));
    });
  }

  /** Flèches ‹ › du stepper. */
  scrollForgeStepsBy(delta: number): void {
    const el = this.forgeStepper()?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  /** Garde l’étape active visible dans le stepper (ex. 12 Récap hors écran). */
  private scrollActiveForgeStepIntoView(step: number): void {
    const root = this.forgeStepper()?.nativeElement;
    const el = root?.querySelector<HTMLElement>(`[data-forge-step="${step}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }

  ngOnInit(): void {
    const entry = resolveForgeEntry({
      hasEditData: this.handoff.hasEditPending(),
      hasPendingDraft: this.builder.hasPendingDraft(),
      isEditMode: this.builder.isEditMode,
      skipModePrompt: this.forgePrefs.skipModePrompt(),
    });
    if (entry === 'edit') {
      this.builder.checkForEditMode();
      const search = typeof window !== 'undefined' ? window.location.search : '';
      if (shouldStartLevelUp(search)) this.beginLevelUpFlow();
      return;
    }
    if (entry === 'draft') {
      this.showDraftPrompt.set(true);
      return;
    }
    if (entry === 'mode_prompt') this.showForgeModePrompt.set(true);
  }

  /**
   * Level-up dédié : +1 niveau, reste sur Niveau pour valider, puis entrée ASI.
   * (Le niveau est verrouillé après l’étape Classe — d’où le passage par step 1.)
   */
  private beginLevelUpFlow(): void {
    this.levelUpMode.set(true);
    this.builder.goToStep(1);
    this.builder.setTargetLevel(nextLevelUpTarget(this.builder.targetLevel()));
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
    if (!this.forgePrefs.skipModePrompt()) {
      this.showForgeModePrompt.set(true);
    }
  }

  chooseForgeManual(): void {
    this.showForgeModePrompt.set(false);
  }

  chooseForgePregen(): void {
    this.showForgeModePrompt.set(false);
    void this.generateQuickHero();
  }

  dismissLevelRequired(): void {
    this.showLevelRequiredPrompt.set(false);
    this.pendingForgeAction = null;
  }

  /** L’utilisateur a choisi un niveau dans le popup → enchaîne l’action en attente. */
  confirmLevelAndContinue(): void {
    this.builder.acknowledgeLevel();
    this.showLevelRequiredPrompt.set(false);
    const action = consumePendingForgeAction(this.pendingForgeAction);
    this.pendingForgeAction = null;
    if (action === 'generate') void this.runQuickGenerate();
    else if (action === 'complete') void this.runAutoComplete();
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

  /** Complète le reste au niveau choisi (plein autofill si vide, gaps sinon) → récap. */
  async autoCompleteRemaining(): Promise<void> {
    if (this.autoCompleteBusy() || this.quickGenerateBusy()) return;
    if (this.builder.currentStep() >= this.builder.summaryStep()) return;
    if (!this.ensureLevelChosen('complete')) return;
    await this.runAutoComplete();
  }

  /**
   * Génère un héros complet dans la forge au niveau choisi → récap.
   * L’utilisateur revoit le récap puis sauvegarde — compte dans « Mes héros ».
   */
  async generateQuickHero(): Promise<void> {
    if (this.quickGenerateBusy() || this.autoCompleteBusy() || this.builder.isEditMode) return;
    if (!this.ensureLevelChosen('generate')) return;
    await this.runQuickGenerate();
  }

  private ensureLevelChosen(action: PendingForgeAction): boolean {
    if (this.builder.levelAcknowledged()) return true;
    this.pendingForgeAction = action;
    this.showLevelRequiredPrompt.set(true);
    this.autoCompleteHint.set(null);
    return false;
  }

  private async runQuickGenerate(): Promise<void> {
    this.quickGenerateBusy.set(true);
    this.autoCompleteHint.set(null);
    this.showDraftPrompt.set(false);
    this.showDraftDiscardConfirm.set(false);
    this.showForgeModePrompt.set(false);
    try {
      const before = structuredClone(this.builder.creation()) as CreationState;
      const beforeStep = this.builder.currentStep();
      const level = this.builder.targetLevel();
      await this.autoGenerator.populateWizardWithRandomHero(level);
      this.autoCompleteUndo = before;
      this.autoCompleteUndoStep = beforeStep;
      this.canUndoAutoComplete.set(true);
      this.autoCompleteHint.set(
        `Héros généré (niveau ${level}) — vérifiez le récap puis sauvegardez.`,
      );
    } catch (err) {
      this.autoCompleteHint.set(
        err instanceof Error ? err.message : 'Impossible de générer un héros.',
      );
    } finally {
      this.quickGenerateBusy.set(false);
    }
  }

  private async runAutoComplete(): Promise<void> {
    this.autoCompleteBusy.set(true);
    this.autoCompleteHint.set(null);
    try {
      const c = this.builder.creation();
      // Rien de structurant choisi → même pipeline que « Générer un héros » au niveau courant.
      if (shouldFallbackAutoCompleteToGenerate(c)) {
        this.autoCompleteBusy.set(false);
        await this.runQuickGenerate();
        return;
      }

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
      const beforeStep = this.builder.currentStep();
      const { creation, filled } = autoCompleteRemainingCreation(c, {
        languages: catalogs.languages,
        spells: catalogs.spells,
        classJson: cls,
        abilityModifiers: this.builder.abilityModifiers(),
      });
      if (!filled.length) {
        this.builder.jumpToSummaryForced();
        this.autoCompleteHint.set('Rien de plus à auto-compléter — récap ouvert pour vérification.');
        return;
      }
      this.autoCompleteUndo = before;
      this.autoCompleteUndoStep = beforeStep;
      this.canUndoAutoComplete.set(true);
      this.builder.replaceCreation(creation);
      this.builder.jumpToSummaryForced();
      this.autoCompleteHint.set(`Complété : ${filled.join(', ')}. Vérifiez le récap.`);
    } catch {
      this.autoCompleteHint.set('Impossible de compléter automatiquement.');
    } finally {
      this.autoCompleteBusy.set(false);
    }
  }

  undoAutoComplete(): void {
    if (!this.autoCompleteUndo) return;
    this.builder.replaceCreation(this.autoCompleteUndo);
    if (this.autoCompleteUndoStep != null) {
      this.builder.goToStep(this.autoCompleteUndoStep, { force: true });
      this.autoCompleteUndoStep = null;
    }
    this.autoCompleteUndo = null;
    this.canUndoAutoComplete.set(false);
    this.autoCompleteHint.set('Génération / auto-complétion annulée.');
  }

  onReset(): void {
    this.requestStartFresh();
  }

  // --- 4. Sortie ---
  finishCreation(): void {
    const character = this.builder.build();
    this.handoff.setCurrent(character);
    this.router.navigate(['/character-sheet']);
  }
}
