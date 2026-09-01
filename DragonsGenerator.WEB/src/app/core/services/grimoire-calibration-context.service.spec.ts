import { GrimoireCalibrationContext } from './grimoire-calibration-context.service';
import {
  GRIMOIRE_BASE_COORDS,
  GRIMOIRE_PANEL_CLERIC,
  GRIMOIRE_SPELL_TABLE_LEVEL,
} from '@core/config/grimoire-coords.config';

describe('GrimoireCalibrationContext', () => {
  it('returns defaults when no override', () => {
    const ctx = new GrimoireCalibrationContext();
    expect(ctx.getBaseCoords()).toEqual(GRIMOIRE_BASE_COORDS);
    expect(ctx.getSpellTableLevel()).toEqual(GRIMOIRE_SPELL_TABLE_LEVEL);
    expect(ctx.getPanelCleric()).toEqual(GRIMOIRE_PANEL_CLERIC);
  });

  it('returns override while set', () => {
    const ctx = new GrimoireCalibrationContext();
    const custom = {
      base: { ...GRIMOIRE_BASE_COORDS, nameX: 1 },
      spellTableLevel: GRIMOIRE_SPELL_TABLE_LEVEL,
      panelCleric: GRIMOIRE_PANEL_CLERIC,
    };
    ctx.setOverride(custom);
    expect(ctx.getBaseCoords().nameX).toBe(1);
    ctx.setOverride(null);
    expect(ctx.getBaseCoords().nameX).toBe(GRIMOIRE_BASE_COORDS.nameX);
  });
});
