import {
  Component,
  inject,
  computed,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { CharacterBuilderService } from '@core/services/character-builder.service';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
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
})
export class SummaryStep implements OnInit, OnDestroy {
  readonly builder = inject(CharacterBuilderService);
  private router = inject(Router);
  private pdfService = inject(PdfGeneratorService);
  private sanitizer = inject(DomSanitizer);

  readonly abilityKeys = ABILITY_KEYS;
  readonly abilityLabels = ABILITY_KEY_TO_LABEL;

  readonly character = computed<Character>(() => this.builder.build());
  readonly isEditMode = computed(() => this.builder.isEditMode);

  // === PDF Preview ===
  readonly isLoadingPreview = signal(true);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  private rawBlobUrl: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      // Adapte ici selon la signature de ta version du service
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
    // Libère la mémoire du blob
    if (this.rawBlobUrl) URL.revokeObjectURL(this.rawBlobUrl);
  }

  openFullscreen(): void {
    if (this.rawBlobUrl) window.open(this.rawBlobUrl, '_blank');
  }

  // === Helpers d'affichage ===

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

  // === Actions ===

  saveCharacter(): void {
    const character = this.character();
    const saved = this.getSavedCharacters();
    const editId = this.builder.editingCharacterId;

    if (editId) {
      const idx = saved.findIndex((c: any) => c.id === editId);
      if (idx !== -1) saved[idx] = character;
      else saved.push(character);
    } else {
      saved.push(character);
    }

    localStorage.setItem('dragons-characters', JSON.stringify(saved));
    this.builder.reset();
    this.router.navigate(['/characters']);
  }

  async downloadPdf(): Promise<void> {
    this.pdfService.generatePdf(this.character());
  }

  createAnother(): void {
    this.builder.reset();
    this.router.navigate(['/create']);
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
