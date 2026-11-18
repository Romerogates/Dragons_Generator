import { pickBonusLanguages, normalizeEquipmentCatalog, createSkillMapFromList, pickPlayableSpecies, pickPresetBackgrounds, CLASS_SPELLCASTING } from '../character-auto-build.util';
import { makeElfSpecies, makeErudBackground, SKILLS } from './spec-helpers';
import type { Species, Language } from './spec-helpers';
describe('character-auto-build catalog', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('pickBonusLanguages', () => {
    it('excludes locked, extinct and non-base languages', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const languages: Language[] = [
        { id: 'lg-commun', name: 'Commun', category: 'base', speakers: { primary: [], regions: [] } } as unknown as Language,
        {
          id: 'lg-orc',
          name: 'Orc',
          category: 'base',
          speakers: { primary: [], regions: [], isExtinct: true },
        } as unknown as Language,
        { id: 'lg-elfique', name: 'Elfique', category: 'exotique', speakers: { primary: [], regions: [] } } as unknown as Language,
        {
          id: 'lg-ancien',
          name: 'Ancien',
          category: 'base',
          speakers: { primary: [], regions: [], isExtinct: false },
        } as unknown as Language,
      ];
      const picked = pickBonusLanguages(languages, new Set(['Commun']), 2);
      expect(picked).toEqual(['Ancien']);
    });
  });
describe('catalog helpers', () => {
    it('normalizeEquipmentCatalog normalizes raw equipment data', () => {
      const raw = [
        {
          id: 'ar-cuir',
          name: 'Cuir',
          type: 'armor',
          subtype: 'light',
          cost: { v: 10, u: 'po' },
          wKg: 5,
          data: { damage_dice: null, ac_base: 11 },
        },
      ];
      const normalized = normalizeEquipmentCatalog(raw as never);
      expect(normalized[0].type).toBe('ARMOR');
      expect(normalized[0].subtype).toBe('LIGHT');
    });

    it('createSkillMapFromList builds a lookup by normalized skill id', () => {
      const map = createSkillMapFromList(SKILLS);
      expect(map['skill-arcanes'].label).toBe('Arcanes');
      expect(map['skill-arcanes'].ability).toBe('Intelligence');
    });

    it('pickPlayableSpecies keeps species with no subspecies or at least one playable subspecies', () => {
      const noSub: Species = { ...makeElfSpecies(), id: 'sp-no-sub', subspecies: [] };
      const onlyUnplayable: Species = {
        ...makeElfSpecies(),
        id: 'sp-unplayable',
        subspecies: [{ ...makeElfSpecies().subspecies[1] }],
      };
      const result = pickPlayableSpecies([makeElfSpecies(), noSub, onlyUnplayable]);
      expect(result.map((s) => s.id)).toEqual(['sp-elfe', 'sp-no-sub']);
    });

    it('pickPresetBackgrounds excludes non-preset and the bg-custom background', () => {
      const preset = makeErudBackground();
      const custom = { ...makeErudBackground(), id: 'bg-custom' };
      const nonPreset = { ...makeErudBackground(), id: 'bg-other', data: { ...makeErudBackground().data, preset: false } };
      const noData = { ...makeErudBackground(), id: 'bg-node', data: undefined as never };
      const result = pickPresetBackgrounds([preset, custom, nonPreset, noData]);
      expect(result.map((b) => b.id)).toEqual(['bg-erudit', 'bg-node']);
    });
  });
  describe('cas limites (ex-branches)', () => {
    it('pickBonusLanguages returns empty picks for count zero', () => {
        expect(pickBonusLanguages([], new Set(), 0)).toEqual([]);
      });
  });

});
