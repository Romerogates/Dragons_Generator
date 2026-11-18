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

describe('character-auto-build civilization', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('buildAutoCivilizationSelection', () => {
    it('maps official languages and writing systems', () => {
      const sel = buildAutoCivilizationSelection(makeCivilisation());
      expect(sel).toEqual({
        civilizationId: 'civ-ajagar',
        civilizationName: 'Ajagar',
        languages: ['Commun'],
        writingSystems: ['Runique'],
      });
    });
  });
});
