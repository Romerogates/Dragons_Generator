import { spellSchoolLabel } from './spell-display.util';

describe('spell-display.util', () => {
  it('maps conjuration and invocation to Invocation', () => {
    expect(spellSchoolLabel('conjuration')).toBe('Invocation');
    expect(spellSchoolLabel('invocation')).toBe('Invocation');
    expect(spellSchoolLabel('evocation')).toBe('Évocation');
  });
});
