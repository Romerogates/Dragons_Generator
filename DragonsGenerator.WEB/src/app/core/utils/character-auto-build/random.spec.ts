import {
  pickRandomSubset,
  buildAutoSpeciesSelection,
  buildAutoCivilizationSelection,
  buildAutoBackgroundSelection,
  primaryAbilityKeys,
  buildStandardAbilityScores,
  buildAutoClassSelection,
  autoPickClassSkills,
  autoResolveClassProficiencies,
  resolveBgToolToConcrete,
  buildBackgroundToolSlots,
  buildAutoEquipment,
  buildAutoSpellcastingDetails,
  pickBonusLanguages,
  normalizeEquipmentCatalog,
  createSkillMapFromList,
  pickPlayableSpecies,
  pickPresetBackgrounds,
  CLASS_SPELLCASTING,
} from '../character-auto-build.util';
import {
  makeGuerrierCls,
  makeMagicienCls,
  makePretreLikeCls,
  makeElfSpecies,
  makeDrakeideLikeSpecies,
  makeCivilisation,
  makeErudBackground,
  SKILLS,
  TOOL_CATALOG,
} from './spec-helpers';
import type { CharacterClass, Species, Spell, Language, EquipmentCatalogItem } from './spec-helpers';

describe('character-auto-build random', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('pickRandomSubset', () => {
    it('returns an empty array for count 0', () => {
      expect(pickRandomSubset([1, 2, 3], 0)).toEqual([]);
    });

    it('caps the picked count at the pool length', () => {
      const picked = pickRandomSubset(['a', 'b'], 5);
      expect(picked.length).toBe(2);
      expect(picked.sort()).toEqual(['a', 'b']);
    });

    it('returns an empty array for an empty pool', () => {
      expect(pickRandomSubset([], 3)).toEqual([]);
    });

    it('never returns duplicates', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const picked = pickRandomSubset(['a', 'b', 'c'], 3);
      expect(picked).toEqual(['a', 'b', 'c']);
    });
  });
});
