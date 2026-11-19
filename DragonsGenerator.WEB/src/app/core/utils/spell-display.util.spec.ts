import { spellCastTimeLabel, spellSchoolLabel } from './spell-display.util';

describe('spell-display.util', () => {
  it('maps conjuration and invocation to Invocation', () => {
    expect(spellSchoolLabel('conjuration')).toBe('Invocation');
    expect(spellSchoolLabel('invocation')).toBe('Invocation');
    expect(spellSchoolLabel('evocation')).toBe('Évocation');
  });

  it('labels action_bonus as French action bonus', () => {
    expect(spellCastTimeLabel({ castingTime: { amount: 1, unit: 'action_bonus' } })).toBe(
      '1 action bonus',
    );
  });
});
