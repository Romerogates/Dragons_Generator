import {
  magicBadgeClasses,
  magicCardClasses,
  magicCheckboxClasses,
  magicTextClasses,
} from './magic-step-theme.util';

describe('magic-step-theme.util', () => {
  it('classes non sélectionnées vs école', () => {
    expect(magicCardClasses('evocation', false)).toContain('border-slate-800');
    expect(magicCardClasses('evocation', true)).toContain('border-red-500');
    expect(magicTextClasses('illusion', true)).toContain('purple');
    expect(magicBadgeClasses('abjuration')).toContain('cyan');
    expect(magicCheckboxClasses('transmutation', true)).toContain('orange');
    expect(magicCheckboxClasses('inconnu', false)).toContain('border-slate-700');
  });
});
