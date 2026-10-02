import {
  encounterGroupFromRandomRoll,
  rollRandomEncounter,
  suggestThemeFromRegion,
  xpForChallengeRating,
} from './dungeon-theme-pools';
import type { DungeonTheme } from '@core/models/Campaign/dungeon-map';

describe('dungeon-theme-pools', () => {
  it('suggestThemeFromRegion mappe les mots-clés FR', () => {
    expect(suggestThemeFromRegion('Crypte des rois')).toBe('crypt');
    expect(suggestThemeFromRegion('Grotte humide')).toBe('cave');
    expect(suggestThemeFromRegion('')).toBe('generic');
    expect(suggestThemeFromRegion(null)).toBe('generic');
    expect(suggestThemeFromRegion(undefined)).toBe('generic');
    expect(suggestThemeFromRegion('Région inconnue')).toBe('ruins');
    expect(suggestThemeFromRegion('Temple du culte')).toBe('temple');
    expect(suggestThemeFromRegion('Égout fangeux')).toBe('sewer');
    expect(suggestThemeFromRegion('Forêt de mousse')).toBe('forest');
    expect(suggestThemeFromRegion('Ruines antiques')).toBe('ruins');
  });

  it('rollRandomEncounter renvoie au moins une créature', () => {
    const roll = rollRandomEncounter('crypt', false);
    expect(roll.creatures.length).toBeGreaterThan(0);
    expect(roll.creatures[0].quantity).toBeGreaterThan(0);
  });

  it('rollRandomEncounter boss room picks from heavy end of pool', () => {
    spyOn(Math, 'random').and.returnValue(0);
    const roll = rollRandomEncounter('crypt', true);
    expect(roll.creatures.length).toBe(1);
    expect(roll.creatures[0].quantity).toBe(1);
  });

  it('rollRandomEncounter falls back to generic for unknown theme', () => {
    spyOn(Math, 'random').and.returnValue(0);
    const roll = rollRandomEncounter('nope' as DungeonTheme, false);
    expect(roll.creatures.length).toBeGreaterThan(0);
    expect(roll.creatures[0].name).toBe('Gobelin');
  });

  it('rollRandomEncounter merges duplicate creature picks', () => {
    // count=2 (random→0.9), always first pool entry, qty=1 each time
    spyOn(Math, 'random').and.returnValues(0.9, 0, 0, 0, 0);
    const roll = rollRandomEncounter('crypt', false);
    expect(roll.creatures.length).toBe(1);
    expect(roll.creatures[0].quantity).toBeGreaterThanOrEqual(2);
  });

  it('pickWeighted falls through to last entry when roll stays positive', () => {
    spyOn(Math, 'random').and.returnValue(2);
    const roll = rollRandomEncounter('crypt', true);
    expect(roll.creatures.length).toBe(1);
  });

  it('xpForChallengeRating couvre les FP courants', () => {
    expect(xpForChallengeRating('1/4')).toBe(50);
    expect(xpForChallengeRating('1')).toBe(200);
    expect(xpForChallengeRating('inconnu')).toBe(0);
    expect(xpForChallengeRating(null)).toBe(0);
    expect(xpForChallengeRating(undefined)).toBe(0);
    expect(xpForChallengeRating('  2  ')).toBe(450);
  });

  it('encounterGroupFromRandomRoll crée un EncounterGroup lié', () => {
    const group = encounterGroupFromRandomRoll(
      { creatures: [{ name: 'Squelette', quantity: 3, cr: '1/4' }] },
      {
        roomLabel: 'Salle 2',
        mapName: 'Ossuaire',
        theme: 'crypt',
        dungeonMapId: 'map-1',
      },
    );
    expect(group.name).toContain('Salle 2');
    expect(group.dungeonMapId).toBe('map-1');
    expect(group.creatures.length).toBe(1);
    expect(group.creatures[0].creatureName).toBe('Squelette');
    expect(group.creatures[0].quantity).toBe(3);
    expect(group.creatures[0].xp).toBe(50);
    expect(group.creatures[0].creatureId).toContain('squelette');
  });

  it('encounterGroupFromRandomRoll handles empty name, missing cr, and UUID fallback', () => {
    const desc = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    try {
      Object.defineProperty(crypto, 'randomUUID', {
        configurable: true,
        value: undefined,
      });
      const group = encounterGroupFromRandomRoll(
        { creatures: [{ name: '', quantity: 0, cr: undefined as unknown as string }] },
        {
          roomLabel: 'Salle',
          mapName: 'Map',
          theme: 'bogus' as DungeonTheme,
        },
      );
      expect(group.id.startsWith('enc-')).toBe(true);
      expect(group.description).toContain('bogus');
      expect(group.creatures[0].creatureId).toBe('theme:creature');
      expect(group.creatures[0].challengeRating).toBe('');
      expect(group.creatures[0].xp).toBe(0);
      expect(group.creatures[0].quantity).toBe(1);
    } finally {
      if (desc) Object.defineProperty(crypto, 'randomUUID', desc);
    }
  });
});
