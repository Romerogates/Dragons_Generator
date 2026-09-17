import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';

/** Document texte imprimable (livrets + guides classe + fiches aide). */
export interface GuidePdfDocument {
  title: string;
  subtitle: string;
  pdfFilename: string;
  chapters: GuidePdfChapter[];
}

export interface GuidePdfChapter {
  title: string;
  sections: GuidePdfSection[];
}

export interface GuidePdfSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  numbered?: string[];
  diagram?: string[];
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - MARGIN - 6;

/** Corps de texte A4 — un cran au-dessus de l’écran pour la lisibilité table. */
const FONT = {
  coverBrand: 12,
  coverTitle: 24,
  coverSub: 12,
  tocTitle: 16,
  tocEntry: 12,
  chapter: 15,
  section: 12,
  body: 11,
  subtitle: 12,
  bullet: 11,
  diagram: 8,
  footer: 8,
} as const;

/** Même image que les packs MJ / historiques — lavée pour impression économe. */
const PARCHMENT_URL = '/images/dragons_background.jpg';

/** Voile crème (~78 %) : texture encore visible, encre raisonnable en N&B. */
const PARCHMENT_VEIL = 'rgba(255, 252, 245, 0.78)';

@Injectable({ providedIn: 'root' })
export class GuideRulebookPdfService {
  async download(doc: GuidePdfDocument): Promise<void> {
    const pdf = await this.buildPdf(doc);
    pdf.save(doc.pdfFilename);
  }

  /** Public pour tests unitaires (mock parchemin possible via override Image). */
  async buildPdf(doc: GuidePdfDocument): Promise<jsPDF> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const bg = await this.loadLightParchment();

    this.writeCover(pdf, bg, doc);
    const tocEntries = this.writeToc(pdf, bg, doc);
    const chapterPages: number[] = [];

    for (const chapter of doc.chapters) {
      chapterPages.push(pdf.getNumberOfPages() + 1);
      pdf.addPage();
      this.paintPage(pdf, bg);
      this.writeChapter(pdf, bg, chapter, MARGIN);
    }

    // Liens sommaire + signets PDF après pagination connue.
    for (let i = 0; i < tocEntries.length; i++) {
      const entry = tocEntries[i];
      const target = chapterPages[i] ?? 3;
      pdf.setPage(2);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(FONT.tocEntry);
      pdf.setTextColor(40, 70, 120);
      pdf.textWithLink(entry.label, MARGIN, entry.y, { pageNumber: target });
      pdf.outline.add(null, entry.title, { pageNumber: target });
    }

    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(FONT.footer);
      pdf.setTextColor(90, 80, 65);
      const label =
        i === 1
          ? 'Dragons Generator — Règles débutant'
          : `${doc.title} — ${i}/${pages}`;
      pdf.text(label, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
    }

    return pdf;
  }

  private writeCover(pdf: jsPDF, bg: string | null, doc: GuidePdfDocument): void {
    this.paintPage(pdf, bg);
    let y = 72;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(FONT.coverBrand);
    pdf.setTextColor(90, 75, 55);
    pdf.text('Dragons Generator — Règles débutant', PAGE_W / 2, y, { align: 'center' });
    y += 14;

    pdf.setDrawColor(140, 120, 90);
    pdf.setLineWidth(0.4);
    pdf.line(MARGIN + 24, y, PAGE_W - MARGIN - 24, y);
    y += 18;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(FONT.coverTitle);
    pdf.setTextColor(28, 22, 14);
    const titleLines = pdf.splitTextToSize(doc.title, CONTENT_W - 10) as string[];
    pdf.text(titleLines, PAGE_W / 2, y, { align: 'center' });
    y += titleLines.length * 10 + 10;

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(FONT.coverSub);
    pdf.setTextColor(70, 60, 48);
    const subLines = pdf.splitTextToSize(doc.subtitle, CONTENT_W - 10) as string[];
    pdf.text(subLines, PAGE_W / 2, y, { align: 'center' });
    y += subLines.length * 6 + 28;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 90, 75);
    pdf.text('Univers Eana · Dragons', PAGE_W / 2, y, { align: 'center' });
  }

  private writeToc(
    pdf: jsPDF,
    bg: string | null,
    doc: GuidePdfDocument,
  ): { title: string; label: string; y: number }[] {
    pdf.addPage();
    this.paintPage(pdf, bg);
    let y = MARGIN;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(FONT.tocTitle);
    pdf.setTextColor(28, 22, 14);
    pdf.text('Sommaire', MARGIN, y);
    y += 12;

    pdf.setDrawColor(140, 120, 90);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 10;

    const entries: { title: string; label: string; y: number }[] = [];
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(FONT.tocEntry);

    doc.chapters.forEach((chapter, i) => {
      y = this.ensureSpace(pdf, bg, y, 10);
      const label = `${i + 1}.  ${chapter.title}`;
      const lines = pdf.splitTextToSize(label, CONTENT_W) as string[];
      // Réserve la place ; le texte cliquable est dessiné après pagination.
      entries.push({ title: chapter.title, label: lines[0] ?? label, y });
      y += lines.length * 6.2 + 3;
    });

    return entries;
  }

  private writeChapter(
    pdf: jsPDF,
    bg: string | null,
    chapter: GuidePdfChapter,
    startY: number,
  ): number {
    let y = this.ensureSpace(pdf, bg, startY, 16);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(FONT.chapter);
    pdf.setTextColor(35, 28, 18);
    const lines = pdf.splitTextToSize(chapter.title, CONTENT_W) as string[];
    pdf.text(lines, MARGIN, y);
    y += lines.length * 6.5 + 3;

    for (const section of chapter.sections) {
      y = this.writeSection(pdf, bg, section, y);
    }
    return y + 4;
  }

  private writeSection(
    pdf: jsPDF,
    bg: string | null,
    section: GuidePdfSection,
    startY: number,
  ): number {
    let y = this.ensureSpace(pdf, bg, startY, 12);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(FONT.section);
    pdf.setTextColor(50, 40, 28);
    const titleLines = pdf.splitTextToSize(section.title, CONTENT_W) as string[];
    pdf.text(titleLines, MARGIN, y);
    y += titleLines.length * 5.5 + 2;

    for (const p of section.paragraphs ?? []) {
      y = this.writeParagraph(pdf, bg, p, y, FONT.body, false);
      y += 2.5;
    }

    if (section.bullets?.length) {
      for (const b of section.bullets) {
        y = this.writeBullet(pdf, bg, b, y, '•');
      }
      y += 2;
    }

    if (section.numbered?.length) {
      section.numbered.forEach((item, i) => {
        y = this.writeBullet(pdf, bg, item, y, `${i + 1}.`);
      });
      y += 2;
    }

    if (section.diagram?.length) {
      y = this.ensureSpace(pdf, bg, y, section.diagram.length * 3.8 + 4);
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(FONT.diagram);
      pdf.setTextColor(40, 32, 22);
      for (const line of section.diagram) {
        y = this.ensureSpace(pdf, bg, y, 4);
        pdf.text(line, MARGIN, y);
        y += 3.6;
      }
      y += 3;
    }

    return y + 2;
  }

  private writeParagraph(
    pdf: jsPDF,
    bg: string | null,
    text: string,
    y: number,
    size: number,
    muted: boolean,
  ): number {
    pdf.setFont('helvetica', muted ? 'italic' : 'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(muted ? 85 : 32, muted ? 78 : 32, muted ? 62 : 28);
    const lines = pdf.splitTextToSize(text, CONTENT_W) as string[];
    return this.writeLines(pdf, bg, lines, y, size);
  }

  private writeBullet(
    pdf: jsPDF,
    bg: string | null,
    text: string,
    y: number,
    marker: string,
  ): number {
    y = this.ensureSpace(pdf, bg, y, 8);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(FONT.bullet);
    pdf.setTextColor(32, 32, 28);
    const indent = 6;
    const markerW = marker.length > 1 ? 7 : 4;
    pdf.text(marker, MARGIN, y);
    const lines = pdf.splitTextToSize(text, CONTENT_W - indent - markerW) as string[];
    pdf.text(lines, MARGIN + indent + markerW, y);
    return y + lines.length * 5 + 1.5;
  }

  private writeLines(
    pdf: jsPDF,
    bg: string | null,
    lines: string[],
    y: number,
    size: number,
  ): number {
    const lineH = size * 0.48;
    for (const line of lines) {
      y = this.ensureSpace(pdf, bg, y, lineH + 1);
      pdf.text(line, MARGIN, y);
      y += lineH;
    }
    return y;
  }

  private ensureSpace(pdf: jsPDF, bg: string | null, y: number, need: number): number {
    if (y + need <= BOTTOM) return y;
    pdf.addPage();
    this.paintPage(pdf, bg);
    return MARGIN;
  }

  /** Fond parchemin très clair + fine bordure (lisible N&B, peu d’encre). */
  private paintPage(pdf: jsPDF, bg: string | null): void {
    if (bg) {
      pdf.addImage(bg, 'JPEG', 0, 0, PAGE_W, PAGE_H);
    } else {
      pdf.setFillColor(251, 246, 235);
      pdf.rect(0, 0, PAGE_W, PAGE_H, 'F');
    }

    pdf.setDrawColor(160, 140, 110);
    pdf.setLineWidth(0.45);
    const inset = 8;
    pdf.rect(inset, inset, PAGE_W - inset * 2, PAGE_H - inset * 2);
    pdf.setLineWidth(0.2);
    pdf.rect(inset + 1.5, inset + 1.5, PAGE_W - (inset + 1.5) * 2, PAGE_H - (inset + 1.5) * 2);
  }

  /**
   * Charge le parchemin des historiques et le blanchit (~78 %) pour une impression
   * économe et encore lisible en noir et blanc.
   */
  private loadLightParchment(): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          ctx.fillStyle = PARCHMENT_VEIL;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = PARCHMENT_URL;
    });
  }
}
