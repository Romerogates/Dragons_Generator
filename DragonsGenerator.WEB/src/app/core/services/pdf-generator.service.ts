import { Injectable, inject } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { firstValueFrom } from 'rxjs';
import { labelForGameId } from '@core/utils/game-id-labels';
import {
  GRIMOIRE_IMAGES,
  GRIMOIRE_SUPP_IMAGE,
} from '@core/config/grimoire-coords.config';
import { buildGrimoireEffectSummary } from '@core/utils/spell-grimoire-effect.util';
import { DataService } from '@core/services/data.service';
import type { Spell } from '@core/models/Spells/spell';
import { Character } from '@core/models/Character/character';
import { PdfSheetGrimoire } from './pdf/pdf-sheet-grimoire';

@Injectable({
  providedIn: 'root',
})
export class PdfGeneratorService {
  private readonly dataService = inject(DataService);
  private readonly sheet = new PdfSheetGrimoire();

  async generatePdf(character: Character): Promise<void> {
    const pdf = await this.buildPdf(character);
    pdf.save(`${character.name || 'personnage'}.pdf`);
  }

  async generatePdfBlob(character: Character): Promise<string> {
    const pdf = await this.buildPdf(character);
    const blob = pdf.output('blob');
    return URL.createObjectURL(blob);
  }

  private async buildPdf(character: Character): Promise<jsPDF> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const enriched = await this.enrichCharacterSpells(character);
    const images = await this.loadBackgroundImages();

    pdf.addImage(images[0], 'JPEG', 0, 0, 210, 297);
    this.sheet.drawPage1(pdf, enriched);

    pdf.addPage();
    pdf.addImage(images[1], 'JPEG', 0, 0, 210, 297);
    this.sheet.drawPage2(pdf, enriched);

    pdf.addPage();
    pdf.addImage(images[2], 'JPEG', 0, 0, 210, 297);
    this.sheet.drawPage3(pdf, enriched);

    pdf.addPage();
    pdf.addImage(images[3], 'JPEG', 0, 0, 210, 297);
    this.sheet.drawPage4(pdf, enriched);

    if (enriched.spellcasting) {
      const grimoireUrl = GRIMOIRE_IMAGES[enriched.spellcasting.kind];
      const grimoireImg = await this.loadImage(grimoireUrl);
      pdf.addPage();
      pdf.addImage(grimoireImg, 'JPEG', 0, 0, 210, 297);

      const sc = enriched.spellcasting;
      const isGrp =
        sc.kind === 'ranger' || sc.kind === 'paladin' || sc.kind === 'fighter_eldritch_knight';
      const mainPlan = isGrp ? null : this.sheet.planMainGrimoireTable(pdf, enriched);

      this.sheet.drawGrimoire(pdf, enriched, mainPlan);

      const overflow = isGrp ? this.sheet.sortedKnownSpells(enriched) : (mainPlan?.overflow ?? []);
      if (overflow.length > 0) {
        const suppImg = await this.loadImage(GRIMOIRE_SUPP_IMAGE);
        const suppPages = this.sheet.planSuppGrimoirePages(pdf, overflow);
        for (const pagePlan of suppPages) {
          pdf.addPage();
          pdf.addImage(suppImg, 'JPEG', 0, 0, 210, 297);
          this.sheet.drawGrimoireSupp(pdf, pagePlan);
        }
      }
    }

    return pdf;
  }

  async loadBackgroundImages(): Promise<string[]> {
    const urls = [
      '/images/sheets/sheet-page1.jpg',
      '/images/sheets/sheet-page2.jpg',
      '/images/sheets/sheet-page3.jpg',
      '/images/sheets/sheet-page4.jpg',
    ];
    return Promise.all(urls.map((u) => this.loadImage(u)));
  }

  loadImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  private async enrichCharacterSpells(character: Character): Promise<Character> {
    if (!character.knownSpells?.length) return character;

    let spellById = new Map<string, Spell>();
    try {
      const spells = await firstValueFrom(this.dataService.getSpells());
      spellById = new Map(spells.map((s) => [s.id, s]));
    } catch {
      return character;
    }

    const knownSpells = character.knownSpells.map((inst) => {
      const raw = spellById.get(inst.refId);
      const unresolvedName = !inst.name || inst.name === inst.refId || /^spl-/.test(inst.name);
      const name = unresolvedName && raw ? raw.name : inst.name;

      return {
        ...inst,
        name: name || labelForGameId(inst.refId),
        effectSummary: raw ? buildGrimoireEffectSummary(raw) : (inst.effectSummary ?? ''),
      };
    });

    return { ...character, knownSpells };
  }
}
