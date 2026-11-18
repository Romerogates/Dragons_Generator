import { testClass } from '@testing/typed-fixtures';
import {
  deleteCustomBackgroundTemplate,
  listCustomBackgroundTemplates,
  saveCustomBackgroundTemplate,
} from '../custom-background-templates.util';
import { extractJoinTokenFromUrl, parseChatBodySegments } from '../chat-body-links.util';
import {
  parseDamageDice,
  resolveAttackRoll,
  rollDamageTotal,
  rollDie,
} from '../combat-roll.util';
import { extractSubclassBonusSpells } from '../subclass-bonus-spells.util';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { STORAGE_KEY } from './helpers';

describe('custom-background-templates', () => {
    beforeEach(() => localStorage.removeItem(STORAGE_KEY));

    it('list returns [] for missing, non-array or corrupt JSON', () => {
      expect(listCustomBackgroundTemplates()).toEqual([]);
      localStorage.setItem(STORAGE_KEY, '{"not":"array"}');
      expect(listCustomBackgroundTemplates()).toEqual([]);
      localStorage.setItem(STORAGE_KEY, '{');
      expect(listCustomBackgroundTemplates()).toEqual([]);
    });

    it('save defaults empty name and delete filters by id', () => {
      const draft = {
        name: '  ',
        privilegeName: 'P',
        privilegeDesc: 'D',
        gold: 10,
        trait: 't',
        ideal: 'i',
        bond: 'b',
        flaw: 'f',
      };
      const saved = saveCustomBackgroundTemplate(draft);
      expect(saved[0]?.name).toBe('Historique personnalisé');
      saveCustomBackgroundTemplate({ ...draft, name: 'Aventureux' });
      const after = deleteCustomBackgroundTemplate(saved[0]!.id);
      expect(after.every((t) => t.id !== saved[0]!.id)).toBeTrue();
    });
  });

  describe('chat-body-links', () => {
    it('covers empty body, non-join URL punctuation and no-match path', () => {
      expect(parseChatBodySegments('')).toEqual([]);
      expect(extractJoinTokenFromUrl('https://example.com/x')).toBeNull();
      const segs = parseChatBodySegments('voir https://example.com/page).');
      expect(segs.some((s) => s.type === 'url')).toBeTrue();
      expect(segs.some((s) => s.type === 'text' && s.value.includes(')'))).toBeTrue();
      expect(parseChatBodySegments('texte seul sans lien')).toEqual([
        { type: 'text', value: 'texte seul sans lien' },
      ]);
    });
  });

  describe('combat-roll', () => {
    it('covers empty/invalid dice and NaN AC', () => {
      expect(parseDamageDice(null)).toBeNull();
      expect(parseDamageDice('')).toBeNull();
      expect(parseDamageDice('abc')).toBeNull();
      expect(rollDamageTotal(null)).toBeNull();
      expect(rollDie(0)).toBe(1);
      expect(resolveAttackRoll(10, 2, Number.NaN).hit).toBeNull();
      expect(resolveAttackRoll(10, 2).hit).toBeNull();
    });
  });

  describe('subclass-bonus-spells', () => {
    it('covers empty options bag, missing names and level_unlocked defaults', () => {
      const cls = testClass({
        id: 'cls-x',
        name: 'X',
        data: { subclasses: {} },
      });
      expect(extractSubclassBonusSpells(cls, 'sub', 5)).toEqual([]);

      const withGrant = testClass({
        id: 'cls-y',
        name: 'Y',
        data: {
          subclasses: {
            options: [
              {
                id: 'sub-a',
                bonus_spells_granted: [
                  { level_unlocked: 0, spells: ['spl-a'] },
                  { level_unlocked: 3, spells: undefined },
                ],
              },
            ],
          },
        },
      });
      const map = new Map<string, string>();
      expect(extractSubclassBonusSpells(withGrant, 'sub-a', 5, map)).toEqual([
        { characterLevel: 0, spells: ['spl-a'] },
      ]);
      expect(extractSubclassBonusSpells(withGrant, 'sub-a', 5, { 'spl-b': 'B' })).toEqual([
        { characterLevel: 0, spells: ['spl-a'] },
      ]);
      expect(
        extractSubclassBonusSpells(
          testClass({
            id: 'cls-z',
            name: 'Z',
            data: {
              subclasses: {
                options: [
                  {
                    id: 'sub-z',
                    bonus_spells_granted: [{ spells: ['spl-late'] }],
                  },
                ],
              },
            },
          }),
          'sub-z',
          99,
        ),
      ).toEqual([{ characterLevel: 0, spells: ['spl-late'] }]);
    });
  });
