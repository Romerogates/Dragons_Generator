import type { jsPDF } from 'jspdf';
import { labelForGameId } from '@core/utils/game-id-labels';
import {
  sheetPxToMmX as pxToMmX,
  sheetPxToMmY as pxToMmY,
} from '@core/config/character-sheet-pdf-coords.config';

/** Primitives de dessin fiche A4 (px feuille → mm). */
export class PdfSheetDraw {
  text(pdf: jsPDF, text: string, xPx: number, yPx: number): void {
    if (!text && text !== '0') return;
    pdf.text(String(text), pxToMmX(xPx), pxToMmY(yPx));
  }

  /**
   * Texte avec réduction automatique de la police (par palier de 1, jusqu'à `minFontSize`)
   * tant qu'il dépasse `maxWidthPx`. Utilisé pour les libellés d'identité de sous-classe
   * (collège bardique, tradition arcanique, suzerain, atavisme, cercle druidique…) dont
   * la longueur varie beaucoup et qui peuvent sinon chevaucher le bord droit du parchemin.
   * Remet la police à `baseFontSize` après coup pour ne pas affecter le texte suivant.
   */
  textFit(
    pdf: jsPDF,
    text: string,
    xPx: number,
    yPx: number,
    maxWidthPx: number,
    baseFontSize: number,
    minFontSize: number = 8,
  ): void {
    if (!text) return;
    let size = baseFontSize;
    pdf.setFontSize(size);
    const maxWidthMm = pxToMmX(maxWidthPx);
    while (size > minFontSize && pdf.getTextWidth(text) > maxWidthMm) {
      size -= 1;
      pdf.setFontSize(size);
    }
    this.text(pdf, text, xPx, yPx);
    pdf.setFontSize(baseFontSize);
  }

  textWrapped(
    pdf: jsPDF,
    text: string,
    xPx: number,
    yPx: number,
    maxWidthMm: number,
    lineHeightMm: number = 4,
    maxLines?: number, // <-- Ajout du paramètre optionnel
  ): void {
    if (!text) return;
    let lines = pdf.splitTextToSize(text, maxWidthMm) as string[];
    const truncated = !!(maxLines && maxLines > 0 && lines.length > maxLines);

    // Si une limite de lignes est définie, on coupe le tableau
    if (maxLines && maxLines > 0) {
      lines = lines.slice(0, maxLines);
      if (truncated && lines.length) {
        const last = lines[lines.length - 1]!;
        lines[lines.length - 1] = last.length > 3 ? `${last.slice(0, -1)}…` : `${last}…`;
      }
    }

    let currentY = pxToMmY(yPx);
    lines.forEach((line: string) => {
      pdf.text(line, pxToMmX(xPx), currentY);
      currentY += lineHeightMm;
    });
  }

  // =========================================================================
  // HELPERS CERCLES
  // =========================================================================

  drawFilledCircle(pdf: jsPDF, xPx: number, yPx: number, radiusMm: number = 2.1): void {
    pdf.setFillColor('#2c1810');
    pdf.circle(pxToMmX(xPx), pxToMmY(yPx), radiusMm, 'F');
  }

  drawEmptyCircle(pdf: jsPDF, xPx: number, yPx: number, radiusMm: number = 0): void {
    pdf.setDrawColor('#2c1810');
    pdf.setLineWidth(0.3);
    pdf.circle(pxToMmX(xPx), pxToMmY(yPx), radiusMm, 'S');
  }

  drawProfCircle(pdf: jsPDF, isProficient: boolean, xPx: number, yPx: number): void {
    if (isProficient) {
      this.drawFilledCircle(pdf, xPx, yPx);
    } else {
      this.drawEmptyCircle(pdf, xPx, yPx);
    }
  }

  // =========================================================================
  // HELPERS FORMAT
  // =========================================================================

  formatBonus(value: number): string {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  shortenDamageType(dt: string): string {
    const map: Record<string, string> = {
      tranchant: 'tr.',
      perforant: 'perf.',
      contondant: 'cont.',
      feu: 'feu',
      froid: 'froid',
      foudre: 'foudr.',
      acide: 'acide',
      poison: 'pois.',
      nécrotique: 'nécr.',
      radiant: 'rad.',
      psychique: 'psy.',
      force: 'force',
    };
    return map[dt.toLowerCase()] || dt;
  }

  /**
   * Nettoie un ID technique pour affichage lisible.
   * Délègue au dictionnaire central (game-id-labels).
   */
  prettify(id: string): string {
    return labelForGameId(id);
  }
}
