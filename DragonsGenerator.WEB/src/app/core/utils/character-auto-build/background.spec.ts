import { buildAutoBackgroundSelection, createSkillMapFromList, CLASS_SPELLCASTING } from '../character-auto-build.util';
import { makeErudBackground, SKILLS } from './spec-helpers';

describe('character-auto-build background', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('buildAutoBackgroundSelection', () => {
    it('throws for a non-preset (custom) background', () => {
      const bg = makeErudBackground();
      (bg.data as { preset: boolean }).preset = false;
      expect(() => buildAutoBackgroundSelection(bg, createSkillMapFromList(SKILLS))).toThrowError();
    });

    it('resolves skills/tools/equipment/personality for a preset background', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const skillMap = createSkillMapFromList(SKILLS);
      const sel = buildAutoBackgroundSelection(makeErudBackground(), skillMap);

      expect(sel.skills).toEqual(['skill-arcanes', 'skill-histoire']);
      expect(sel.tools).toEqual(['instrument-any', 'vehicle-any']);
      expect(sel.equipment.length).toBe(1);
      expect(sel.equipment[0].refId).toBe('it-bouteille-encre');
      expect(sel.equipmentSlots.length).toBe(1);
      expect(sel.equipmentSlots[0].alternatives).toEqual([
        [{ id: 'gr-livre', qty: 1 }],
        [{ id: 'gr-loupe', qty: 1 }],
      ]);
      expect(sel.currency).toEqual({ cuivre: 0, argent: 0, or: 10, platine: 0 });
      expect(sel.privilegeId).toBe('priv-chercheur');
      expect(sel.traits).toBe('Je cite des philosophes.');
      expect(sel.ideal).toBe('Savoir');
      expect(sel.bonds).toBe('Ma bibliothèque.');
      expect(sel.flaws).toBe("Je m'égare dans mes recherches.");
      expect(sel.backgroundText).toBe('Un chercheur de savoir.');
    });

    it('falls back to the full skill catalog when options are "any"', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const bg = makeErudBackground();
      (bg.data.proficiencies.skills as { options: unknown }).options = 'any';
      const skillMap = createSkillMapFromList(SKILLS);
      const sel = buildAutoBackgroundSelection(bg, skillMap);
      expect(sel.skills.length).toBe(2); // 1 fixe + 1 pioché parmi tout le catalogue
    });

    it('returns undefined personality fields when no table is provided', () => {
      const bg = makeErudBackground();
      (bg.data as { personalityTables: unknown }).personalityTables = null;
      const sel = buildAutoBackgroundSelection(bg, createSkillMapFromList(SKILLS));
      expect(sel.traits).toBeUndefined();
      expect(sel.ideal).toBeUndefined();
    });
  });
describe('buildAutoBackgroundSelection — cas additionnels', () => {
    it('does not pick extra skills when chooseCount is 0 and has no equipment choice slots by default', () => {
      const bg = makeErudBackground();
      bg.data.proficiencies.skills.chooseCount = 0;
      bg.data.equipment.choose = undefined;
      const sel = buildAutoBackgroundSelection(bg, createSkillMapFromList(SKILLS));
      expect(sel.skills).toEqual(['skill-arcanes']);
      expect(sel.equipmentSlots).toEqual([]);
    });

    it('falls back to the background name when no flavor summary is provided', () => {
      const bg = makeErudBackground();
      delete (bg.data.flavor as { summary?: string }).summary;
      const sel = buildAutoBackgroundSelection(bg, createSkillMapFromList(SKILLS));
      expect(sel.backgroundText).toBe('Érudit');
    });
  });
  describe('cas limites (ex-branches)', () => {
    it('buildAutoBackgroundSelection resolves every tools.choose option shape', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const bg = makeErudBackground();
        bg.data.proficiencies.tools = {
          fixed: [],
          choose: [
            { chooseCount: 1, options: ['tl-des'] },
            { chooseCount: 1, options: [{ type: 'gameSet' }] },
            { chooseCount: 1, options: [{ type: 'vehicle' }] },
            { chooseCount: 1, options: [{ type: 'unknown' }] },
          ] as never,
        };
        const sel = buildAutoBackgroundSelection(bg, createSkillMapFromList(SKILLS));
        expect(sel.tools).toEqual(['tl-des', 'gameSet-any', 'vehicle-any', 'tool-any']);
      });
    it('buildAutoBackgroundSelection handles sparse proficiency and equipment metadata', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const bg = makeErudBackground();
        bg.data.proficiencies = {
          skills: { fixed: [], chooseCount: 1, options: [] },
          tools: { fixed: [], choose: [] },
          languages: { fixed: [], choiceCount: 0 },
        } as never;
        bg.data.equipment = {
          fixed: [{ id: 'it-x', name: 'X', qty: undefined as never }],
          currency: {},
          choose: [{ name: undefined as never, pool: [{ id: 'gr-livre', qty: undefined as never }] }],
        } as never;
        const sel = buildAutoBackgroundSelection(bg, createSkillMapFromList(SKILLS));
        expect(sel.skills.length).toBe(1);
        expect(sel.tools).toEqual([]);
        expect(sel.currency.or).toBe(0);
        expect(sel.equipment[0].qty).toBe(1);
        expect(sel.equipmentSlots[0].description).toContain('Choix');
      });
    it('buildAutoBackgroundSelection rolls bonds and flaws tables when present', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const bg = makeErudBackground();
        const sel = buildAutoBackgroundSelection(bg, createSkillMapFromList(SKILLS));
        expect(sel.bonds).toBe('Ma bibliothèque.');
        expect(sel.flaws).toBe("Je m'égare dans mes recherches.");
      });
    it('buildAutoBackgroundSelection picks from explicit skill option lists', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const bg = makeErudBackground();
        bg.data.proficiencies.skills = {
          fixed: ['skill-arcanes'],
          chooseCount: 1,
          options: ['skill-histoire', 'skill-investigation'],
        };
        const sel = buildAutoBackgroundSelection(bg, createSkillMapFromList(SKILLS));
        expect(sel.skills).toEqual(['skill-arcanes', 'skill-histoire']);
      });
  });

});
