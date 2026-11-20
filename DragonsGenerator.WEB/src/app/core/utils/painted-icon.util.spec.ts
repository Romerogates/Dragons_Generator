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
    expect(resolvePaintedIcon('fluent-emoji:drow')).toBe('/assets/equipment/ui-drow.png');
    expect(resolvePaintedIcon('fluent-emoji:ikhworg')).toBe('/assets/equipment/ui-ikhworg.png');
    expect(resolvePaintedIcon('fluent-emoji:tarasque')).toBe('/assets/equipment/ui-tarasque.png');
    expect(resolvePaintedIcon('fluent-emoji:pomoshch')).toBe('/assets/equipment/ui-pomoshch.png');
    expect(resolvePaintedIcon('fluent-emoji:schatz')).toBe('/assets/equipment/ui-schatz.png');
    expect(resolvePaintedIcon('fluent-emoji:camel')).toBe('/assets/equipment/mnt-camel.png');
    expect(resolvePaintedIcon('fluent-emoji:eagle')).toBe('/assets/equipment/ui-eagle.png');
    expect(resolvePaintedIcon('fluent-emoji:falcon')).toBe('/assets/equipment/ui-falcon.png');
    expect(resolvePaintedIcon('fluent-emoji:bantu')).toBe('/assets/equipment/ui-bantu.png');
    expect(resolvePaintedIcon('fluent-emoji:flesh-golem')).toBe(
      '/assets/equipment/ui-fleshgolem.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:guard')).toBe('/assets/equipment/ui-guard.png');
    expect(resolvePaintedIcon('fluent-emoji:fanatic')).toBe('/assets/equipment/ui-fanatic.png');
    expect(resolvePaintedIcon('fluent-emoji:lion')).toBe('/assets/equipment/ui-lion.png');
    expect(resolvePaintedIcon('fluent-emoji:askinos')).toBe('/assets/equipment/ui-askinos.png');
    expect(resolvePaintedIcon('fluent-emoji:gadai')).toBe('/assets/equipment/ui-gadai.png');
    expect(resolvePaintedIcon('fluent-emoji:clay-golem')).toBe(
      '/assets/equipment/ui-claygolem.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:werewolf')).toBe('/assets/equipment/ui-werewolf.png');
    expect(resolvePaintedIcon('fluent-emoji:lich')).toBe('/assets/equipment/ui-lich.png');
    expect(resolvePaintedIcon('fluent-emoji:sunsutaa')).toBe('/assets/equipment/ui-sunsutaa.png');
    expect(resolvePaintedIcon('fluent-emoji:wraith')).toBe('/assets/equipment/ui-wraith.png');
    expect(resolvePaintedIcon('fluent-emoji:ogre-zombie')).toBe(
      '/assets/equipment/ui-ogrezombie.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:kobold')).toBe('/assets/equipment/ui-kobold.png');
    expect(resolvePaintedIcon('fluent-emoji:bugbear')).toBe('/assets/equipment/ui-bugbear.png');
    expect(resolvePaintedIcon('fluent-emoji:wererat')).toBe('/assets/equipment/ui-wererat.png');
    expect(resolvePaintedIcon('fluent-emoji:elk')).toBe('/assets/equipment/ui-elk.png');
    expect(resolvePaintedIcon('fluent-emoji:pony')).toBe('/assets/equipment/ui-pony.png');
    expect(resolvePaintedIcon('fluent-emoji:synthia')).toBe('/assets/equipment/ui-synthia.png');
    expect(resolvePaintedIcon('fluent-emoji:frost-giant')).toBe(
      '/assets/equipment/ui-frostgiant.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:orc')).toBe('/assets/equipment/ui-orc.png');
    expect(resolvePaintedIcon('fluent-emoji:thug')).toBe('/assets/equipment/ui-thug.png');
    expect(resolvePaintedIcon('fluent-emoji:crime-baron')).toBe(
      '/assets/equipment/ui-crimebaron.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:skeleton-minotaur')).toBe(
      '/assets/equipment/ui-skeletonminotaur.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:ghoul')).toBe('/assets/equipment/ui-ghoul.png');
    expect(resolvePaintedIcon('fluent-emoji:bird')).toBe('/assets/equipment/ui-eagle.png');
    expect(resolvePaintedIcon('fluent-emoji:owl')).toBe('/assets/equipment/ui-owl.png');
    expect(resolvePaintedIcon('fluent-emoji:raven')).toBe('/assets/equipment/ui-raven.png');
    expect(resolvePaintedIcon('fluent-emoji:griffon')).toBe('/assets/equipment/ui-griffon.png');
    expect(resolvePaintedIcon('fluent-emoji:knight')).toBe('/assets/equipment/ui-knight.png');
    expect(resolvePaintedIcon('fluent-emoji:ochre-jelly')).toBe(
      '/assets/equipment/ui-ochrejelly.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:honeybee')).not.toBe('/assets/equipment/ui-dragon.png');
    expect(resolvePaintedIcon('fluent-emoji:spider')).toBe('/assets/equipment/ui-spider.png');
    expect(resolvePaintedIcon('fluent-emoji:deciduous-tree')).toBe('/assets/equipment/ui-tree.png');
    expect(resolvePaintedIcon('fluent-emoji:man-mage')).toBe('/assets/equipment/ui-wizard.png');
    expect(resolvePaintedIcon('fluent-emoji:druid')).toBe('/assets/equipment/ui-druid.png');
    expect(resolvePaintedIcon('fluent-emoji:evergreen-tree')).toBe(
      '/assets/equipment/ui-nature.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:medusa')).toBe('/assets/equipment/ui-medusa.png');
    expect(resolvePaintedIcon('fluent-emoji:giant')).toBe('/assets/equipment/ui-giant.png');
    expect(resolvePaintedIcon('fluent-emoji:ninja')).toBe('/assets/equipment/ui-assassin.png');
    expect(resolvePaintedIcon('fluent-emoji:angry-face')).toBe('/assets/equipment/ui-bandit.png');
    expect(resolvePaintedIcon('fluent-emoji:gladiator')).toBe(
      '/assets/equipment/ui-gladiator.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:living-chain')).toBe(
      '/assets/equipment/ui-livingchain.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:azer')).toBe('/assets/equipment/ui-azer.png');
    expect(resolvePaintedIcon('fluent-emoji:flying-carpet')).toBe(
      '/assets/equipment/ui-carpet.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:haunted-house')).toBe(
      '/assets/equipment/ui-hauntedhouse.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:commoner')).toBe(
      '/assets/equipment/ui-commoner.png',
    );
    expect(resolvePaintedIcon('fluent-emoji:locust')).toBe('/assets/equipment/ui-locust.png');
    expect(resolvePaintedIcon('fluent-emoji:paladin')).toBe('/assets/equipment/ui-paladin.png');
    expect(resolvePaintedIcon('fluent-emoji:herb')).toBe('/assets/equipment/adv-hay.png');
    expect(resolvePaintedIcon('fluent-emoji:ranger')).toBe('/assets/equipment/ui-ranger.png');
    expect(resolvePaintedIcon('fluent-emoji:man-elf')).toBe('/assets/equipment/ui-elf.png');
    expect(resolvePaintedIcon('fluent-emoji:dwarf')).toBe('/assets/equipment/ui-dwarf.png');
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
