import { PAINTED_ICON_GROUPS, resolvePaintedIcon } from './painted-icon.util';

describe('resolvePaintedIcon', () => {
  it('keeps asset paths', () => {
    expect(resolvePaintedIcon('/assets/equipment/dagger.png')).toBe('/assets/equipment/dagger.png');
  });

  it('maps Codex smileys to painted portraits', () => {
    expect(resolvePaintedIcon('fluent-emoji:dragon')).toBe('/assets/equipment/ui-dragon.png');
    expect(resolvePaintedIcon('fluent-emoji:dragon-silver')).toBe(
      '/assets/equipment/ui-dragon-silver.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:dragon-white')).toBe(
      '/assets/equipment/ui-dragon-white.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:dragon-copper')).toBe(
      '/assets/equipment/ui-dragon-copper.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:dragon-agate')).toBe(
      '/assets/equipment/ui-dragon-agate.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:camel')).toBe('/assets/equipment/mnt-camel.png');
    expect(resolvePaintedIcon('fluent-emoji:eagle')).toBe('/assets/equipment/ui-eagle.png');
    expect(resolvePaintedIcon('fluent-emoji:bird')).toBe('/assets/equipment/ui-eagle.png');
    expect(resolvePaintedIcon('fluent-emoji:honeybee')).not.toBe('/assets/equipment/ui-dragon.png');
    expect(resolvePaintedIcon('fluent-emoji:spider')).toBe('/assets/equipment/ui-spider.png');
    expect(resolvePaintedIcon('fluent-emoji:deciduous-tree')).toBe('/assets/equipment/ui-tree.png');
    expect(resolvePaintedIcon('fluent-emoji:man-mage')).toBe('/assets/equipment/ui-mage.png');
    expect(resolvePaintedIcon('fluent-emoji:herb')).toBe('/assets/equipment/adv-hay.png');
    expect(resolvePaintedIcon('fluent-emoji:sparkles')).toBe('/assets/equipment/ui-sparkles.png');
    expect(resolvePaintedIcon('fluent-emoji:crossed-swords')).toBe(
      '/assets/equipment/ui-warrior.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:bear')).toBe('/assets/equipment/ui-bear.png');
    expect(resolvePaintedIcon('fluent-emoji:man-vampire')).toBe('/assets/equipment/ui-vampire.png');
    expect(resolvePaintedIcon('fluent-emoji:robot')).toBe('/assets/equipment/ui-golem.png');
    expect(resolvePaintedIcon('fluent-emoji:ogre')).toBe('/assets/equipment/ui-ogre.png');
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
