import { GRP_COORDS, PAGE2, sheetPxToMmX, sheetPxToMmY } from './character-sheet-pdf-coords.config';

describe('character-sheet-pdf-coords.config', () => {
  it('convertit les pixels fiche vers mm A4', () => {
    expect(sheetPxToMmX(595)).toBeCloseTo(210, 5);
    expect(sheetPxToMmY(842)).toBeCloseTo(297, 5);
  });

  it('expose les grilles page 2 et grimoire martial', () => {
    expect(PAGE2.spellSlotMaxPerRow.length).toBe(9);
    expect(GRP_COORDS.paladinOathSpellsYs.length).toBe(5);
  });
});
