import {
  GRIMOIRE_BASE_COORDS,
  GRIMOIRE_PANEL_CLERIC,
  listGrimoireCalibrationPoints,
} from './grimoire-coords.config';

describe('grimoire-coords.config', () => {
  it('exposes 15 spell table rows (3 bands × 5 lines)', () => {
    expect(GRIMOIRE_BASE_COORDS.spellTableMaxRows).toBe(15);
  });

  it('lists cleric calibration anchors including panel and medallions', () => {
    const points = listGrimoireCalibrationPoints('cleric');
    expect(points.some((p) => p.id === 'deity')).toBeTrue();
    expect(points.some((p) => p.id === 'focus')).toBeTrue();
    expect(points.some((p) => p.id === 'level-0')).toBeTrue();
    expect(GRIMOIRE_PANEL_CLERIC.line2Y).toBe(296);
  });

  it('defaults to cleric kind', () => {
    expect(listGrimoireCalibrationPoints().some((p) => p.id === 'deity')).toBeTrue();
  });

  it('omits cleric panel anchors for other kinds', () => {
    const points = listGrimoireCalibrationPoints('wizard');
    expect(points.some((p) => p.id === 'deity')).toBeFalse();
    expect(points.some((p) => p.id === 'name')).toBeTrue();
  });
});
