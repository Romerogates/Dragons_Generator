import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PdfGeneratorService } from '@core/services/pdf-generator.service';
import type { Character } from '@core/models/Character/character';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { CharacterPlayView } from './character-play-view';

@Component({
  selector: 'app-character-sheet',
  standalone: true,
  imports: [CommonModule, RouterLink, CharacterPlayView],
  templateUrl: './character-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CharacterSheet implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly pdfService = inject(PdfGeneratorService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly handoff = inject(CharacterHandoffService);

  readonly character = signal<Character | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  readonly pdfFailed = signal(false);
  private rawBlobUrl: string | null = null;

  readonly auraFeatures = computed(() => {
    const feats = this.character()?.features ?? [];
    return feats
      .filter((f) => /aura/i.test(f.name) || /Portée d'aura/i.test(f.desc ?? ''))
      .map((f) => {
        const m = (f.desc ?? '').match(/Portée d'aura\s*:\s*([\d.,]+)\s*m/i);
        return m ? `${f.name} (${m[1]} m)` : f.name;
      });
  });

  async ngOnInit(): Promise<void> {
    try {
      const character = this.handoff.peekCurrent();
      if (!character) {
        this.error.set('Aucun personnage sélectionné.');
        this.loading.set(false);
        return;
      }
      this.character.set(character);

      try {
        const url = await this.pdfService.generatePdfBlob(character);
        this.rawBlobUrl = url;
        this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      } catch (e) {
        console.error(e);
        this.pdfFailed.set(true);
      }
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.rawBlobUrl) URL.revokeObjectURL(this.rawBlobUrl);
  }

  getName(): string {
    return this.character()?.name || 'Héros';
  }

  getSpecies(): string {
    const c: any = this.character();
    if (c?.species && typeof c.species === 'object') return c.species.label || '';
    return c?.speciesName || '';
  }

  getClass(): string {
    const c: any = this.character();
    if (Array.isArray(c?.classes) && c.classes.length > 0) {
      const cls = c.classes[0];
      return cls.subclassLabel
        ? `${cls.classLabel} — ${cls.subclassLabel}`
        : cls.classLabel || '';
    }
    return c?.className || '';
  }

  getLevel(): number {
    return this.character()?.totalLevel ?? 1;
  }

  getHp(): number {
    return this.character()?.vitality?.hitPointsMax ?? 0;
  }

  getAc(): number {
    return this.character()?.defense?.armorClass ?? 10;
  }

  downloadPdf(): void {
    const c = this.character();
    if (c) this.pdfService.generatePdf(c);
  }

  openFullscreen(): void {
    if (this.rawBlobUrl) window.open(this.rawBlobUrl, '_blank');
  }

  editCharacter(): void {
    const c = this.character();
    if (!c) return;
    this.handoff.stashEdit(c);
    this.router.navigate(['/create']);
  }

  backToList(): void {
    this.router.navigate(['/characters']);
  }
}
