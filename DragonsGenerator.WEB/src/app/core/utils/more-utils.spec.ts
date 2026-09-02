import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { labelForGameId, labelForItemRef, registerGameLabel } from './game-id-labels';
import { getEanaMapCoordinates, EANA_MAP_COORDS } from './eana-map';
import { countAsiSlots, warlockArcanumSpellLevels } from './progression-choices.util';

describe('eana-map', () => {
  it('returns calibrated coords or center fallback', () => {
    expect(EANA_MAP_COORDS['civ-ajagar']).toEqual({ x: 78.6, y: 62.3 });
    expect(getEanaMapCoordinates('civ-unknown')).toEqual({ x: 50, y: 50 });
  });
});

describe('game-id-labels extras', () => {
  it('labelForItemRef formats quantity', () => {
    expect(labelForItemRef({ id: 'wp-dague', qty: 2 })).toMatch(/2/);
    registerGameLabel('custom-id', 'Custom');
    expect(labelForGameId('custom-id')).toBe('Custom');
  });
});

describe('progression-choices.util', () => {
  it('counts ASI slots from progression features', () => {
    const cls = {
      id: 'cls-test',
      name: 'Test',
      data: {
        progression: [
          { level: 4, features: ['feat-augmentation-de-caracteristique'] },
          { level: 8, features: ['feat-augmentation-de-caracteristique'] },
        ],
      },
    } as unknown as CharacterClass;
    expect(countAsiSlots(cls, 8)).toBe(2);
    expect(countAsiSlots(cls, 3)).toBe(0);
  });

  it('warlock arcanum levels by character level', () => {
    expect(warlockArcanumSpellLevels(10)).toEqual([]);
    expect(warlockArcanumSpellLevels(17)).toEqual([6, 7, 8, 9]);
  });
});
