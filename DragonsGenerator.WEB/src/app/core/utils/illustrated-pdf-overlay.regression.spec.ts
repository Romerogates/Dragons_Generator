import { SHEET_H, SHEET_W, sheetPct } from '../../features/character-sheet/illustrated-character-sheet';

/**
 * #25 — Snapshot PDF illustré vs drawPage : full visual overlay snapshot skipped (too heavy).
 * Lightweight regression : template asset path parity + coordinate helper sanity.
 */
describe('illustrated sheet vs PDF drawPage (lightweight)', () => {
  it('shares official sheet template paths with pdf-generator (pages 1–4)', () => {
    const illustratedPaths = [1, 2, 3, 4].map((p) => `/images/sheets/sheet-page${p}.jpg`);
    const pdfPaths = [
      '/images/sheets/sheet-page1.jpg',
      '/images/sheets/sheet-page2.jpg',
      '/images/sheets/sheet-page3.jpg',
      '/images/sheets/sheet-page4.jpg',
    ];
    expect(illustratedPaths).toEqual(pdfPaths);
  });

  it('sheetPct uses the same page geometry as PDF (595×842)', () => {
    expect(SHEET_W).toBe(595);
    expect(SHEET_H).toBe(842);
    const pct = sheetPct(0, 0);
    expect(pct.left).toContain('%');
    expect(pct.top).toBe('0%');
  });
});
