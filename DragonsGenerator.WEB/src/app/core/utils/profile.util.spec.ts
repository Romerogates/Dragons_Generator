import {
  accentGradient,
  accentMessageClass,
  accentRing,
  profileInitial,
} from './profile.util';

describe('profile.util', () => {
  it('resolve les accents connus et le repli violet', () => {
    expect(accentGradient('amber')).toContain('amber');
    expect(accentGradient(null)).toContain('violet');
    expect(accentRing('sky')).toContain('sky');
    expect(accentRing('inconnu')).toContain('violet');
    expect(profileInitial('  ada  ')).toBe('A');
    expect(profileInitial('   ')).toBe('?');
    expect(accentMessageClass('amber')).toContain('amber');
    expect(accentMessageClass('emerald')).toContain('emerald');
    expect(accentMessageClass('sky')).toContain('sky');
    expect(accentMessageClass('rose')).toContain('rose');
    expect(accentMessageClass('fuchsia')).toContain('fuchsia');
    expect(accentMessageClass(undefined)).toContain('violet');
  });
});
