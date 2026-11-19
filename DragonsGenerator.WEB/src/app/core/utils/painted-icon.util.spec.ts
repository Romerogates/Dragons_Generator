import { PAINTED_ICON_GROUPS, resolvePaintedIcon } from './painted-icon.util';

describe('resolvePaintedIcon', () => {
  it('keeps asset paths', () => {
    expect(resolvePaintedIcon('/assets/equipment/dagger.png')).toBe('/assets/equipment/dagger.png');
  });

  it('maps Codex smileys to painted portraits', () => {
    expect(resolvePaintedIcon('fluent-emoji:dragon')).toBe('/assets/equipment/ui-dragon.png');
    expect(resolvePaintedIcon('fluent-emoji:sparkles')).toBe('/assets/equipment/ui-sparkles.png');
    expect(resolvePaintedIcon('fluent-emoji:crossed-swords')).toBe(
      '/assets/equipment/cat-weapon.png',
    );
  });

  it('never returns a fluent-emoji id', () => {
    expect(resolvePaintedIcon('fluent-emoji:red-question-mark').startsWith('/assets/')).toBeTrue();
  });

  it('falls back for empty and unknown ids', () => {
    expect(resolvePaintedIcon(null)).toBe('/assets/equipment/adv-backpack.png');
    expect(resolvePaintedIcon('')).toBe('/assets/equipment/adv-backpack.png');
    expect(resolvePaintedIcon('  ')).toBe('/assets/equipment/adv-backpack.png');
    expect(resolvePaintedIcon('mdi:cog-outline')).toBe('/assets/equipment/ui-sparkles.png');
  });

  it('matches every keyword family without substring false positives', () => {
    expect(resolvePaintedIcon('fluent-emoji:clipboard')).not.toBe('/assets/equipment/ui-wolf.png');
    for (const [keys, file] of PAINTED_ICON_GROUPS) {
      for (const key of keys) {
        expect(resolvePaintedIcon(`fluent-emoji:extra-${key}-mark`)).toBe(file);
      }
    }
  });
});
