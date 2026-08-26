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
import {
  ABILITY_KEY_TO_LABEL,
  ABILITY_KEYS,
  type AbilityKey,
  type Character,
} from '../../../../core/models/Character/character';

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
    if (!this.auth.isLoggedIn()) {
      this.pendingSave.stash(this.character());
      this.showAuthGate.set(true);
      return;
    }
    this.persistToCloud(this.character());
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
    this.cloud.save(character as any).subscribe({
      next: (serverId) => {
        const updated = {
          ...character,
          id: serverId || character.id,
        };
        this.upsertLocal(updated);
        localStorage.setItem('dragons-current-character', JSON.stringify(updated));
        this.pendingSave.clear();
        this.saving.set(false);
        this.builder.reset();
        void this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set(
          'La sauvegarde cloud a échoué. Vérifie ta connexion ou réessaie dans un instant.',
        );
      },
    });
  }

  private upsertLocal(character: Character): void {
    const saved = this.getSavedCharacters();
    const idx = saved.findIndex((c: any) => c.id === character.id);
    if (idx >= 0) saved[idx] = character;
    else saved.push(character);
    localStorage.setItem('dragons-characters', JSON.stringify(saved));
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

  private getSavedCharacters(): any[] {
    try {
      const raw = localStorage.getItem('dragons-characters');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
