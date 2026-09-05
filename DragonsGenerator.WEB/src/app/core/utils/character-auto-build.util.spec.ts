import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Species } from '@core/models/Species/species';
import type { Background } from '@core/models/Backgrounds/background';
import type { Civilisation } from '@core/models/Civilisations/civilisations';
import type { Language } from '@core/models/Languages/language';
import type { Spell } from '@core/models/Spells/spell';
import type { Skill } from '@core/models/Skills/skill';
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
  type EquipmentCatalogItem,
} from './character-auto-build.util';
import { createLettreClass } from '../../../testing/lettre-fixtures';

// --- Fixtures -----------------------------------------------------------

function makeGuerrierCls(): CharacterClass {
  return {
    id: 'cls-guerrier',
    name: 'Guerrier',
    data: {
      hit_die: 10,
      primary_abilities: ['Force'],
      proficiencies: {
        armor: ['ar-legere', 'ar-intermediaire', 'ar-bouclier'],
        weapons: ['wp-cat-simple', 'wp-cat-martial'],
        tools: [],
        saving_throws: ['Force', 'Constitution'],
        skills: { count: 2, options: ['skill-acrobaties', 'skill-athletisme', 'skill-intimidation'] },
      },
      starting_equipment: [],
      progression: [
        {
          level: 1,
          prof_bonus: 2,
          features: ['feat-second-souffle', 'feat-style-de-combat-guerrier'],
          resources: {},
        },
      ],
      features_details: [
        {
          id: 'feat-second-souffle',
          name: 'Second souffle',
          desc: 'Récupère des PV.',
          level: 1,
          recharge: 'short_rest',
          uses: { base: 1 },
        },
        {
          id: 'feat-style-de-combat-guerrier',
          name: 'Style de combat',
          desc: 'Choisit un style.',
          level: 1,
          resolves_to_choice_pool: 'choice-style-combat-guerrier',
        },
        { id: 'feat-style-duel', name: 'Style : Duel', desc: '+2 dégâts à une main.' },
        { id: 'feat-style-defense', name: 'Style : Défense', desc: '+1 CA en armure.' },
        { id: 'feat-a', name: 'Option A', desc: 'Effet A.' },
        { id: 'feat-b', name: 'Option B', desc: 'Effet B.' },
        { id: 'feat-toujours-present', name: 'Toujours présent', desc: 'Fixe.', level: 1 },
      ],
      choice_pools: [
        {
          id: 'choice-style-combat-guerrier',
          type: 'fighting_style',
          pool: ['feat-style-duel', 'feat-style-defense'],
        },
        {
          id: 'choice-armes-guerrier',
          type: 'weapon_proficiency',
          pool: ['wp-epee-courte', 'wp-hache-de-guerre', 'wp-hallebarde'],
          quantity: 1,
          constraint_max_price_po: 20,
        },
        {
          id: 'choice-fanfaronnade',
          type: 'feature_option',
          name: 'Fanfaronnade',
          quantity: 1,
          pool: ['feat-a', 'feat-b'],
          fixed_features: ['feat-toujours-present'],
        },
      ],
      subclasses: {
        unlocked_at_level: 3,
        options: [
          {
            id: 'subcls-champion',
            name: 'Champion',
            features: [
              {
                id: 'feat-critique-ameliore',
                name: 'Critique amélioré',
                desc: 'Critique sur 19-20.',
                level: 3,
                mechanics: {
                  resistances: [{ type: 'damage_type', damage_type: 'feu' }],
                  darkvision_radius_m: 18,
                },
              },
            ],
          },
        ],
      },
    } as any,
  } as unknown as CharacterClass;
}

function makeMagicienCls(): CharacterClass {
  return {
    id: 'cls-magicien',
    name: 'Magicien',
    data: {
      hit_die: 6,
      primary_abilities: ['Intelligence'],
      proficiencies: {
        armor: [],
        weapons: ['wp-dague', 'wp-arbalete-legere'],
        tools: [],
        saving_throws: ['Intelligence', 'Sagesse'],
        skills: { count: 2, options: ['skill-arcanes', 'skill-histoire', 'skill-investigation'] },
      },
      starting_equipment: [],
      progression: [
        {
          level: 1,
          prof_bonus: 2,
          features: ['feat-sorts-magicien'],
          resources: { cantrips_known: 3, spell_slots: { '1': 2 } },
        },
        {
          level: 3,
          prof_bonus: 2,
          features: ['feat-sorts-magicien'],
          resources: { spell_slots: { '1': 4, '2': 2 } },
        },
      ],
      features_details: [{ id: 'feat-sorts-magicien', name: 'Incantation', desc: 'Lance des sorts.', level: 1 }],
      choice_pools: [
        { id: 'choice-langue-magicien', type: 'language_proficiency', pool: ['lang-category-exotique'], quantity: 1 },
        {
          id: 'choice-outil-magicien',
          type: 'tool_proficiency',
          pool: ['tl-necessaire-de-calligraphe', 'tl-necessaire-dalchimiste'],
          quantity: 1,
        },
      ],
    } as any,
  } as unknown as CharacterClass;
}

function makePretreLikeCls(): CharacterClass {
  return {
    id: 'cls-pretre',
    name: 'Prêtre',
    data: {
      hit_die: 8,
      primary_abilities: ['Sagesse'],
      proficiencies: {
        armor: ['ar-legere', 'ar-intermediaire', 'ar-bouclier'],
        weapons: ['wp-cat-simple'],
        tools: [],
        saving_throws: ['Sagesse', 'Charisme'],
        skills: { count: 2, options: ['skill-histoire', 'skill-intuition', 'skill-medecine'] },
      },
      starting_equipment: [],
      progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
      features_details: [{ id: 'feat-domaine-choisi', name: 'Domaine divin', desc: '...', level: 1 }],
      choice_pools: [],
      subclasses: {
        unlocked_at_level: 1,
        options: [
          {
            id: 'subcls-domaine-de-la-vie',
            name: 'Domaine de la vie',
            bonus_proficiencies: { armor: ['ar-lourde'] },
            features: [],
            sub_choices: [
              {
                id: 'choice-domaine-pretre',
                type: 'single_select',
                count: 1,
                level_required: 1,
                label: 'Domaine',
                options: ['dom-vie', 'dom-guerre'],
                option_labels: { 'dom-vie': 'Vie', 'dom-guerre': 'Guerre' },
                option_descs: { 'dom-vie': 'Soins accrus.', 'dom-guerre': 'Bonus martiaux.' },
              },
            ],
          },
        ],
      },
    } as any,
  } as unknown as CharacterClass;
}

function makeElfSpecies(): Species {
  return {
    id: 'sp-elfe',
    name: 'Elfe',
    nameAlt: [],
    source: { book: '', pages: '' },
    flavor: { summary: 'Peuple ancien.' },
    baseStats: {
      abilityScoreIncrease: { dex: 2 },
      speedM: 9,
      size: 'M',
      darkvisionM: 18,
      height: { desc: '' },
      weight: { desc: '' },
      age: { maturityYears: 20, lifespanYears: 750, desc: '' },
      alignment: { tendency: '', desc: '' },
    },
    traits: [
      { id: 'trait-vision-dans-le-noir', name: 'Vision dans le noir', desc: '...' },
      {
        id: 'trait-sorts-innes',
        name: 'Sorts innés elfiques',
        desc: '...',
        mechanics: {
          type: 'innate_spellcasting',
          innate_spells: [
            { spell_id: 'spl-lueur', unlocks_at_level: 1, cast_as_spell_level: 0, recharge: 'at_will' },
            { spell_id: 'spl-invisibilite', unlocks_at_level: 5, cast_as_spell_level: 2, recharge: 'long_rest' },
            { spell_id: 'spl-inconnu', unlocks_at_level: 5, recharge: 'short_rest' },
            { spell_id: 'spl-mystere', unlocks_at_level: 5, recharge: 'weird_recharge' },
          ],
        },
      },
      {
        id: 'trait-formation-martiale',
        name: 'Formation martiale elfique',
        desc: '...',
        mechanics: { type: 'weapon_proficiency', grants: ['epee-longue', 'arc-long'] },
      },
    ],
    creationChoices: [
      {
        id: 'choice-asi-elfe',
        name: 'Bonus',
        desc: '',
        type: 'ability_score_increase',
        choiceCount: 1,
        valuePerChoice: 1,
        options: ['str', 'dex', 'con'],
      },
      { id: 'choice-langue-elfe', name: 'Langue', desc: '', type: 'language', choiceCount: 1, options: ['any'] },
      {
        id: 'choice-cantrip-elfe',
        name: 'Cantrip magicien',
        desc: '',
        type: 'single_select',
        spellList: 'wizard',
        spellLevel: 0,
        spellcastingAbility: 'Intelligence',
        options: ['spl-lueur', 'spl-choc-electrique'],
      },
      {
        id: 'choice-competence-elfe',
        name: 'Compétence',
        desc: '',
        type: 'skill_proficiency',
        choiceCount: 1,
        options: ['skill-perception', 'skill-arcanes'],
      },
      {
        id: 'choice-outil-elfe',
        name: 'Outil',
        desc: '',
        type: 'tool_proficiency',
        choiceCount: 1,
        options: ['tl-luth'],
      },
    ],
    languages: { fixed: ['lg-commun', 'lg-elfique'], choiceCount: 0 },
    subspecies: [
      {
        id: 'sub-elfe-des-bois',
        name: 'Elfe des bois',
        playable: true,
        flavor: '',
        abilityScoreIncrease: { wis: 1 },
        traits: [{ id: 'trait-pas-elfique', name: 'Pas elfique', desc: '...' }],
        creationChoices: [],
      },
      {
        id: 'sub-elfe-noir',
        name: 'Elfe noir',
        playable: false,
        flavor: '',
        abilityScoreIncrease: { cha: 1 },
        traits: [],
        creationChoices: [],
      },
    ],
    optionalRules: [],
  } as unknown as Species;
}

function makeDrakeideLikeSpecies(): Species {
  return {
    id: 'sp-drakeide',
    name: 'Drakéide',
    nameAlt: [],
    source: { book: '', pages: '' },
    flavor: { summary: '' },
    baseStats: {
      abilityScoreIncrease: { str: 2, cha: 1 },
      speedM: 9,
      size: 'M',
      darkvisionM: 0,
      height: { desc: '' },
      weight: { desc: '' },
      age: { maturityYears: 15, lifespanYears: 80, desc: '' },
      alignment: { tendency: '', desc: '' },
    },
    traits: [
      {
        id: 'trait-resistance-draconique',
        name: 'Résistance draconique',
        desc: '...',
        mechanics: { type: 'damage_resistance', damage_type_from: 'heritage_draconique' },
      },
    ],
    creationChoices: [
      {
        id: 'choice-lignee-draconique',
        name: 'Lignée draconique',
        desc: '',
        type: 'single_select',
        options: [
          { id: 'rouge', name: 'Rouge', damage_type: 'feu' },
          { id: 'bleu', name: 'Bleu', damage_type: 'foudre' },
        ],
      },
    ],
    languages: { fixed: ['lg-commun', 'lg-draconique'], choiceCount: 0 },
    subspecies: [],
    optionalRules: [],
  } as unknown as Species;
}

function makeCivilisation(): Civilisation {
  return {
    id: 'civ-ajagar',
    name: 'Ajagar',
    randomization: { diceMin: 1, diceMax: 6 },
    demographics: {} as never,
    linguistics: {
      officialLanguages: [{ id: 'lg-commun', label: 'Commun' }],
      additionalLanguagesSpoken: true,
      writingSystems: [{ id: 'ws-runique', label: 'Runique' }],
    },
    lore: {} as never,
  } as unknown as Civilisation;
}

function makeErudBackground(): Background {
  return {
    id: 'bg-erudit',
    name: 'Érudit',
    data: {
      preset: true,
      source: { book: '', pages: '' },
      flavor: { summary: 'Un chercheur de savoir.', adventureHook: null },
      proficiencies: {
        skills: { fixed: ['skill-arcanes'], chooseCount: 1, options: ['skill-histoire', 'skill-investigation'] },
        tools: {
          fixed: [],
          choose: [
            { chooseCount: 1, options: [{ type: 'instrument' }, { type: 'gameSet' }] },
            { chooseCount: 1, options: [{ type: 'vehicle' }, { id: 'tl-des' }, { type: 'unknown' }] },
          ],
        },
        languages: { choiceCount: 1 },
      },
      equipment: {
        fixed: [{ id: 'it-bouteille-encre', name: "Bouteille d'encre", qty: 1, location: 'backpack' }],
        currency: { or: 10 },
        choose: [{ name: 'Livre ou loupe', pool: [{ id: 'gr-livre', qty: 1 }, { id: 'gr-loupe', qty: 1 }] }],
      },
      privilege: { id: 'priv-chercheur', name: 'Chercheur', desc: 'Accès aux bibliothèques.' },
      personalityTables: {
        traits: { die: 'd8', entries: [{ roll: 1, text: 'Je cite des philosophes.' }] },
        ideals: { die: 'd6', entries: [{ roll: 1, text: 'Savoir', alignment: 'N' }] },
        bonds: { die: 'd6', entries: [{ roll: 1, text: 'Ma bibliothèque.' }] },
        flaws: { die: 'd6', entries: [{ roll: 1, text: "Je m'égare dans mes recherches." }] },
      },
    } as any,
  } as unknown as Background;
}

const SKILLS: Skill[] = [
  { id: 'skill-arcanes', name: 'Arcanes', ability: 'int', description: '', examples: [], passiveCheck: false },
  { id: 'skill-histoire', name: 'Histoire', ability: 'int', description: '', examples: [], passiveCheck: false },
  {
    id: 'skill-investigation',
    name: 'Investigation',
    ability: 'int',
    description: '',
    examples: [],
    passiveCheck: false,
  },
  { id: 'skill-perception', name: 'Perception', ability: 'wis', description: '', examples: [], passiveCheck: true },
];

const TOOL_CATALOG: EquipmentCatalogItem[] = [
  { id: 'tl-luth', name: 'Luth', type: 'TOOL', subtype: 'instrument', cost: { v: 35, u: 'po' }, wKg: 2, data: {} },
  { id: 'tl-des', name: 'Dés', type: 'TOOL', subtype: 'gaming_set', cost: { v: 0, u: 'po' }, wKg: 0, data: {} },
  {
    id: 'tl-outils-de-voleur',
    name: 'Outils de voleur',
    type: 'TOOL',
    subtype: 'thieves',
    cost: { v: 25, u: 'po' },
    wKg: 1,
    data: {},
  },
];

// --- Tests ----------------------------------------------------------------

describe('character-auto-build.util', () => {
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

  describe('buildAutoSpeciesSelection', () => {
    it('builds racial bonuses/traits/spells for a species with a playable subspecies (targetLevel 1)', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const species = makeElfSpecies();
      const spells: Spell[] = [
        { id: 'spl-lueur', name: 'Lueur', level: 0, description: 'Une petite lumière.' } as unknown as Spell,
        { id: 'spl-invisibilite', name: 'Invisibilité', level: 2, description: '...' } as unknown as Spell,
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
        { id: 'spl-lueur', name: 'Lueur', level: 0, description: '' } as unknown as Spell,
        { id: 'spl-invisibilite', name: 'Invisibilité', level: 2, description: '' } as unknown as Spell,
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

  describe('primaryAbilityKeys', () => {
    it('resolves the primary key from a non-caster class', () => {
      expect(primaryAbilityKeys(makeGuerrierCls())).toEqual(['force']);
    });

    it('dedupes the spellcasting ability against the declared primary ability', () => {
      expect(primaryAbilityKeys(makeMagicienCls())).toEqual(['intelligence']);
    });

    it('falls back to force/dexterite when nothing is declared', () => {
      const cls: CharacterClass = {
        id: 'cls-test-inconnu',
        name: 'Inconnu',
        data: { primary_abilities: [] } as any,
      } as unknown as CharacterClass;
      expect(primaryAbilityKeys(cls)).toEqual(['force', 'dexterite']);
    });

    it('does not resolve a spellcasting ability before the class unlocks it (Rôdeur niv. 1)', () => {
      const cls: CharacterClass = {
        id: 'cls-rodeur',
        name: 'Rôdeur',
        data: { primary_abilities: ['Sagesse'] } as any,
      } as unknown as CharacterClass;
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

  describe('buildAutoClassSelection', () => {
    it('builds a level 1 non-caster class (no subclass yet, combat style + active choice pools)', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { selection, classChoiceAnswers, extraFeatures } = buildAutoClassSelection(makeGuerrierCls(), 1);

      expect(selection.hitDie).toBe(10);
      expect(selection.hpAtLevel1).toBe(10);
      expect(selection.hpPerLevelAverage).toBe(6);
      expect(selection.hasSpellcasting).toBeFalse();
      expect(selection.subclassId).toBeUndefined();
      expect(selection.savingThrows).toEqual(['Force', 'Constitution']);
      expect(selection.armorProficiencies).toEqual(['ar-legere', 'ar-intermediaire', 'ar-bouclier']);

      // Second souffle (résolu) + 1 style de combat piochés ; le feat "resolves_to_choice_pool"
      // et le style de combat lui-même (géré par choice_pools) ne sont PAS dupliqués en feature brute.
      expect(selection.classFeatures.length).toBe(2);
      const secondSouffle = selection.classFeatures.find((f) => f.refId === 'feat-second-souffle');
      expect(secondSouffle?.uses).toEqual({ max: 1, current: 1, recharge: 'short_rest' });
      const style = selection.classFeatures.find((f) => (f.refId ?? '').startsWith('feat-style-'));
      expect(style).toBeTruthy();
      expect(['feat-style-duel', 'feat-style-defense']).toContain(style?.refId as string);

      // Choix actif de classe (non déferré) : 1 pick + 1 feature fixe toujours présente.
      expect(classChoiceAnswers['choice-fanfaronnade']).toEqual(['feat-a']);
      expect(extraFeatures.map((f) => f.refId).sort()).toEqual(['feat-a', 'feat-toujours-present']);
    });

    it('unlocks the subclass at level 3 and applies its bonus proficiencies/resistances/senses', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { selection } = buildAutoClassSelection(makeGuerrierCls(), 3);

      expect(selection.subclassId).toBe('subcls-champion');
      expect(selection.subclassName).toBe('Champion');
      expect(selection.classFeatures.some((f) => f.refId === 'feat-critique-ameliore')).toBeTrue();
      expect(selection.classResistances).toEqual(['feu']);
      expect(selection.classDarkvisionRadius).toBe(18);
      expect(selection.classHasBlindsight).toBeFalse();
    });

    it('resolves spellcasting kind/ability and JSON spell slots for a caster class', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { selection } = buildAutoClassSelection(makeMagicienCls(), 3);
      expect(selection.hasSpellcasting).toBeTrue();
      expect(selection.spellcastingKind).toBe('wizard');
      expect(selection.spellcastingAbility).toBe('Intelligence');
      expect(selection.classSpellSlots).toEqual([
        { level: 1, max: 4 },
        { level: 2, max: 2 },
      ]);
      expect(selection.classBonusLanguageCount).toBe(1);
      expect(selection.classRequiredExoticLanguageCount).toBe(1);
    });

    it('materializes subclass sub_choices (domain-style pick) into extra features and bonus proficiencies', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { selection, classChoiceAnswers, extraFeatures } = buildAutoClassSelection(makePretreLikeCls(), 1);

      expect(selection.subclassId).toBe('subcls-domaine-de-la-vie');
      expect(selection.armorProficiencies).toContain('ar-lourde');
      expect(classChoiceAnswers['choice-domaine-pretre']).toEqual(['dom-vie']);
      const domainFeature = extraFeatures.find((f) => f.refId === 'dom-vie');
      expect(domainFeature).toEqual(
        jasmine.objectContaining({ name: 'Vie', desc: 'Soins accrus.', level: 1 }),
      );
    });
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

  describe('resolveBgToolToConcrete', () => {
    it('passes through ids already prefixed with tl-', () => {
      expect(resolveBgToolToConcrete('tl-des', TOOL_CATALOG)).toBe('tl-des');
    });

    it('resolves an "instrument" token to a random musical instrument', () => {
      spyOn(Math, 'random').and.returnValue(0);
      expect(resolveBgToolToConcrete('instrument-any', TOOL_CATALOG)).toBe('tl-luth');
    });

    it('resolves a "game" token to a random gaming set', () => {
      spyOn(Math, 'random').and.returnValue(0);
      expect(resolveBgToolToConcrete('game-any', TOOL_CATALOG)).toBe('tl-des');
    });

    it('falls back to a random TOOL for an unrecognized token', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const resolved = resolveBgToolToConcrete('vehicle-any', TOOL_CATALOG);
      expect(TOOL_CATALOG.map((t) => t.id)).toContain(resolved);
    });

    it('falls back to the raw ref when the catalog has no matching TOOL', () => {
      expect(resolveBgToolToConcrete('vehicle-any', [])).toBe('vehicle-any');
    });
  });

  describe('buildBackgroundToolSlots', () => {
    it('builds category slots for "any"/instrument/game tokens and a fixed slot otherwise', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const slots = buildBackgroundToolSlots(['instrument-any', 'vehicle-any', 'tl-des'], TOOL_CATALOG);
      expect(slots.length).toBe(3);
      expect(slots[0].alternatives).toEqual([[{ id: 'category-musical-instruments', qty: 1 }]]);
      expect(slots[1].alternatives).toEqual([[{ id: 'category-tools', qty: 1 }]]);
      expect(slots[2].fixed).toEqual([{ id: 'tl-des', qty: 1 }]);
    });
  });

  describe('buildAutoEquipment', () => {
    const catalog: EquipmentCatalogItem[] = [
      {
        id: 'wp-epee-courte',
        name: 'Épée courte',
        type: 'WEAPON',
        subtype: 'SIMPLE_MELEE',
        cost: { v: 10, u: 'po' },
        wKg: 2,
        data: { dmg_d: '1d6', dmg_t: 'perforant', props: ['Légère'] },
      },
      {
        id: 'wp-dague',
        name: 'Dague',
        type: 'WEAPON',
        subtype: 'SIMPLE_MELEE',
        cost: { v: 2, u: 'po' },
        wKg: 0.5,
        data: { dmg_d: '1d4' },
      },
      {
        id: 'ar-armure-de-cuir',
        name: 'Armure de cuir',
        type: 'ARMOR',
        subtype: 'LIGHT',
        cost: { v: 10, u: 'po' },
        wKg: 5,
        data: { ac: 11 },
      },
      {
        id: 'ar-bouclier',
        name: 'Bouclier',
        type: 'ARMOR',
        subtype: 'SHIELD',
        cost: { v: 10, u: 'po' },
        wKg: 3,
        data: { ac: 2 },
      },
    ];

    it('resolves fixed direct-id slots, mastered-choice categories, filter categories and alternatives', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const slots = [
        { slot: 1, fixed: [{ id: 'wp-dague', qty: 1 }] },
        { slot: 2, fixed: [{ id: 'wp-mastered-choice', qty: 1 }] },
        { slot: 3, fixed: [{ id: 'category-simple-weapons', qty: 1 }] },
        { slot: 4, alternatives: [[{ id: 'ar-armure-de-cuir', qty: 1 }], [{ id: 'ar-bouclier', qty: 1 }]] },
        { slot: 5, alternatives: [] },
      ];
      const result = buildAutoEquipment(slots, catalog, ['wp-epee-courte', 'wp-dague'], []);

      const cd = (i: number) => result[i].customData as Record<string, unknown> | undefined;
      expect(result.length).toBe(4); // le slot 5 (alternatives vides) ne produit rien
      expect(result[0].refId).toBe('wp-dague');
      expect(cd(0)?.['isWeapon']).toBeTrue();
      expect(['wp-epee-courte', 'wp-dague']).toContain(result[1].refId); // mastered-choice
      expect(['wp-epee-courte', 'wp-dague']).toContain(result[2].refId); // category-simple-weapons
      expect(result[3].refId).toBe('ar-armure-de-cuir');
      expect(result[3].equipped).toBeTrue();
      expect(cd(3)?.['isArmor']).toBeTrue();
    });

    it('marks shields distinctly from armor', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const result = buildAutoEquipment(
        [{ slot: 1, fixed: [{ id: 'ar-bouclier', qty: 1 }] }],
        catalog,
        [],
        [],
      );
      const cd = result[0].customData as Record<string, unknown> | undefined;
      expect(cd?.['isShield']).toBeTrue();
      expect(cd?.['isArmor']).toBeFalse();
    });
  });

  describe('buildAutoSpellcastingDetails', () => {
    it('returns null for a non-caster class', () => {
      expect(buildAutoSpellcastingDetails(makeGuerrierCls(), [], [], {})).toBeNull();
    });

    it('returns an empty shell when the resolved kind has no quota configured', () => {
      (CLASS_SPELLCASTING as Record<string, unknown>)['cls-test-inconnu'] = {
        kind: 'no-quota-kind',
        ability: 'Force',
      };
      const cls: CharacterClass = {
        id: 'cls-test-inconnu',
        name: 'Test',
        data: {} as any,
      } as unknown as CharacterClass;
      expect(buildAutoSpellcastingDetails(cls, [], [], {})).toEqual({ cantrips: [], spells: [] });
    });

    it('builds cantrips/spells for a wizard-like class, merging racial cantrip grants', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const spells: Spell[] = [
        { id: 'spl-lueur', name: 'Lueur', level: 0, description: 'Lumière.', classes: ['cls-magicien'] } as unknown as Spell,
        {
          id: 'spl-tour-de-magie-2',
          name: 'Tour de magie 2',
          level: 0,
          description: '...',
          classes: ['cls-magicien'],
        } as unknown as Spell,
        {
          id: 'spl-tour-de-magie-3',
          name: 'Tour de magie 3',
          level: 0,
          description: '...',
          classes: ['cls-magicien'],
        } as unknown as Spell,
        {
          id: 'spl-projectile-magique',
          name: 'Projectile magique',
          level: 1,
          description: '...',
          classes: ['cls-magicien'],
        } as unknown as Spell,
        {
          id: 'spl-bouclier',
          name: 'Bouclier',
          level: 1,
          description: '...',
          classes: ['cls-magicien'],
        } as unknown as Spell,
      ];
      const racialGrants = [
        { choiceId: 'elf-cantrip', label: '', desc: '', pool: ['spl-lueur'], spellLevel: 0, spellcastingAbility: 'Intelligence' },
      ];
      const details = buildAutoSpellcastingDetails(makeMagicienCls(), spells, racialGrants, {}) as {
        cantrips: { refId: string }[];
        spells: { refId: string }[];
      };
      expect(details.cantrips.length).toBe(3); // 3 quota, dédupliqués avec le don racial
      expect(details.cantrips.map((c) => c.refId)).toContain('spl-lueur');
      expect(details.spells.length).toBe(2);
    });
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
      const result = pickPresetBackgrounds([preset, custom, nonPreset]);
      expect(result.map((b) => b.id)).toEqual(['bg-erudit']);
    });
  });

  // --- Branches supplémentaires --------------------------------------

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

  describe('isFightingStylePool detection (via buildAutoClassSelection)', () => {
    function clsWithPool(pool: Record<string, unknown>): CharacterClass {
      return {
        id: 'cls-test-style',
        name: 'Test',
        data: {
          hit_die: 8,
          primary_abilities: [],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
          features_details: [
            { id: 'feat-style-x', name: 'Style X', desc: '' },
            { id: 'feat-style-y', name: 'Style Y', desc: '' },
          ],
          choice_pools: [pool],
        } as any,
      } as unknown as CharacterClass;
    }

    it('detects a fighting style pool by id/type regex even when type differs', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls = clsWithPool({ id: 'choice-combat-style', type: 'other', pool: ['feat-style-x', 'feat-style-y'] });
      const { selection } = buildAutoClassSelection(cls, 1);
      // Reconnu comme style de combat -> pioché en feature directement (pas de choix générique restant).
      expect(selection.classFeatures.some((f) => (f.refId ?? '').startsWith('feat-style-'))).toBeTrue();
    });

    it('detects a fighting style pool via feature_option type with a style/combat/fighting keyword', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls = clsWithPool({ id: 'choice-fighting-thing', type: 'feature_option', pool: ['feat-style-x', 'feat-style-y'] });
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.classFeatures.some((f) => (f.refId ?? '').startsWith('feat-style-'))).toBeTrue();
    });

    it('does not treat an unrelated feature_option pool as a fighting style', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls = clsWithPool({ id: 'choice-autre', type: 'feature_option', pool: ['feat-style-x'] });
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.classFeatures.length).toBe(0);
    });

    it('returns no combat style feature when the class declares no fighting-style pool at all', () => {
      const cls = clsWithPool({ id: 'choice-langue', type: 'language_proficiency', pool: ['lang-category-exotique'] });
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.classFeatures.length).toBe(0);
    });
  });

  describe('buildAutoClassSelection — cas additionnels', () => {
    it('returns no subclass for a class with no subclasses field at all', () => {
      const cls: CharacterClass = {
        id: 'cls-sans-sous-classe',
        name: 'Sans sous-classe',
        data: {
          hit_die: 8,
          primary_abilities: ['Force'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [],
          features_details: [],
          choice_pools: [],
        } as any,
      } as unknown as CharacterClass;
      const { selection } = buildAutoClassSelection(cls, 5);
      expect(selection.subclassId).toBeUndefined();
    });

    it('treats a raw subclasses array as unlocked from level 1', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls: CharacterClass = {
        id: 'cls-array-subclasses',
        name: 'Array',
        data: {
          hit_die: 8,
          primary_abilities: ['Force'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [],
          features_details: [],
          choice_pools: [],
          subclasses: [{ id: 'subcls-a', name: 'A', features: [] }],
        } as any,
      } as unknown as CharacterClass;
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.subclassId).toBe('subcls-a');
    });

    it('skips sub_choices not yet unlocked at the target level and with an empty option list', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls: CharacterClass = {
        id: 'cls-sub-choices',
        name: 'Test',
        data: {
          hit_die: 8,
          primary_abilities: ['Sagesse'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
          features_details: [],
          choice_pools: [],
          subclasses: {
            unlocked_at_level: 1,
            options: [
              {
                id: 'subcls-x',
                name: 'X',
                features: [],
                sub_choices: [
                  { id: 'choice-tardif', type: 'single_select', level_required: 3, options: ['a', 'b'] },
                  { id: 'choice-vide', type: 'single_select', level_required: 1, options: [] },
                ],
              },
            ],
          },
        } as any,
      } as unknown as CharacterClass;
      const { classChoiceAnswers } = buildAutoClassSelection(cls, 1);
      expect(classChoiceAnswers['choice-tardif']).toBeUndefined();
      expect(classChoiceAnswers['choice-vide']).toBeUndefined();
    });

    it('resolves a sub_choice pick that matches an actual class feature (not just a label fallback)', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const cls: CharacterClass = {
        id: 'cls-sub-choice-feat',
        name: 'Test',
        data: {
          hit_die: 8,
          primary_abilities: ['Sagesse'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [{ level: 1, prof_bonus: 2, features: [], resources: {} }],
          features_details: [
            { id: 'dom-vie', name: 'Domaine de la vie', desc: 'Soins.', level: 1, recharge: 'long_rest', uses: { base: 1 } },
          ],
          choice_pools: [],
          subclasses: {
            unlocked_at_level: 1,
            options: [
              {
                id: 'subcls-x',
                name: 'X',
                features: [],
                sub_choices: [{ id: 'choice-domaine', type: 'single_select', level_required: 1, options: ['dom-vie'] }],
              },
            ],
          },
        } as any,
      } as unknown as CharacterClass;
      const { extraFeatures } = buildAutoClassSelection(cls, 1);
      const feat = extraFeatures.find((f) => f.refId === 'dom-vie');
      expect(feat?.name).toBe('Domaine de la vie');
      expect(feat?.uses).toEqual({ max: 1, current: 1, recharge: 'long_rest' });
    });

    it('returns null for an unknown feature id and reads explicit hp_at_level_1 / hp_per_level_average overrides', () => {
      const cls: CharacterClass = {
        id: 'cls-hp-explicite',
        name: 'Test',
        data: {
          hit_die: 12,
          hp_at_level_1: 14,
          hp_per_level_average: 8,
          primary_abilities: ['Force'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [{ level: 1, prof_bonus: 2, features: ['feat-inconnu'], resources: {} }],
          features_details: [],
          choice_pools: [],
        } as any,
      } as unknown as CharacterClass;
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.hpAtLevel1).toBe(14);
      expect(selection.hpPerLevelAverage).toBe(8);
      expect(selection.classFeatures).toEqual([]); // feat-inconnu introuvable -> ignoré
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

  describe('branches restantes (defaults / cas limites)', () => {
    it('isFightingStylePool handles pools with no id/type keys at all', () => {
      const cls: CharacterClass = {
        id: 'cls-sans-cle',
        name: 'Test',
        data: {
          hit_die: 8,
          primary_abilities: [],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [],
          features_details: [],
          choice_pools: [{ pool: ['feat-x'] }],
        } as any,
      } as unknown as CharacterClass;
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.classFeatures).toEqual([]);
    });

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

    it('pickAutoSubclass returns null when the subclasses payload has no options array', () => {
      const cls: CharacterClass = {
        id: 'cls-souscls-vide',
        name: 'Test',
        data: {
          hit_die: 8,
          primary_abilities: ['Force'],
          proficiencies: { armor: [], weapons: [], tools: [], saving_throws: [], skills: { count: 0, options: [] } },
          starting_equipment: [],
          progression: [],
          features_details: [],
          choice_pools: [],
          subclasses: { unlocked_at_level: 1 },
        } as any,
      } as unknown as CharacterClass;
      const { selection } = buildAutoClassSelection(cls, 1);
      expect(selection.subclassId).toBeUndefined();
    });

    it('resolveCatalogItem falls back to an empty category when a mastered-choice weapon has no matching proficiencies', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const result = buildAutoEquipment(
        [{ slot: 1, fixed: [{ id: 'wp-mastered-choice', qty: 1 }] }],
        [{ id: 'wp-dague', name: 'Dague', type: 'WEAPON', subtype: 'SIMPLE_MELEE', cost: { v: 2, u: 'po' }, wKg: 0.5, data: {} }],
        [], // aucune maîtrise martiale -> aucun item ne matche
        [],
      );
      expect(result).toEqual([]);
    });

    it('resolveCatalogItem falls back to an unresolved equipment id when no catalog entry matches', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const result = buildAutoEquipment(
        [{ slot: 1, fixed: [{ id: 'wp-inexistant', qty: 1 }] }],
        [{ id: 'wp-dague', name: 'Dague', type: 'WEAPON', subtype: 'SIMPLE_MELEE', cost: { v: 2, u: 'po' }, wKg: 0.5, data: {} }],
        [],
        [],
      );
      expect(result).toEqual([]);
    });

    it('autoResolveClassProficiencies returns empty results for a class with no deferred choices', () => {
      const cls = makePretreLikeCls();
      const res = autoResolveClassProficiencies(cls, [], [], [], []);
      expect(res.weapons).toEqual([]);
      expect(res.tools).toEqual([]);
      expect(res.answers).toEqual({});
    });
  });

  describe('buildAutoSpellcastingDetails — cas additionnels', () => {
    it('picks a random racial cantrip from the pool when no explicit species choice answer exists', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const spells: Spell[] = [
        { id: 'spl-lueur', name: 'Lueur', level: 0, description: '', classes: ['cls-magicien'] } as unknown as Spell,
      ];
      const racialGrants = [
        { choiceId: 'elf-cantrip', label: '', desc: '', pool: ['spl-lueur'], spellLevel: 0, spellcastingAbility: 'Intelligence' },
      ];
      const details = buildAutoSpellcastingDetails(makeMagicienCls(), spells, racialGrants, {}) as {
        cantrips: { refId: string }[];
      };
      expect(details.cantrips.map((c) => c.refId)).toContain('spl-lueur');
    });
  });

  describe('buildAutoEquipment — armor ac fallbacks', () => {
    it('uses ac_base when ac is missing and defaults heavy armor to 10', () => {
      const catalog: EquipmentCatalogItem[] = [
        {
          id: 'ar-plate',
          name: 'Armure de plates',
          type: 'ARMOR',
          subtype: 'HEAVY',
          cost: { v: 0, u: 'po' },
          wKg: 0,
          data: { ac_base: 18, dex_modifier: false },
        },
        {
          id: 'ar-weird',
          name: 'Armure étrange',
          type: 'ARMOR',
          subtype: 'LIGHT',
          cost: { v: 0, u: 'po' },
          wKg: 0,
          data: {},
        },
      ];
      const withBase = buildAutoEquipment(
        [{ slot: 1, fixed: [{ id: 'ar-plate', qty: 1 }] }],
        catalog,
        [],
        [],
      );
      expect((withBase[0].customData as Record<string, unknown>)['ac']).toBe(18);

      const defaulted = buildAutoEquipment(
        [{ slot: 1, fixed: [{ id: 'ar-weird', qty: 1 }] }],
        catalog,
        [],
        [],
      );
      expect((defaulted[0].customData as Record<string, unknown>)['ac']).toBe(10);
    });
  });

  describe('buildAutoClassSelection — Lettré feature_selection dedup', () => {
    it('deduplicates fixed astuces across feature_selection pools', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const { classChoiceAnswers, extraFeatures } = buildAutoClassSelection(createLettreClass(), 5);
      expect(classChoiceAnswers['choice-astuces-initial-cls-lettre']?.length).toBe(2);
      expect(extraFeatures.some((f) => f.refId === 'feat-astuce-empressement')).toBeTrue();
    });
  });

  describe('buildAutoSpellcastingDetails — paladin oath spells', () => {
    it('includes subclass oath spell grants for paladins', () => {
      spyOn(Math, 'random').and.returnValue(0);
      const paladin = {
        id: 'cls-paladin',
        name: 'Paladin',
        data: {
          spellcasting: { type: 'prepared', ability: 'cha', prepared_formula: 'cha_mod + floor(paladin_level / 2)' },
          progression: [{ level: 5, resources: {} }],
          subclasses: {
            options: [
              {
                id: 'subcls-serment-de-devotion',
                bonus_spells_granted: [{ level_unlocked: 5, spells: ['spl-protection'] }],
              },
            ],
          },
        },
      } as unknown as CharacterClass;
      const spells: Spell[] = [
        { id: 'spl-protection', name: 'Protection', level: 1, description: '', classes: ['cls-paladin'] } as unknown as Spell,
      ];
      const details = buildAutoSpellcastingDetails(
        paladin,
        spells,
        [],
        {},
        { charisme: 2 },
        { level: 5, subclassId: 'subcls-serment-de-devotion' },
      ) as { oathSpells?: { spells: string[] }[] };
      expect(details.oathSpells?.length).toBe(1);
      expect(details.oathSpells?.[0].spells).toContain('Protection');
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
});
