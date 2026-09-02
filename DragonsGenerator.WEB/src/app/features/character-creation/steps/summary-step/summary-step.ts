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
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { CharacterBuilderService } from '@core/services/character-builder.service';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { PendingCharacterSaveService } from '@core/services/pending-character-save.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { OfflineCodexService } from '@core/services/offline-codex.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
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

@Component({
  selector: 'app-summary-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './summary-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SummaryStep implements OnInit, OnDestroy {
  readonly builder = inject(CharacterBuilderService);
  private router = inject(Router);
  private pdfService = inject(PdfGeneratorService);
  private sanitizer = inject(DomSanitizer);
  private cloud = inject(CharacterCloudService);
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

  readonly isLoadingPreview = signal(true);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  readonly showAuthGate = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  private rawBlobUrl: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      const url = await this.pdfService.generatePdfBlob(this.character());
      this.rawBlobUrl = url;
      this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } catch (err) {
      console.error('Erreur génération aperçu PDF :', err);
    } finally {
      this.isLoadingPreview.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.rawBlobUrl) URL.revokeObjectURL(this.rawBlobUrl);
  }

  openFullscreen(): void {
    if (this.rawBlobUrl) window.open(this.rawBlobUrl, '_blank');
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

    if (!this.connectivity.isOnline()) {
      const withId = {
        ...character,
        id: character.id ?? crypto.randomUUID(),
        cloudSynced: false,
      };
      this.offlineSync.queueCharacterSave(withId, this.isEditMode());
      this.handoff.setCurrent(withId);
      this.pendingSave.clear();
      this.saving.set(false);
      this.builder.reset();
      void this.router.navigate(['/character-sheet']);
      return;
    }

    this.cloud.save(character as Character).subscribe({
      next: (serverId) => {
        const updated = {
          ...character,
          id: serverId || character.id,
          cloudSynced: true,
        };
        this.handoff.setCurrent(updated);
        this.pendingSave.clear();
        this.saving.set(false);
        this.builder.reset();
        void this.router.navigate(['/character-sheet']);
      },
      error: () => {
        const withId = {
          ...character,
          id: character.id ?? crypto.randomUUID(),
          cloudSynced: false,
        };
        this.offlineSync.queueCharacterSave(withId, this.isEditMode());
        this.handoff.setCurrent(withId);
        this.pendingSave.clear();
        this.saving.set(false);
        this.saveError.set(
          'Hors ligne : personnage enregistré localement. Il sera envoyé au cloud dès que la connexion reviendra.',
        );
        this.builder.reset();
        void this.router.navigate(['/characters']);
      },
    });
  }

  async downloadPdf(): Promise<void> {
    this.pdfService.generatePdf(this.character());
  }

  createAnother(): void {
    this.builder.reset();
    void this.router.navigate(['/create']);
  }

  goToStep(step: number): void {
    this.builder.goToStep(step);
  }

  prevStep(): void {
    this.builder.previousStep();
  }
}
