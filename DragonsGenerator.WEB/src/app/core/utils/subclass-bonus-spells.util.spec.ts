import { extractSubclassBonusSpells } from './subclass-bonus-spells.util';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';

describe('subclass-bonus-spells.util', () => {
  const cls = {
    id: 'cls-paladin',
    name: 'Paladin',
    data: {
      subclasses: {
        options: [
          {
            id: 'subcls-serment-de-devotion',
            bonus_spells_granted: [
              { level_unlocked: 3, spells: ['spl-a', 'spl-b'] },
              { level_unlocked: 5, spells: ['spl-c'] },
              { level_unlocked: 9, spells: ['spl-d'] },
              { level_unlocked: 13, spells: [] },
            ],
          },
        ],
      },
    },
  } as unknown as CharacterClass;

  it('returns empty when subclass or level is insufficient', () => {
    expect(extractSubclassBonusSpells(null, 'subcls-serment-de-devotion', 5)).toEqual([]);
    expect(extractSubclassBonusSpells(cls, null, 5)).toEqual([]);
    expect(extractSubclassBonusSpells(cls, 'subcls-serment-de-devotion', 0)).toEqual([]);
    expect(extractSubclassBonusSpells(cls, 'subcls-inconnu', 5)).toEqual([]);
    expect(extractSubclassBonusSpells(cls, 'subcls-serment-de-devotion', 2)).toEqual([]);
  });

  it('gates grants by character level and resolves names', () => {
    const names = { 'spl-a': 'Protection', 'spl-b': 'Sanctuaire', 'spl-c': 'Zone' };
    const out = extractSubclassBonusSpells(cls, 'subcls-serment-de-devotion', 5, names);
    expect(out).toEqual([
      { characterLevel: 3, spells: ['Protection', 'Sanctuaire'] },
      { characterLevel: 5, spells: ['Zone'] },
    ]);
  });

  it('supports array subclasses and Map name resolution', () => {
    const arrayCls = {
      id: 'cls-x',
      name: 'X',
      data: {
        subclasses: [
          {
            id: 'sub-a',
            bonus_spells_granted: [{ level_unlocked: 3, spells: ['spl-z'] }],
          },
        ],
      },
    } as unknown as CharacterClass;
    const map = new Map([['spl-z', 'Zénith']]);
    expect(extractSubclassBonusSpells(arrayCls, 'sub-a', 3, map)).toEqual([
      { characterLevel: 3, spells: ['Zénith'] },
    ]);
    expect(extractSubclassBonusSpells(arrayCls, 'sub-a', 3)).toEqual([
      { characterLevel: 3, spells: ['spl-z'] },
    ]);
  });
});
