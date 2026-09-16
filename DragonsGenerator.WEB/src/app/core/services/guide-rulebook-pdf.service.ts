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

/** Même image que les packs MJ / historiques — lavée pour impression économe. */
const PARCHMENT_URL = '/images/dragons_background.jpg';

@Injectable({ providedIn: 'root' })
export class GuideRulebookPdfService {
  async download(doc: GuidePdfDocument): Promise<void> {
    const pdf = await this.build(doc);
    pdf.save(doc.pdfFilename);
  }

  private async build(doc: GuidePdfDocument): Promise<jsPDF> {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const bg = await this.loadLightParchment();

    this.paintPage(pdf, bg);

    let y = MARGIN;
    y = this.writeTitle(pdf, doc.title, y);
    y = this.writeParagraph(pdf, bg, doc.subtitle, y, 11, true);
    y += 4;
    pdf.setDrawColor(140, 120, 90);
    pdf.setLineWidth(0.35);
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 8;

    for (const chapter of doc.chapters) {
      y = this.writeChapter(pdf, bg, chapter, y);
    }

    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(90, 80, 65);
      pdf.text(`${doc.title} — ${i}/${pages}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
    }

    return pdf;
  }

  private writeChapter(
    pdf: jsPDF,
    bg: string | null,
    chapter: GuidePdfChapter,
    startY: number,
  ): number {
    let y = this.ensureSpace(pdf, bg, startY, 16);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(35, 28, 18);
    const lines = pdf.splitTextToSize(chapter.title, CONTENT_W) as string[];
    pdf.text(lines, MARGIN, y);
    y += lines.length * 6 + 3;

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
    pdf.setFontSize(11);
    pdf.setTextColor(50, 40, 28);
    const titleLines = pdf.splitTextToSize(section.title, CONTENT_W) as string[];
    pdf.text(titleLines, MARGIN, y);
    y += titleLines.length * 5 + 2;

    for (const p of section.paragraphs ?? []) {
      y = this.writeParagraph(pdf, bg, p, y, 10, false);
      y += 2;
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
      y = this.ensureSpace(pdf, bg, y, section.diagram.length * 3.6 + 4);
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(40, 32, 22);
      for (const line of section.diagram) {
        y = this.ensureSpace(pdf, bg, y, 4);
        pdf.text(line, MARGIN, y);
        y += 3.4;
      }
      y += 3;
    }

    return y + 2;
  }

  private writeTitle(pdf: jsPDF, title: string, y: number): number {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(28, 22, 14);
    const lines = pdf.splitTextToSize(title, CONTENT_W) as string[];
    pdf.text(lines, MARGIN, y);
    return y + lines.length * 8 + 2;
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
    pdf.setFontSize(10);
    pdf.setTextColor(32, 32, 28);
    const indent = 6;
    const markerW = marker.length > 1 ? 7 : 4;
    pdf.text(marker, MARGIN, y);
    const lines = pdf.splitTextToSize(text, CONTENT_W - indent - markerW) as string[];
    pdf.text(lines, MARGIN + indent + markerW, y);
    return y + lines.length * 4.6 + 1.5;
  }

  private writeLines(
    pdf: jsPDF,
    bg: string | null,
    lines: string[],
    y: number,
    size: number,
  ): number {
    const lineH = size * 0.45;
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
   * Charge le parchemin des historiques et le blanchit (~80 %) pour une impression
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
          // Voile crème : garde un peu de texture, réduit fortement l’encre.
          ctx.fillStyle = 'rgba(255, 252, 245, 0.82)';
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
