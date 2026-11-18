import { autoPickClassSkills, autoResolveClassProficiencies, createSkillMapFromList, CLASS_SPELLCASTING } from '../character-auto-build.util';
import { makeGuerrierCls, makeMagicienCls, makePretreLikeCls, SKILLS } from './spec-helpers';

describe('character-auto-build skills', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('autoPickClassSkills', () => {
    const skillMap = createSkillMapFromList(SKILLS);

    it('picks from the declared option pool, excluding already-taken skills', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const picked = autoPickClassSkills(['skill-arcanes', 'skill-histoire'], 1, skillMap, new Set());
      expect(picked).toEqual(['skill-arcanes']);
    });

    it('falls back to the full skill catalog for an "any" pool', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const picked = autoPickClassSkills(['any'], 2, skillMap, new Set(['skill-arcanes']));
      expect(picked.length).toBe(2);
      expect(picked).not.toContain('skill-arcanes');
    });
  });
describe('autoResolveClassProficiencies', () => {
    it('resolves a weapon_proficiency choice, filtering by max price (ignores already-known weapons)', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const weaponCatalog = [
        { id: 'wp-epee-courte', costPo: 10 },
        { id: 'wp-hache-de-guerre', costPo: 20 },
        { id: 'wp-hallebarde', costPo: 60 },
      ];
      const res = autoResolveClassProficiencies(makeGuerrierCls(), weaponCatalog, [], [], []);
      expect(res.weapons).toEqual(['wp-epee-courte']);
      expect(res.answers['choice-armes-guerrier']).toEqual(['wp-epee-courte']);
    });

    it('resolves a tool_proficiency choice, excluding already-known tools', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const toolCatalog = [{ id: 'tl-necessaire-de-calligraphe' }, { id: 'tl-necessaire-dalchimiste' }];
      const res = autoResolveClassProficiencies(makeMagicienCls(), [], toolCatalog, [], [
        'tl-necessaire-de-calligraphe',
      ]);
      expect(res.tools).toEqual(['tl-necessaire-dalchimiste']);
    });
  });
  describe('cas limites (ex-branches)', () => {
    it('autoResolveClassProficiencies returns empty results for a class with no deferred choices', () => {
        const cls = makePretreLikeCls();
        const res = autoResolveClassProficiencies(cls, [], [], [], []);
        expect(res.weapons).toEqual([]);
        expect(res.tools).toEqual([]);
        expect(res.answers).toEqual({});
      });
    it('autoPickClassSkills accepts the any-skills token', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const picked = autoPickClassSkills(['any-skills'], 1, createSkillMapFromList(SKILLS), new Set());
        expect(picked.length).toBe(1);
      });
    it('autoResolveClassProficiencies ignores max price when the choice omits it', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const cls = makeGuerrierCls();
        ((cls.data as unknown as { choice_pools: { constraint_max_price_po?: number }[] }).choice_pools[1]).constraint_max_price_po =
          undefined;
        const res = autoResolveClassProficiencies(
          cls,
          [{ id: 'wp-hallebarde', costPo: 60 }],
          [],
          [],
          [],
        );
        expect(res.weapons).toEqual(['wp-hallebarde']);
      });
    it('autoResolveClassProficiencies resolves deferred tool picks', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const res = autoResolveClassProficiencies(
          makeMagicienCls(),
          [],
          [{ id: 'tl-necessaire-de-calligraphe' }, { id: 'tl-necessaire-dalchimiste' }],
          [],
          [],
        );
        expect(res.tools.length).toBe(1);
      });
  });

});
