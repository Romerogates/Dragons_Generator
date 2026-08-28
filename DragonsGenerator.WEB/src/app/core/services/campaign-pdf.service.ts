import { Injectable, inject } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { Creature } from '@core/models/Creatures/creature';
import { Character, Attack } from '@core/models/Character/character';
import { CampaignData, EncounterGroup } from '@core/models/Campaign/campaign';
import { CREATURE_ROLE_LABELS } from '@core/models/Story/story';
import { formatChallengeRating, ABILITY_LABELS } from '@core/utils/creature-display.util';
import { encounterTotalXp } from '@core/models/Campaign/campaign';
import { PdfGeneratorService } from './pdf-generator.service';

const PARCHMENT = '/images/dragons_background.jpg';
const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

export interface CreaturePrintEntry {
  creature: Creature;
  customName?: string;
  role?: string;
  backstory?: string;
}

export interface PlayerGmSummary {
  name: string;
  species: string;
  className: string;
  armorClass: number | string;
  hitPoints: number | string;
  initiative: number | string;
  attacks: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignPdfService {
  private readonly characterPdf = inject(PdfGeneratorService);

  async downloadCreatureSheet(entry: CreaturePrintEntry): Promise<void> {
    const pdf = await this.buildCreaturesPdf([entry], entry.customName || entry.creature.name);
    pdf.save(this.safeName(`${entry.customName || entry.creature.name}-fiche.pdf`));
  }

  async downloadCreaturesCompilation(
    entries: CreaturePrintEntry[],
    title: string,
  ): Promise<void> {
    const pdf = await this.buildCreaturesPdf(entries, title);
    pdf.save(this.safeName(`${title}-bestiaire.pdf`));
  }

  /** Génère le PDF bestiaire et retourne une blob URL pour l'aperçu in-page. */
  async generateCreaturesPdfBlob(
    entries: CreaturePrintEntry[],
    title: string,
  ): Promise<string> {
    const pdf = await this.buildCreaturesPdf(entries, title);
    const blob = pdf.output('blob');
    return URL.createObjectURL(blob);
  }

  async downloadCampaignPack(
    title: string,
    data: CampaignData,
    creatureEntries: CreaturePrintEntry[],
    playerSummaries: PlayerGmSummary[],
  ): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const bg = await this.loadImage(PARCHMENT);

    this.drawCoverPage(pdf, bg, title, data);
    this.drawSynopsisPage(pdf, bg, data);

    if (creatureEntries.length) {
      await this.appendCreaturesToPdf(pdf, bg, creatureEntries, 'Créatures de l\'aventure');
    }

    if (data.encounters.length) {
      this.drawEncountersSection(pdf, bg, data.encounters);
    }

    if (playerSummaries.length) {
      this.drawPlayerSummariesSection(pdf, bg, playerSummaries);
    }

    if (data.notes?.trim()) {
      this.drawNotesSection(pdf, bg, data.notes);
    }

    pdf.save(this.safeName(`${title}-pack-mj.pdf`));
  }

  async downloadPlayerSummaries(title: string, summaries: PlayerGmSummary[]): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const bg = await this.loadImage(PARCHMENT);
    this.drawCoverPage(pdf, bg, title, null, 'Synthèse des héros — MJ');
    this.drawPlayerSummariesSection(pdf, bg, summaries);
    pdf.save(this.safeName(`${title}-joueurs-mj.pdf`));
  }

  async downloadPlayerFullSheet(character: Character): Promise<void> {
    await this.characterPdf.generatePdf(character);
  }

  buildPlayerGmSummary(character: Character): PlayerGmSummary {
    const attacks = (character.attacks ?? [])
      .slice(0, 4)
      .map((a) => this.formatAttack(a))
      .join(' · ');

    const species = character.species.subspeciesLabel
      ? `${character.species.label} (${character.species.subspeciesLabel})`
      : character.species.label;
    const className = character.classes.map((c) => c.classLabel).join(' / ') || '—';

    return {
      name: character.name || 'Sans nom',
      species,
      className,
      armorClass: character.defense?.armorClass ?? '—',
      hitPoints: character.vitality?.hitPointsMax ?? '—',
      initiative: this.formatInitiative(character.initiative),
      attacks: attacks || '—',
    };
  }

  private async buildCreaturesPdf(entries: CreaturePrintEntry[], docTitle: string): Promise<jsPDF> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const bg = await this.loadImage(PARCHMENT);

    pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    let y = MARGIN + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(60, 40, 20);
    pdf.text(docTitle, MARGIN, y);
    y += 12;

    for (const entry of entries) {
      y = this.drawCreatureBlock(pdf, bg, entry, y);
    }
    return pdf;
  }

  private async appendCreaturesToPdf(
    pdf: jsPDF,
    bg: string,
    entries: CreaturePrintEntry[],
    sectionTitle: string,
  ): Promise<void> {
    pdf.addPage();
    pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    let y = MARGIN + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(60, 40, 20);
    pdf.text(sectionTitle, MARGIN, y);
    y += 12;

    for (const entry of entries) {
      y = this.drawCreatureBlock(pdf, bg, entry, y);
    }
  }

  private drawCreatureBlock(pdf: jsPDF, bg: string, entry: CreaturePrintEntry, startY: number): number {
    const c = entry.creature;
    const displayName = entry.customName?.trim() || c.name;
    let y = startY;

    if (y > PAGE_H - 40) {
      pdf.addPage();
      pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
      y = MARGIN;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(80, 30, 10);
    pdf.text(displayName, MARGIN, y);
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(50, 40, 30);
    const meta = [
      c.name !== displayName ? `Bestiaire : ${c.name}` : null,
      c.type,
      formatChallengeRating(c.challengeRating),
      `${c.xp} PX`,
      entry.role ? CREATURE_ROLE_LABELS[entry.role as keyof typeof CREATURE_ROLE_LABELS] ?? entry.role : null,
    ]
      .filter(Boolean)
      .join(' · ');
    pdf.text(meta, MARGIN, y);
    y += 5;

    if (entry.backstory?.trim()) {
      y = this.writeParagraph(pdf, bg, entry.backstory, y, 8, true);
      y += 2;
    }

    if (c.description?.trim()) {
      y = this.writeParagraph(pdf, bg, c.description, y, 8, true);
      y += 2;
    }

    const stats = [
      `CA ${c.armorClass}${c.armorNote ? ` (${c.armorNote})` : ''}`,
      `PV ${c.hitPoints}${c.woundThreshold != null ? ` · SB ${c.woundThreshold}` : ''}`,
      `Vitesse ${c.speed}`,
      c.savingThrows ? `JS ${c.savingThrows}` : null,
      c.skills ? `Comp. ${c.skills}` : null,
      c.senses ? `Sens ${c.senses}` : null,
      c.languages ? `Langues ${c.languages}` : null,
    ].filter(Boolean) as string[];

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('STATISTIQUES', MARGIN, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    for (const line of stats) {
      y = this.writeLines(pdf, bg, [line], y, 8);
    }
    y += 2;

    const abilityLine = Object.entries(c.abilities)
      .map(([k, v]) => `${ABILITY_LABELS[k] ?? k} ${v.score} (${v.modifier})`)
      .join('  ·  ');
    pdf.setFont('helvetica', 'bold');
    pdf.text('CARACTÉRISTIQUES', MARGIN, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    y = this.writeLines(pdf, bg, pdf.splitTextToSize(abilityLine, CONTENT_W), y, 8);
    y += 2;

    y = this.drawNamedEntries(pdf, bg, 'TRAITS', c.traits, y);
    y = this.drawNamedEntries(pdf, bg, 'ACTIONS', c.actions, y);
    y = this.drawNamedEntries(pdf, bg, 'RÉACTIONS', c.reactions, y);
    y = this.drawNamedEntries(pdf, bg, 'ACTIONS LÉGENDAIRES', c.legendaryActions, y);

    return y + 8;
  }

  private drawNamedEntries(
    pdf: jsPDF,
    bg: string,
    title: string,
    entries: { name: string; description: string }[],
    y: number,
  ): number {
    if (!entries?.length) return y;
    if (y > PAGE_H - 25) {
      pdf.addPage();
      pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
      y = MARGIN;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(80, 30, 10);
    pdf.text(title, MARGIN, y);
    y += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(40, 35, 30);
    for (const e of entries) {
      if (y > PAGE_H - 20) {
        pdf.addPage();
        pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
        y = MARGIN;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(e.name, MARGIN, y);
      y += 3.5;
      pdf.setFont('helvetica', 'normal');
      y = this.writeParagraph(pdf, bg, e.description, y, 7.5, false);
      y += 1.5;
    }
    return y;
  }

  private drawCoverPage(
    pdf: jsPDF,
    bg: string,
    title: string,
    data: CampaignData | null,
    subtitle?: string,
  ): void {
    pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(70, 35, 10);
    pdf.text(title, PAGE_W / 2, 80, { align: 'center' });
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(subtitle ?? 'Pack Maître du Jeu — Dragons', PAGE_W / 2, 95, { align: 'center' });
    if (data) {
      pdf.setFontSize(10);
      const info = [`Niveau des héros : ${data.partyLevel}`, data.setting?.trim()].filter(Boolean);
      let y = 110;
      for (const line of info) {
        pdf.text(line!, PAGE_W / 2, y, { align: 'center' });
        y += 6;
      }
    }
  }

  private drawSynopsisPage(pdf: jsPDF, bg: string, data: CampaignData): void {
    if (!data.adventure?.trim()) return;
    pdf.addPage();
    pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    let y = MARGIN + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(70, 35, 10);
    pdf.text('Synopsis', MARGIN, y);
    y += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    this.writeParagraph(pdf, bg, data.adventure, y, 9, false);
  }

  private drawEncountersSection(pdf: jsPDF, bg: string, encounters: EncounterGroup[]): void {
    pdf.addPage();
    pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    let y = MARGIN + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Rencontres', MARGIN, y);
    y += 10;

    for (const enc of encounters) {
      if (y > PAGE_H - 30) {
        pdf.addPage();
        pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
        y = MARGIN;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(enc.name, MARGIN, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(`XP vaincus : ${encounterTotalXp(enc)}`, MARGIN, y);
      y += 5;
      for (const cr of enc.creatures) {
        const line = `• ${cr.customName || cr.creatureName} ×${cr.quantity} (${cr.xp} XP/u) — ${cr.defeated}/${cr.quantity} vaincus`;
        y = this.writeLines(pdf, bg, pdf.splitTextToSize(line, CONTENT_W), y, 8);
      }
      y += 4;
    }
  }

  private drawPlayerSummariesSection(pdf: jsPDF, bg: string, summaries: PlayerGmSummary[]): void {
    pdf.addPage();
    pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    let y = MARGIN + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Synthèse des héros (MJ)', MARGIN, y);
    y += 10;

    for (const p of summaries) {
      if (y > PAGE_H - 35) {
        pdf.addPage();
        pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
        y = MARGIN;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(p.name, MARGIN, y);
      y += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const lines = [
        `Espèce : ${p.species}  ·  Classe : ${p.className}`,
        `CA ${p.armorClass}  ·  PV ${p.hitPoints}  ·  Init. ${p.initiative}`,
        `Attaques : ${p.attacks}`,
      ];
      for (const line of lines) {
        y = this.writeLines(pdf, bg, pdf.splitTextToSize(line, CONTENT_W), y, 9);
      }
      y += 6;
    }
  }

  private drawNotesSection(pdf: jsPDF, bg: string, notes: string): void {
    pdf.addPage();
    pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    let y = MARGIN + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Notes MJ', MARGIN, y);
    y += 8;
    pdf.setFont('helvetica', 'normal');
    this.writeParagraph(pdf, bg, notes, y, 9, false);
  }

  private writeParagraph(
    pdf: jsPDF,
    bg: string,
    text: string,
    y: number,
    fontSize: number,
    italic: boolean,
  ): number {
    pdf.setFont('helvetica', italic ? 'italic' : 'normal');
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, CONTENT_W);
    return this.writeLines(pdf, bg, lines, y, fontSize);
  }

  private writeLines(pdf: jsPDF, bg: string, lines: string | string[], y: number, fontSize: number): number {
    const arr = Array.isArray(lines) ? lines : [lines];
    const lh = fontSize * 0.45;
    for (const line of arr) {
      if (y > PAGE_H - MARGIN) {
        pdf.addPage();
        pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
        y = MARGIN;
      }
      pdf.text(line, MARGIN, y);
      y += lh;
    }
    return y;
  }

  private formatAttack(a: Attack): string {
    const mod = a.attackBonus >= 0 ? `+${a.attackBonus}` : `${a.attackBonus}`;
    const dmg = a.damage ? ` (${a.damage})` : '';
    return `${a.name} ${mod}${dmg}`;
  }

  private formatInitiative(init: number | undefined): string {
    if (init == null) return '—';
    return init >= 0 ? `+${init}` : `${init}`;
  }

  private loadImage(url: string): Promise<string> {
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

  private safeName(name: string): string {
    return name.replace(/[^\w\s\-àâäéèêëïîôùûüç]/gi, '').trim() || 'document';
  }
}
