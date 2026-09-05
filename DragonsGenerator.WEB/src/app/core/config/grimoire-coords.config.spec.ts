import {
  GRIMOIRE_BASE_COORDS,
  GRIMOIRE_PANEL_CLERIC,
  GRIMOIRE_SPELL_TABLE_LEVEL,
  GRIMOIRE_SUPP_COORDS,
} from './grimoire-coords.config';

describe('grimoire-coords.config', () => {
  it('exposes 15 spell table rows (3 bands × 5 lines)', () => {
    expect(GRIMOIRE_BASE_COORDS.spellTableMaxRows).toBe(15);
  });

  it('exposes calibrated cleric panel and medallion coords', () => {
    expect(GRIMOIRE_PANEL_CLERIC.line2Y).toBe(307);
    expect(GRIMOIRE_SPELL_TABLE_LEVEL.levelX).toBe(44);
    expect(GRIMOIRE_BASE_COORDS.colPrepared).toBe(80);
  });

  it('exposes supp page coords (6 bands × 5 = 30 rows)', () => {
    expect(GRIMOIRE_SUPP_COORDS.maxRows).toBe(30);
    expect(GRIMOIRE_SUPP_COORDS.levelYs.length).toBe(6);
  });
});
