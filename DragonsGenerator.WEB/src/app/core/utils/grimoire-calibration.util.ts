import type { jsPDF } from 'jspdf';
import type { GrimoireCalibrationPoint } from '@core/config/grimoire-coords.config';
import { GRIMOIRE_SHEET } from '@core/config/grimoire-coords.config';

const SCALE_X = 210 / GRIMOIRE_SHEET.width;
const SCALE_Y = 297 / GRIMOIRE_SHEET.height;

function pxToMmX(px: number): number {
  return px * SCALE_X;
}
function pxToMmY(px: number): number {
  return px * SCALE_Y;
}

/** Dessine croix + libellé à chaque ancre configurée (PDF debug). */
export function drawGrimoireCalibrationOverlay(
  pdf: jsPDF,
  points: GrimoireCalibrationPoint[],
): void {
  pdf.setDrawColor(220, 40, 40);
  pdf.setTextColor(200, 30, 30);
  pdf.setFontSize(6);

  for (const pt of points) {
    const x = pxToMmX(pt.x);
    const y = pxToMmY(pt.y);
    const r = 1.2;
    pdf.setLineWidth(0.25);
    pdf.line(x - r, y, x + r, y);
    pdf.line(x, y - r, x, y + r);
    pdf.circle(x, y, r, 'S');
    pdf.text(`${pt.label} (${pt.x},${pt.y})`, x + 1.5, y - 0.8);
  }
}
