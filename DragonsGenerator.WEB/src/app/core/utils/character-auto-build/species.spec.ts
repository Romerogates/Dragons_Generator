import { testSpell } from '@testing/typed-fixtures';
import { buildAutoSpeciesSelection, CLASS_SPELLCASTING } from '../character-auto-build.util';
import { makeElfSpecies, makeDrakeideLikeSpecies } from './spec-helpers';
import type { Species, Spell } from './spec-helpers';
describe('character-auto-build species', () => {
  afterEach(() => {
    delete (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'];
  });

describe('buildAutoSpeciesSelection', () => {
    it('builds racial bonuses/traits/spells for a species with a playable subspecies (targetLevel 1)', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const species = makeElfSpecies();
      const spells: Spell[] = [
        testSpell({ id: 'spl-lueur', name: 'Lueur', level: 0, description: 'Une petite lumière.' }),
        testSpell({ id: 'spl-invisibilite', name: 'Invisibilité', level: 2, description: '...' }),
      ];
      const sel = buildAutoSpeciesSelection(species, 1, spells);

      expect(sel.speciesId).toBe('sp-elfe');
      expect(sel.subspeciesId).toBe('sub-elfe-des-bois');
      // ASI base (dex +2) + sous-espèce (sag +1) + choix (force +1, idx0 de ['str','dex','con'])
      expect(sel.racialBonuses).toEqual({ dexterite: 2, sagesse: 1, force: 1 });
      expect(sel.traits.length).toBe(4); // 3 traits espèce + 1 trait sous-espèce
      expect(sel.bonusLanguageCount).toBe(1);
      expect(sel.bonusSkillCount).toBe(1);
      expect(sel.bonusToolCount).toBe(1);
      expect(sel.hasDarkvision).toBeTrue();
      expect(sel.darkvisionRadius).toBe(18);
      expect(sel.bonusWeapons).toEqual(['wp-epee-longue', 'wp-arc-long']);
      // Seul le sort niveau 1 (unlocks_at_level 1) est débloqué à ce niveau cible.
      expect(sel.innateSpells.length).toBe(1);
      expect(sel.innateSpells[0]).toEqual(
        jasmine.objectContaining({ refId: 'spl-lueur', level: 0, effectSummary: jasmine.stringContaining('à volonté') }),
      );
      // Le choix de cantrip (single_select + spellList) doit apparaître dans racialSpellGrants.
      expect(sel.racialSpellGrants.length).toBe(1);
      expect(sel.racialSpellGrants[0].choiceId).toBe('choice-cantrip-elfe');
      expect(sel.choiceAnswers['choice-cantrip-elfe']).toEqual(['spl-lueur']);
    });

    it('unlocks higher-level innate spells and covers every recharge label branch', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const species = makeElfSpecies();
      const spells: Spell[] = [
        testSpell({ id: 'spl-lueur', name: 'Lueur', level: 0, description: '' }),
        testSpell({ id: 'spl-invisibilite', name: 'Invisibilité', level: 2, description: '' }),
      ];
      const sel = buildAutoSpeciesSelection(species, 5, spells);
      expect(sel.innateSpells.length).toBe(4);
      const byId = Object.fromEntries(sel.innateSpells.map((s) => [s.refId, s]));
      expect(byId['spl-invisibilite'].effectSummary).toContain('1× / repos long');
      expect(byId['spl-inconnu'].effectSummary).toContain('1× / repos court');
      expect(byId['spl-inconnu'].name).toBe('inconnu'); // fallback : spellId inconnu du catalogue
      expect(byId['spl-mystere'].effectSummary).toContain('weird_recharge'); // recharge non mappée : passthrough
    });

    it('resolves damage-from-lineage resistances via the chosen lignée draconique option', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const species = makeDrakeideLikeSpecies();
      const sel = buildAutoSpeciesSelection(species, 1, []);
      expect(sel.choiceAnswers['choice-lignee-draconique']).toEqual(['rouge']);
      expect(sel.resistances).toEqual(['feu']);
      expect(sel.subspeciesId).toBeNull();
    });

    it('handles a species with no subspecies and no creation choices', () => {
      const species: Species = {
        ...makeElfSpecies(),
        subspecies: [],
        creationChoices: [],
        traits: [],
      };
      const sel = buildAutoSpeciesSelection(species, 1, []);
      expect(sel.subspeciesId).toBeNull();
      expect(sel.traits).toEqual([]);
      expect(sel.bonusLanguageCount).toBe(0);
      expect(sel.innateSpells).toEqual([]);
      expect(sel.racialSpellGrants).toEqual([]);
    });
  });
describe('buildAutoSpeciesSelection — cas additionnels', () => {
    it('handles multi_select creation choices and skips choices with an empty option pool', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const species = makeElfSpecies();
      species.creationChoices = [
        ...species.creationChoices,
        {
          id: 'choice-multi-elfe',
          name: 'Sorts multiples',
          desc: '',
          type: 'multi_select',
          choiceCount: 2,
          options: ['spl-a', 'spl-b', 'spl-c'],
        } as never,
        { id: 'choice-vide', name: 'Vide', desc: '', type: 'single_select', options: [] } as never,
      ];
      const sel = buildAutoSpeciesSelection(species, 1, []);
      expect(sel.choiceAnswers['choice-multi-elfe']).toEqual(['spl-a', 'spl-b']);
      expect(sel.choiceAnswers['choice-vide']).toBeUndefined();
    });

    it('ignores creation choice codes that do not map to a known ability and non-array options', () => {
      const species = makeElfSpecies();
      species.creationChoices = [
        {
          id: 'choice-asi-invalide',
          name: 'Bonus',
          desc: '',
          type: 'ability_score_increase',
          choiceCount: 1,
          options: 'not-an-array' as never,
        } as never,
      ];
      const sel = buildAutoSpeciesSelection(species, 1, []);
      expect(sel.racialBonuses['force']).toBeUndefined();
    });

    it('has no darkvision when darkvisionM is 0', () => {
      const species = makeElfSpecies();
      species.baseStats.darkvisionM = 0;
      const sel = buildAutoSpeciesSelection(species, 1, []);
      expect(sel.hasDarkvision).toBeFalse();
      expect(sel.darkvisionRadius).toBe(0);
    });

    it('ignores malformed innate_spellcasting mechanics (missing spell_id, non-array list, wrong type)', () => {
      const species = makeElfSpecies();
      species.traits = [
        { id: 'trait-1', name: 'Sans mechanics', desc: '' } as never,
        { id: 'trait-2', name: 'Mauvais type', desc: '', mechanics: { type: 'other' } } as never,
        { id: 'trait-3', name: 'Liste non tableau', desc: '', mechanics: { type: 'innate_spellcasting', innate_spells: 'x' } } as never,
        {
          id: 'trait-4',
          name: 'Entrée invalide',
          desc: '',
          mechanics: { type: 'innate_spellcasting', innate_spells: [null, { spell_id: '' }, { spell_id: 42 }] },
        } as never,
      ];
      species.subspecies = [];
      const sel = buildAutoSpeciesSelection(species, 1, []);
      expect(sel.innateSpells).toEqual([]);
    });
  });
describe('buildAutoSpeciesSelection — object option ids', () => {
    it('reads option ids from object-shaped creation choice entries', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const species: Species = {
        ...makeElfSpecies(),
        subspecies: [],
        creationChoices: [
          {
            id: 'choice-obj',
            name: 'Objet',
            desc: '',
            type: 'single_select',
            options: [{ id: 'opt-a', name: 'A' }, { id: 'opt-b', name: 'B' }],
          },
        ],
      };
      const sel = buildAutoSpeciesSelection(species, 1, []);
      expect(sel.choiceAnswers['choice-obj']).toEqual(['opt-a']);
    });
  });
  describe('cas limites (ex-branches)', () => {
    it('ignores creation choices of an unrelated type and skill/tool choices without an explicit count', () => {
        const species = makeElfSpecies();
        species.creationChoices = [
          { id: 'choice-inconnu', name: 'Inconnu', desc: '', type: 'background_choice', options: ['a'] } as never,
          { id: 'choice-skill-sans-count', name: 'Comp.', desc: '', type: 'skill_proficiency', options: ['skill-perception'] } as never,
        ];
        const sel = buildAutoSpeciesSelection(species, 1, []);
        expect(sel.choiceAnswers['choice-inconnu']).toBeUndefined();
        expect(sel.bonusSkillCount).toBe(1); // choiceCount absent -> défaut 1
      });
    it('buildAutoSpeciesSelection keeps string option ids and skips empty option pools', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const species = makeElfSpecies();
        species.subspecies = [];
        species.creationChoices = [
          { id: 'choice-str', name: 'String', desc: '', type: 'single_select', options: ['opt-x', 'opt-y'] },
          { id: 'choice-empty', name: 'Vide', desc: '', type: 'single_select', options: [] },
        ];
        const sel = buildAutoSpeciesSelection(species, 1, []);
        expect(sel.choiceAnswers['choice-str']).toEqual(['opt-x']);
        expect(sel.choiceAnswers['choice-empty']).toBeUndefined();
      });
    it('buildAutoSpeciesSelection merges subspecies choices, languages and spell grants', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const species = makeElfSpecies();
        species.baseStats.size = undefined as never;
        species.subspecies = [
          {
            id: 'sub-custom',
            name: 'Custom',
            playable: true,
            flavor: '',
            abilityScoreIncrease: {},
            traits: [],
            languages: { fixed: ['lg-gnome'], choiceCount: 0 },
            creationChoices: [
              {
                id: 'choice-sub-skill',
                name: 'Comp.',
                desc: '',
                type: 'single_select',
                options: ['skill-perception'],
              },
            ],
          },
        ];
        species.creationChoices = [
          {
            id: 'choice-langue-nom',
            name: 'Langue bonus',
            desc: '',
            type: 'language',
            choiceCount: 1,
            options: ['lg-nain'],
          },
          {
            id: 'choice-skill-extra',
            name: 'Compétence',
            desc: '',
            type: 'skill_proficiency',
            choiceCount: 1,
            options: ['skill-arcanes'],
          },
          {
            id: 'choice-spell',
            name: 'Sort',
            desc: '',
            type: 'spell',
            spellLevel: 0,
            options: ['spl-lueur'],
          },
          {
            id: 'choice-tool',
            name: 'Outil',
            desc: '',
            type: 'tool',
            choiceCount: 2,
            options: ['tl-luth'],
          },
          {
            id: 'choice-asi',
            name: 'Bonus',
            desc: '',
            type: 'ability_score_increase',
            choiceCount: 1,
            valuePerChoice: 1,
            options: ['bad-code', 'str'],
          },
          {
            id: 'choice-any',
            name: 'Any',
            desc: '',
            type: 'single_select',
            options: ['any', 'opt-z'],
          },
        ];
        const sel = buildAutoSpeciesSelection(species, 1, [
          testSpell({ id: 'spl-lueur', name: 'Lueur', level: 0, description: 'Lumière.' }),
        ]);
        expect(sel.size).toBe('M');
        expect(sel.languages).toContain('lg-gnome');
        expect(sel.bonusLanguageCount).toBe(1);
        expect(sel.bonusSkillCount).toBe(1);
        expect(sel.bonusToolCount).toBe(2);
        expect(sel.racialSpellGrants.some((g) => g.choiceId === 'choice-spell')).toBeTrue();
        expect(sel.choiceAnswers['choice-sub-skill']).toEqual(['skill-perception']);
        expect(sel.choiceAnswers['choice-any']).toEqual(['opt-z']);
      });
    it('buildAutoSpeciesSelection reads innate spell descriptions when present', () => {
        spyOn(Math, 'random').and.returnValue(0);
        const species = makeElfSpecies();
        species.subspecies = [];
        species.traits = [species.traits.find((t) => t.id === 'trait-sorts-innes')!];
        const sel = buildAutoSpeciesSelection(species, 1, [
          testSpell({ id: 'spl-lueur', name: 'Lueur', level: 0, description: 'Une lumière utile en caverne.' }),
        ]);
        expect(sel.innateSpells[0]?.effectSummary).toContain('Une lumière utile');
      });
  });

});
