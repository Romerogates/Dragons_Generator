import {
  Component,
  inject,
  computed,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { CharacterBuilderService } from '@core/services/character-builder.service';
import { ForgePreferencesService } from '@core/services/forge-preferences.service';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { PendingCharacterSaveService } from '@core/services/pending-character-save.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { PdfPagePreview } from '@shared/components/pdf-page-preview/pdf-page-preview';
import { CharacterPlayView } from '../../../character-sheet/character-play-view';
import { prefersNativePdfFallback } from '@core/utils/pdf-preview.util';
import {
  ABILITY_KEY_TO_LABEL,
  ABILITY_KEYS,
  type AbilityKey,
  type Character,
} from '../../../../core/models/Character/character';
import {
  formatCharacterExportErrors,
  validateCharacterExport,
} from '@core/utils/character-export-validation.util';
import { MAX_CHARACTERS_PER_USER } from '@core/constants/character-limits';
import { switchMap, of } from 'rxjs';
import { RouterLink } from '@angular/router';
import {
  classPlaybookPath,
  getGuideClassPlaybook,
} from '../../../guide/guide-class-playbooks';
import { GuideRulebookPdfService } from '@core/services/guide-rulebook-pdf.service';

@Component({
  selector: 'app-summary-step',
  standalone: true,
  imports: [CommonModule, ConfirmDialog, CharacterPlayView, PdfPagePreview, RouterLink],
  templateUrl: './summary-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SummaryStep implements OnInit, OnDestroy {
  readonly builder = inject(CharacterBuilderService);
  private readonly forgePrefs = inject(ForgePreferencesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pdfService = inject(PdfGeneratorService);
  private guidePdf = inject(GuideRulebookPdfService);
  private sanitizer = inject(DomSanitizer);
  private cloud = inject(CharacterCloudService);
  private campaigns = inject(CampaignCloudService);
  private auth = inject(AuthService);
  private pendingSave = inject(PendingCharacterSaveService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly offlineCodex = inject(OfflineCodexService);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly handoff = inject(CharacterHandoffService);

  readonly isOnline = this.connectivity.isOnline;
  readonly codexReady = computed(() => this.offlineCodex.isDownloaded());

  readonly abilityKeys = ABILITY_KEYS;
  readonly abilityLabels = ABILITY_KEY_TO_LABEL;

  readonly character = computed<Character>(() => this.builder.build());
  readonly isEditMode = computed(() => this.builder.isEditMode);
  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly classPlaybook = computed(() =>
    getGuideClassPlaybook(this.builder.creation().classId),
  );
  readonly classPlaybookLink = computed(() => {
    const id = this.builder.creation().classId;
    return id ? classPlaybookPath(id) : null;
  });
  readonly exportingClassGuide = signal(false);

  /** Toutes les étapes sauf le récap — pour corriger sans remonter une à une. */
  readonly editableSteps = computed(() => {
    const summary = this.builder.summaryStep();
    return this.builder.steps().filter((s) => s.number < summary);
  });

  readonly isLoadingPreview = signal(true);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  readonly pdfRawUrl = signal<string | null>(null);
  readonly pdfJsFailed = signal(false);
  readonly useNativePdfFallback = prefersNativePdfFallback();
  /** Téléphone : PDF (défaut) ou Compacte — réglé dans Paramètres → Forge. */
  readonly showMobilePdf = computed(() => this.forgePrefs.mobileRecapMode() === 'pdf');
  readonly showAuthGate = signal(false);
  readonly showDiscardConfirm = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  /** Succès file d’attente offline (pas une erreur). */
  readonly saveQueuedNotice = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const url = await this.pdfService.generatePdfBlob(this.character());
      this.pdfRawUrl.set(url);
      this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } catch (err) {
      console.error('Erreur génération aperçu PDF :', err);
    } finally {
      this.isLoadingPreview.set(false);
    }
  }

  ngOnDestroy(): void {
    const url = this.pdfRawUrl();
    if (url) URL.revokeObjectURL(url);
  }

  openFullscreen(): void {
    const url = this.pdfRawUrl();
    if (url) window.open(url, '_blank');
  }

  onPdfJsFailed(): void {
    this.pdfJsFailed.set(true);
  }

  fmt(n: number): string {
    return n >= 0 ? `+${n}` : `${n}`;
  }

  abilityLabel(key: AbilityKey): string {
    return this.abilityLabels[key];
  }

  speciesLabel(): string {
    const c = this.builder.creation();
    return c.subspeciesName ? `${c.speciesName} (${c.subspeciesName})` : (c.speciesName ?? '');
  }

  classLabel(): string {
    const c = this.builder.creation();
    return c.subclassName ? `${c.className} — ${c.subclassName}` : (c.className ?? '');
  }

  /** Sauvegarde cloud obligatoire (compte requis). */
  saveCharacter(): void {
    this.saveError.set(null);
    this.saveQueuedNotice.set(null);
    const character = this.character();
    const validation = validateCharacterExport(character);
    if (!validation.valid) {
      this.saveError.set(formatCharacterExportErrors(validation.errors));
      return;
    }
    if (!this.auth.isLoggedIn()) {
      this.pendingSave.stash(character);
      this.showAuthGate.set(true);
      return;
    }
    this.persistToCloud(character);
  }

  closeAuthGate(): void {
    this.showAuthGate.set(false);
  }

  goRegister(): void {
    this.pendingSave.stash(this.character());
    this.showAuthGate.set(false);
    void this.router.navigate(['/register'], {
      queryParams: { returnUrl: '/characters', intent: 'save' },
    });
  }

  goLogin(): void {
    this.pendingSave.stash(this.character());
    this.showAuthGate.set(false);
    void this.router.navigate(['/login'], {
      queryParams: { returnUrl: '/characters', intent: 'save' },
    });
  }

  private persistToCloud(character: Character): void {
    this.saving.set(true);
    const intent = this.route.snapshot.queryParamMap.get('intent')?.trim();
    const asPregenPool = intent === 'pregen';
    const toSave: Character = asPregenPool ? { ...character, isPregenPool: true } : character;

    if (!this.connectivity.isOnline()) {
      const withId = {
        ...toSave,
        id: toSave.id ?? crypto.randomUUID(),
        cloudSynced: false,
      };
      this.offlineSync.queueCharacterSave(withId, this.isEditMode());
      this.handoff.setCurrent(withId);
      this.pendingSave.clear();
      this.saving.set(false);
      this.saveQueuedNotice.set(
        'Héros mis en file d’attente — synchronisation dès la reconnexion.',
      );
      this.builder.reset();
      this.afterSaveNavigate(withId);
      return;
    }

    const save$ = this.isEditMode()
      ? this.cloud.save(toSave, { updateExisting: true })
      : asPregenPool
        ? this.cloud.save(toSave)
        : this.cloud.list().pipe(
            switchMap((list) => {
              if (list.length >= MAX_CHARACTERS_PER_USER) {
                this.saving.set(false);
                this.saveError.set(
                  `Limite atteinte : maximum ${MAX_CHARACTERS_PER_USER} personnages par compte. Supprimez un héros avant d’en créer un autre.`,
                );
                return of(null);
              }
              return this.cloud.save(toSave);
            }),
          );

    save$.subscribe({
      next: (serverId) => {
        if (serverId == null) return;
        const updated = {
          ...toSave,
          id: serverId || toSave.id,
          cloudSynced: true,
        };
        this.handoff.setCurrent(updated);
        this.pendingSave.clear();
        this.saving.set(false);
        this.builder.reset();
        this.afterSaveNavigate(updated);
      },
      error: (err: unknown) => {
        const msg =
          err && typeof err === 'object' && 'error' in err
            ? String((err as { error?: { message?: string } }).error?.message ?? '')
            : '';
        if (msg.toLowerCase().includes('limite')) {
          this.saving.set(false);
          this.saveError.set(msg);
          return;
        }
        const withId = {
          ...toSave,
          id: toSave.id ?? crypto.randomUUID(),
          cloudSynced: false,
        };
        this.offlineSync.queueCharacterSave(withId, this.isEditMode());
        this.saving.set(false);
        this.saveError.set(null);
        this.saveQueuedNotice.set(
          'Cloud indisponible — héros mis en file d’attente. Synchronisation dès la reconnexion.',
        );
        this.handoff.setCurrent(withId);
        this.pendingSave.clear();
        this.builder.reset();
        this.afterSaveNavigate(withId);
      },
    });
  }

  async downloadPdf(): Promise<void> {
    this.pdfService.generatePdf(this.character());
  }

  async downloadClassGuidePdf(): Promise<void> {
    const book = this.classPlaybook();
    if (!book || this.exportingClassGuide()) return;
    this.exportingClassGuide.set(true);
    try {
      await this.guidePdf.download({
        title: book.title,
        subtitle: book.subtitle,
        pdfFilename: book.pdfFilename,
        chapters: book.chapters,
      });
    } finally {
      this.exportingClassGuide.set(false);
    }
  }

  /** Demande confirmation : cette action efface la création en cours sans sauvegarder. */
  requestCreateAnother(): void {
    this.showDiscardConfirm.set(true);
  }

  cancelCreateAnother(): void {
    this.showDiscardConfirm.set(false);
  }

  confirmCreateAnother(): void {
    this.showDiscardConfirm.set(false);
    this.builder.reset();
    void this.router.navigate(['/create']);
  }

  goToStep(step: number): void {
    this.builder.goToStep(step);
  }

  prevStep(): void {
    this.builder.previousStep();
  }

  /** Si forge lancée depuis une campagne : propose le héros, ou l’ajoute en pré-tiré MJ. */
  private afterSaveNavigate(character: Character): void {
    const campaignId = this.route.snapshot.queryParamMap.get('campaignId')?.trim();
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl')?.trim();
    const intent = this.route.snapshot.queryParamMap.get('intent')?.trim();

    if (intent === 'pregen' && campaignId && character.id) {
      void this.router.navigate(['/campaigns', campaignId], {
        queryParams: { tab: 'pregens', addPregen: character.id },
      });
      return;
    }

    if (campaignId && character.id) {
      this.campaigns.proposeCharacter(campaignId, character.id).subscribe({
        next: () => {
          void this.router.navigate(['/campaigns', campaignId], {
            queryParams: { tab: 'players', proposed: '1' },
          });
        },
        error: () => {
          void this.router.navigateByUrl(
            returnUrl || `/campaigns/${campaignId}?tab=players`,
          );
        },
      });
      return;
    }

    if (returnUrl) {
      void this.router.navigateByUrl(returnUrl);
      return;
    }

    if (character.id) {
      void this.router.navigate(['/character-sheet', character.id]);
    } else {
      void this.router.navigate(['/character-sheet']);
    }
  }
}
