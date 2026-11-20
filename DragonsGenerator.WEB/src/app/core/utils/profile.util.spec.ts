import {
  accentFabGradient,
  accentGradient,
  accentInitialClass,
  accentMessageClass,
  accentRing,
  accentSurfaceClass,
  PROFILE_ACCENTS,
  PROFILE_AVATAR_OPTIONS,
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

  it('offre une option sans couleur et des teintes claires', () => {
    expect(PROFILE_ACCENTS.some((a) => a.id === 'none' && a.clear)).toBeTrue();
    expect(PROFILE_ACCENTS.some((a) => a.id === 'white')).toBeTrue();
    expect(accentSurfaceClass('none')).toContain('transparent');
    expect(accentGradient('none')).toBe('');
    expect(accentInitialClass('white')).toContain('slate-900');
    expect(accentFabGradient('none')).toContain('slate');
    expect(accentFabGradient('white')).toContain('slate');
    expect(accentMessageClass('none')).toContain('slate');
  });

  it('offre les portraits du Codex comme avatars', () => {
    expect(PROFILE_AVATAR_OPTIONS.length).toBeGreaterThan(80);
    expect(PROFILE_AVATAR_OPTIONS.some((o) => o.icon === 'fluent-emoji:dragon')).toBeTrue();
    expect(PROFILE_AVATAR_OPTIONS.some((o) => o.icon === 'fluent-emoji:lich')).toBeTrue();
    expect(PROFILE_AVATAR_OPTIONS.some((o) => o.icon === 'fluent-emoji:synthia')).toBeTrue();
    const ids = PROFILE_AVATAR_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
