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
import { visibleClassResources } from '@core/utils/class-resource-labels';

@Component({
  selector: 'app-character-sheet',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './character-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CharacterSheet implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly pdfService = inject(PdfGeneratorService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly character = signal<Character | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  private rawBlobUrl: string | null = null;

  readonly resourceChips = computed(() =>
    visibleClassResources(this.character()?.classResources),
  );

  readonly spellcastingSummary = computed(() => {
    const sc = this.character()?.spellcasting;
    if (!sc) return [] as string[];
    const lines: string[] = [];
    switch (sc.kind) {
      case 'sorcerer':
        if (sc.atavism) lines.push(`Atavisme : ${sc.atavism}`);
        if (sc.metamagic?.length) lines.push(`Métamagie : ${sc.metamagic.join(', ')}`);
        if (sc.sorceryPoints?.max) lines.push(`Points arcaniques : ${sc.sorceryPoints.max}`);
        break;
      case 'warlock':
        if (sc.patron) lines.push(`Suzerain : ${sc.patron}`);
        if (sc.pact) lines.push(`Pacte : ${sc.pact}`);
        if (sc.eldritchInvocations?.length)
          lines.push(`Invocations : ${sc.eldritchInvocations.join(', ')}`);
        if (sc.mysticArcanum?.length)
          lines.push(
            `Arcanes : ${sc.mysticArcanum.map((a) => `${a.spellName} (niv.${a.spellLevel})`).join(', ')}`,
          );
        break;
      case 'wizard':
        if (sc.arcaneTradition) lines.push(`Tradition : ${sc.arcaneTradition}`);
        if (sc.spellMastery?.length)
          lines.push(
            `Maîtrise : ${sc.spellMastery.map((m) => m.spellName).join(', ')}`,
          );
        if (sc.signatureSpells?.length)
          lines.push(
            `Attitrés : ${sc.signatureSpells.map((s) => s.spellName).join(', ')}`,
          );
        break;
      case 'cleric':
        if (sc.deity || sc.domain)
          lines.push([sc.deity, sc.domain].filter(Boolean).join(' — '));
        if (sc.divineChannels?.length)
          lines.push(`Conduits : ${sc.divineChannels.map((ch) => ch.name).join(', ')}`);
        break;
      case 'paladin':
        if (sc.oath) lines.push(`Serment : ${sc.oath}`);
        if (sc.oathSpells?.length)
          lines.push(
            `Sorts de serment : ${sc.oathSpells.flatMap((o) => o.spells).join(', ')}`,
          );
        break;
      case 'druid':
        if (sc.druidCircle) lines.push(`Cercle : ${sc.druidCircle}`);
        if (sc.mysticTranceAvailable) lines.push('Transe mystique disponible');
        break;
      case 'bard':
        if (sc.bardicCollege) lines.push(`Collège : ${sc.bardicCollege}`);
        break;
      default:
        break;
    }
    return lines;
  });

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
      const raw = localStorage.getItem('dragons-current-character');
      if (!raw) {
        this.error.set('Aucun personnage sélectionné.');
        this.loading.set(false);
        return;
      }
      const character = JSON.parse(raw) as Character;
      this.character.set(character);

      const url = await this.pdfService.generatePdfBlob(character);
      this.rawBlobUrl = url;
      this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    } catch (e) {
      console.error(e);
      this.error.set('Impossible de charger la fiche PDF.');
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
    localStorage.setItem('dragons-edit-character', JSON.stringify(c));
    this.router.navigate(['/create']);
  }

  backToList(): void {
    this.router.navigate(['/characters']);
  }
}
