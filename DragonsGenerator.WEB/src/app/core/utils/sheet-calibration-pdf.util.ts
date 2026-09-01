import type { jsPDF } from 'jspdf';
import type { SheetCalibrationAnchor } from '@core/config/sheet-calibration.config';
import { PDF_SHEET_SIZE } from '@core/config/sheet-calibration.config';

const SCALE_X = 210 / PDF_SHEET_SIZE.width;
const SCALE_Y = 297 / PDF_SHEET_SIZE.height;

function pxToMmX(px: number): number {
  return px * SCALE_X;
}
function pxToMmY(px: number): number {
  return px * SCALE_Y;
}

/** Aperçu PDF : texte d'échantillon aux positions calibrées. */
export function drawSheetCalibrationPreview(pdf: jsPDF, anchors: SheetCalibrationAnchor[]): void {
  pdf.setTextColor('#2c1810');
  for (const anchor of anchors) {
    if (!anchor.sampleText.trim()) continue;
    pdf.setFontSize(anchor.fontSize);
    pdf.text(anchor.sampleText, pxToMmX(anchor.x), pxToMmY(anchor.y));
  }
}
