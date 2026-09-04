import { resistanceLabel } from './equipment-display.util';

describe('resistanceLabel', () => {
  it('strips the damage- prefix and capitalizes the French label', () => {
    expect(resistanceLabel('damage-feu')).toBe('Feu');
    expect(resistanceLabel('damage-tonnerre')).toBe('Tonnerre');
    expect(resistanceLabel('damage-contondant')).toBe('Contondant');
  });

  it('falls back to the raw id when unknown', () => {
    expect(resistanceLabel('mystere')).toBe('Mystere');
  });

  it('returns falsy input unchanged', () => {
    expect(resistanceLabel('')).toBe('');
  });
});
