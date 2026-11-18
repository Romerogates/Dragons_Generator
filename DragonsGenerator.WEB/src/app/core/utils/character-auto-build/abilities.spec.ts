import { testClass } from '@testing/typed-fixtures';
import { normalizeCharacterClass } from '@core/utils/class-data.adapter';
import {
  primaryAbilityKeys,
  buildStandardAbilityScores,
  CLASS_SPELLCASTING,
} from '../character-auto-build.util';
import { makeGuerrierCls, makeMagicienCls } from './spec-helpers';
import type { CharacterClass } from './spec-helpers';

describe('character-auto-build abilities', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('primaryAbilityKeys', () => {
    it('resolves the primary key from a non-caster class', () => {
      expect(primaryAbilityKeys(makeGuerrierCls())).toEqual(['force']);
    });

    it('dedupes the spellcasting ability against the declared primary ability', () => {
      expect(primaryAbilityKeys(makeMagicienCls())).toEqual(['intelligence']);
    });

    it('falls back to force/dexterite when nothing is declared', () => {
      const cls: CharacterClass = testClass({
        id: 'cls-test-inconnu',
        name: 'Inconnu',
        data: { primary_abilities: [] },
      });
      expect(primaryAbilityKeys(cls)).toEqual(['force', 'dexterite']);
    });

    it('does not resolve a spellcasting ability before the class unlocks it (Rôdeur niv. 1)', () => {
      const cls: CharacterClass = testClass({
        id: 'cls-rodeur',
        name: 'Rôdeur',
        data: { primary_abilities: ['Sagesse'] },
      });
      expect(primaryAbilityKeys(cls)).toEqual(['sagesse']);
    });
  });
describe('buildStandardAbilityScores', () => {
    it('assigns the standard array in priority order for a single primary key', () => {
      expect(buildStandardAbilityScores(['force'])).toEqual({
        force: 15,
        dexterite: 13,
        constitution: 14,
        intelligence: 12,
        sagesse: 10,
        charisme: 8,
      });
    });

    it('assigns the standard array for two primary keys without duplicating slots', () => {
      expect(buildStandardAbilityScores(['intelligence', 'constitution'])).toEqual({
        force: 12,
        dexterite: 13,
        constitution: 14,
        intelligence: 15,
        sagesse: 10,
        charisme: 8,
      });
    });
  });
  describe('cas limites (ex-branches)', () => {
    it('buildStandardAbilityScores assigns leftover array values to untouched abilities', () => {
        expect(buildStandardAbilityScores(['force', 'dexterite', 'constitution', 'intelligence'])).toEqual({
          force: 15,
          dexterite: 14,
          constitution: 13,
          intelligence: 12,
          sagesse: 10,
          charisme: 8,
        });
      });
    it('primaryAbilityKeys ignores unmapped ability labels', () => {
        const cls: CharacterClass = normalizeCharacterClass({
          id: 'cls-weird-ability',
          name: 'Weird',
          data: {
            hit_die: 8,
            primary_abilities: ['UnknownStat', 'Force'],
            proficiencies: {},
            starting_equipment: [],
          },
        });
        expect(primaryAbilityKeys(cls)).toEqual(['force']);
      });
  });

});
