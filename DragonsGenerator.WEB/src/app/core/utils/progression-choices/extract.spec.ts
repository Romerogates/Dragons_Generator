import { testClass } from '@testing/typed-fixtures';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import {
  classBonusLanguageCount,
  classNeedsAsi,
  classRootRequiredBaseLanguageCount,
  classRootRequiredExoticLanguageCount,
  collectProgressionPicksFromAnswers,
  extractExpertiseChoices,
  extractProgressionChoices,
  extractSubclassSkillProficiencyChoices,
  extractToolProficiencyChoices,
  extractWeaponProficiencyChoices,
  spellProgressionMilestones,
  subclassFixedToolProficiencies,
  warlockArcanumSpellLevels,
} from '../progression-choices.util';
import {
  featureUnlockLevel,
  metamagicOptions,
  optionsFromPoolIds,
  poolActiveAtLevel,
  poolQuantityAtLevel,
  prettyId,
  unlockLevelOf,
} from './shared';

function cls(data: Record<string, unknown>): CharacterClass {
  return testClass({ id: 'cls-test', name: 'Test', data });
}

describe('progression-choices extract / deferred pools', () => {
  it('returns empty when the class has no data payload', () => {
    expect(extractProgressionChoices({ id: 'x', name: 'x', data: undefined }, 1)).toEqual([]);
  });

  it('walks root pools, warlock lines, ASI and deferred skills', () => {
    const c = cls({
      features_details: [
        {
          id: 'feat-metamagie',
          name: 'Métamagie',
          mechanics: {
            metamagic_options: [
              { id: 'meta-soin', name: 'Soin accéléré', effect: 'soigne', cost_arcane_points: 1 },
            ],
          },
        },
        { id: 'feat-fixe', name: 'Fixe', desc: 'toujours' },
      ],
      choice_pools: [
        { id: 'fs', type: 'fighting_style', pool: ['style-a'] },
        { id: 'sk', type: 'skill_proficiency', pool: ['sk-a'] },
        { id: 'ex', type: 'expertise', name: 'Expertise', quantity: 2 },
        {
          id: 'wp',
          type: 'weapon_proficiency',
          pool: ['wp-a'],
          constraint_max_price_po: 12,
        },
        { id: 'tl', type: 'tool_proficiency' },
        {
          id: 'opt',
          type: 'feature_selection',
          name: 'Option',
          pool: [{ id: 'feat-fixe', damage_type: 'fire' }, 0],
          fixed_features: ['feat-fixe'],
          quantity: 1,
        },
        { id: 'style-combat-x', type: 'feature_option', pool: ['s'] },
        {
          id: 'choice-niv-3',
          type: 'feature_selection',
          unlocked_at_levels: [3, 6],
          pool: ['feat-fixe'],
        },
      ],
      progression: [
        {
          level: 1,
          features: [],
          choice_pools_active: [
            { type: 'subclass' },
            { type: 'spell_known', quantity: 1, label: 'Sort connu' },
            { type: 'metamagic', cumulative_total: 2 },
            { type: 'cantrip', quantity: 1, label: 'Tour' },
          ],
          spell_choices: [{ count: 1, label: 'Sort appris' }],
        },
        {
          level: 2,
          invocation_choices: [{ count: 2 }],
          resources: { invocations_known: 3 },
        },
        { level: 3, pact_boon_choices: [{ id: 'choice-pact-boon' }] },
        { level: 4, features: ['feat-asi-niv4'] },
        { level: 6, skill_choices: [{ type: 'expertise', id: 'choice-expertise-6', quantity: 1 }] },
        {
          level: 10,
          level_up_choice_pools: [
            { id: 'choice-terrain', type: 'terrain_preference', name: 'Terrain', pool: ['plaine'] },
            { id: 'from-ref', pool_ref: 'opt', quantity: 1 },
          ],
        },
      ],
    });

    expect(extractProgressionChoices(c, 1).some((x) => x.deferred && x.type === 'weapon_proficiency')).toBeTrue();
    const at20 = extractProgressionChoices(c, 20);
    expect(at20.some((x) => x.type === 'metamagic')).toBeTrue();
    expect(at20.some((x) => x.type === 'invocation')).toBeTrue();
    expect(at20.some((x) => x.type === 'pact_boon')).toBeTrue();
    expect(at20.some((x) => x.type === 'asi')).toBeTrue();
    expect(at20.some((x) => x.deferred && x.type === 'expertise')).toBeTrue();
    expect(at20.some((x) => x.deferred && x.type === 'weapon_proficiency')).toBeTrue();
    expect(classNeedsAsi(c, 20)).toBeTrue();
    expect(extractExpertiseChoices(c, 20).length).toBeGreaterThan(0);

    const picks = collectProgressionPicksFromAnswers(c, 20, {
      'choice-pact-boon': ['pact-boon-chaine'],
      'choice-metamagic-cumulative': ['meta-soin', 'meta-soin', 'extra'],
      'choice-invocations-cumulative': ['invoc-a'],
      opt: ['feat-fixe'],
    });
    expect(picks.pactBoon).toBeTruthy();
    expect(picks.metamagicOptions.length).toBeGreaterThan(0);
  });

  it('reads warlock arcanum and spell milestones', () => {
    expect(warlockArcanumSpellLevels(10)).toEqual([]);
    expect(warlockArcanumSpellLevels(17)).toEqual([6, 7, 8, 9]);
    const c = cls({
      progression: [
        {
          level: 2,
          spell_choices: [{ quantity: 1 }],
          choice_pools_active: [
            { type: 'spell_known', cumulative_total: 2 },
            { type: 'cantrip' },
          ],
        },
      ],
    });
    const miles = spellProgressionMilestones(c, 5);
    expect(miles.length).toBeGreaterThan(0);
    expect(spellProgressionMilestones(cls({}), 1)).toEqual([]);
  });

  it('merges subclass weapon / tool pools and language constraints', () => {
    const c = cls({
      choice_pools: [
        {
          id: 'lang-ex',
          type: 'language_proficiency',
          quantity: 1,
          pool: ['lang-exotic'],
          unlocked_at_level: 1,
        },
        {
          id: 'lang-base',
          type: 'language',
          quantity: 2,
          pool: ['category-common-languages', 'lang-common'],
          unlocked_at_level: 1,
        },
      ],
      subclasses: {
        options: [
          {
            id: 'sub-a',
            choice_pools: [
              {
                id: 'sub-wp',
                type: 'weapon_proficiency',
                pool: ['wp-b'],
                unlocked_at_level: 1,
              },
              {
                id: 'sub-tl',
                type: 'tool_proficiency',
                pool: ['tl-b'],
                unlock_level: 1,
              },
            ],
            features: [
              {
                id: 'feat-spy',
                level: 1,
                mechanics: {
                  grants_tool_proficiency_choice: { pool: ['tl-des'], quantity: 1 },
                  grants_tool_proficiencies: ['tl-necessaire-de-deguisement'],
                  language_bonus: [{ at_level: 1, quantity: 1 }],
                },
              },
            ],
          },
        ],
      },
    });
    expect(extractWeaponProficiencyChoices(c, 3, undefined, 'sub-a').some((x) => x.id === 'sub-wp')).toBeTrue();
    expect(extractToolProficiencyChoices(c, 3, undefined, 'sub-a').length).toBeGreaterThan(0);
    expect(subclassFixedToolProficiencies(c, 3, 'sub-a')).toContain('tl-necessaire-de-deguisement');
    expect(classBonusLanguageCount(c, 3, undefined, 'sub-a')).toBeGreaterThan(0);
    expect(classRootRequiredExoticLanguageCount(c, 1)).toBe(1);
    expect(classRootRequiredBaseLanguageCount(c, 1)).toBe(2);
    expect(extractWeaponProficiencyChoices(c, 1, undefined, null)).toEqual([]);
    expect(extractToolProficiencyChoices(c, 1)).toEqual([]);
    expect(subclassFixedToolProficiencies(c, 1, null)).toEqual([]);
  });
});

describe('progression-choices shared helpers', () => {
  it('resolves unlock levels, pretty ids and pool options', () => {
    expect(unlockLevelOf({ unlocked_at_level: 4 })).toBe(4);
    expect(unlockLevelOf({ level_unlocked: 5 })).toBe(5);
    expect(unlockLevelOf({ unlock_level: 6 })).toBe(6);
    expect(unlockLevelOf({ unlocked_at_levels: [8, 2] })).toBe(2);
    expect(unlockLevelOf({ id: 'choice-lvl7' })).toBe(7);
    expect(unlockLevelOf({ id: 'pack-lv9' })).toBe(9);
    expect(unlockLevelOf({})).toBe(1);
    expect(poolActiveAtLevel({ unlocked_at_levels: [5] }, 4)).toBeFalse();
    expect(poolQuantityAtLevel({ unlocked_at_levels: [1, 5], quantity: 1 }, 5)).toBe(2);
    expect(prettyId('meta-soin').length).toBeGreaterThan(0);
    expect(prettyId('inconnu-xyz').length).toBeGreaterThan(0);
    expect(prettyId('feat-alerte').length).toBeGreaterThan(0);
    expect(optionsFromPoolIds(['missing'], [])[0].id).toBe('missing');
    expect(optionsFromPoolIds([{ name: 'N' }], [])[0].id).toBe('unknown');
    expect(optionsFromPoolIds([0], [])[0].id).toBe('unknown');
    expect(featureUnlockLevel(null)).toBe(1);
    expect(featureUnlockLevel({ unlocks_at_level: 3 })).toBe(3);
    expect(featureUnlockLevel({ level: 'nope' })).toBe(1);
    expect(metamagicOptions(cls({ features_details: [] }))).toEqual([]);
    expect(optionsFromPoolIds(['a'], [{ id: 'a', desc: 'D' }])[0].desc).toBe('D');
    expect(optionsFromPoolIds(['a'], [{ id: 'a', description: 'E' }])[0].desc).toBe('E');
    expect(optionsFromPoolIds(['a'], [{ id: 'a', flavor: { summary: 'S' } }])[0].desc).toBe('S');
    expect(optionsFromPoolIds([{ id: 'a', name: 'Nom' }], [{ id: 'a', desc: 'X' }])[0].name).toBe('Nom');
    expect(extractProgressionChoices(cls({ choice_pools: [] }), 0)).toEqual([]);
    expect(extractProgressionChoices(cls({ choice_pools: [] }), 99, 3)).toEqual([]);
  });
});

describe('progression-choices subclass array + skip empty options', () => {
  it('accepts subclasses as array and skips empty non-deferred pools', () => {
    const c = cls({
      choice_pools: [{ id: 'empty-opt', type: 'feature_selection', pool: [] }],
      subclasses: [
        {
          id: 'sub-arr',
          choice_pools: [
            { id: 'sub-wp', type: 'weapon_proficiency', pool: ['wp-x'], unlocked_at_level: 1 },
            { id: 'not-wp', type: 'language', pool: ['lg-x'] },
            { id: 'later-wp', type: 'weapon_proficiency', unlocked_at_level: 12, pool: ['wp-y'] },
          ],
          features_details: [
            {
              id: 'feat-tools',
              level: 1,
              mechanics: { grants_tool_proficiency_choice: { pool: ['tl-des'], quantity: 2 } },
            },
          ],
        },
      ],
      progression: [
        { level: 1, choice_pools_active: [{ type: 'metamagic', quantity: 2, pool: ['meta-soin'] }] },
        { level: 5, choice_pools_active: [{ type: 'metamagic', cumulative_total: 3, pool: ['meta-soin'] }] },
        { level: 2, invocation_choices: [{ count: 1 }] },
        { level: 3, pact_boon_choices: [{ pool: ['pact-boon-lame'], label: 'Pacte' }] },
        {
          level: 8,
          level_up_choice_pools: [{ id: 'missing-ref', pool_ref: 'nope', pool: ['x'] }],
        },
      ],
    });
    expect(extractProgressionChoices(c, 1).some((x) => x.id === 'empty-opt')).toBeFalse();
    expect(extractWeaponProficiencyChoices(c, 2, undefined, 'sub-arr').some((x) => x.id === 'sub-wp')).toBeTrue();
    expect(extractWeaponProficiencyChoices(c, 2, undefined, 'sub-arr').some((x) => x.id === 'later-wp')).toBeFalse();
    expect(extractToolProficiencyChoices(c, 2, undefined, 'sub-arr').length).toBeGreaterThan(0);
    const at8 = extractProgressionChoices(c, 8);
    expect(at8.filter((x) => x.type === 'metamagic')).toHaveSize(1);
    expect(at8.some((x) => x.type === 'pact_boon')).toBeTrue();
    expect(extractWeaponProficiencyChoices(c, 1, undefined, 'ghost')).toEqual([]);
    expect(extractToolProficiencyChoices(c, 1, undefined, 'ghost')).toEqual([]);
    expect(classBonusLanguageCount(c, 1)).toBe(0);
    expect(classRootRequiredExoticLanguageCount(c, 1)).toBe(0);
  });
});

describe('extractSubclassSkillProficiencyChoices nested pools', () => {
  it('reads choice_pools, choice_pool, mechanics pool and open any grant', () => {
    const c = cls({
      subclasses: {
        options: [
          {
            id: 'sub-sk',
            features: [
              {
                id: 'feat-a',
                level: 1,
                name: 'A',
                choice_pools: [
                  {
                    id: 'p1',
                    type: 'skill_proficiency',
                    quantity: 2,
                    pool: ['sk-acro', 'sk-athl'],
                    expertise_if_already_proficient: true,
                  },
                  { type: 'language' },
                ],
              },
              {
                id: 'feat-b',
                level: 1,
                choice_pool: {
                  id: 'p2',
                  type: 'skill_or_tool_proficiency',
                  options: ['tl-luth'],
                  quantity: 1,
                },
              },
              {
                id: 'feat-c',
                level: 1,
                mechanics: {
                  choice_pool: ['sk-disc'],
                  grant_type: 'proficiency_or_expertise',
                },
              },
              {
                id: 'feat-d',
                name: 'Ouvert',
                level: 1,
                mechanics: { type: 'skill_proficiency_grant', pool: 'any', quantity: 3 },
              },
              {
                id: 'feat-late',
                level: 20,
                choice_pools: [{ type: 'skill_proficiency', pool: ['sk-x'] }],
              },
            ],
          },
        ],
      },
    });
    const pools = extractSubclassSkillProficiencyChoices(c, 5, 'sub-sk');
    expect(pools.some((p) => p.id === 'p1' && p.expertiseIfAlreadyProficient)).toBeTrue();
    expect(pools.some((p) => p.id === 'p2')).toBeTrue();
    expect(pools.some((p) => p.poolIds.includes('sk-disc'))).toBeTrue();
    expect(pools.some((p) => p.isOpenPool)).toBeTrue();
    expect(extractSubclassSkillProficiencyChoices(c, 5, null)).toEqual([]);
    expect(extractSubclassSkillProficiencyChoices(c, 5, 'ghost')).toEqual([]);
  });
});

describe('progression-choices language pool edges', () => {
  it('ignores mixed language pools and late unlocks', () => {
    const c = cls({
      choice_pools: [
        { type: 'language_proficiency', pool: ['lang-exotic', 'any'], quantity: 2, unlocked_at_level: 1 },
        { type: 'equipment', quantity: 1, unlocked_at_level: 1 },
        { type: 'language_proficiency', pool: ['lang-exotic'], quantity: 1, unlocked_at_level: 20 },
        { type: 'language', options: ['lang-exotic'], quantity: 1, unlocked_at_level: 1 },
        { type: 'language_proficiency', pool: 'not-array', quantity: 1, unlocked_at_level: 1 },
      ],
      subclasses: {
        options: [
          {
            id: 'sub-lang',
            features: [
              {
                id: 'feat-lang',
                mechanics: { language_bonus: [{ at_level: 99, quantity: 4 }, { at_level: 1, quantity: 1 }] },
              },
              { id: 'feat-none', mechanics: {} },
            ],
          },
        ],
      },
    });
    expect(classRootRequiredExoticLanguageCount(c, 1)).toBe(1);
    expect(classRootRequiredBaseLanguageCount(c, 1)).toBe(0);
    expect(classBonusLanguageCount(c, 1, undefined, 'sub-lang')).toBeGreaterThan(0);
    expect(classNeedsAsi(c, 20)).toBeFalse();
    expect(extractExpertiseChoices(c, 5)).toEqual([]);
  });
});

describe('extract default labels, duplicates and enemy_type sort', () => {
  it('fills default pool ids/labels and skips a second identical id', () => {
    const c = cls({
      choice_pools: [
        { type: 'weapon_proficiency', pool: ['wp-a'] },
        { type: 'tool_proficiency', pool: ['tl-a'] },
        { type: 'expertise_proficiency' },
        { type: 'enemy_type', pool: ['gob'] },
        { id: 'dup', type: 'feature_selection', pool: ['a'] },
        { id: 'dup', type: 'feature_selection', pool: ['b'] },
        { pool: ['z'] },
        { id: 'combat-style-hidden', type: 'misc', pool: ['s'] },
      ],
    });
    const got = extractProgressionChoices(c, 3);
    expect(got.some((x) => x.id === 'choice-weapon_proficiency')).toBeTrue();
    expect(got.some((x) => x.label === "Maîtrises d'outils")).toBeTrue();
    expect(got.some((x) => x.type === 'enemy_type')).toBeTrue();
    expect(got.filter((x) => x.id === 'dup')).toHaveSize(1);
  });
});

describe('collectProgressionPicksFromAnswers extras', () => {
  it('déduplique les features et accepte un pacte + invocations', () => {
    const c = cls({
      features_details: [],
      choice_pools: [
        {
          id: 'choice-a',
          type: 'feature_selection',
          pool: ['feat-x', 'feat-y'],
          fixed_features: ['feat-x'],
          quantity: 1,
        },
      ],
      progression: [
        { level: 2, invocation_choices: [{ count: 2 }], resources: { invocations_known: 2 } },
        { level: 3, pact_boon_choices: [{ id: 'choice-pact-boon', pool: ['pact-boon-lame'] }] },
      ],
    });
    const got = collectProgressionPicksFromAnswers(c, 5, {
      'choice-a': ['feat-x', 'feat-y', 'feat-z'],
      'choice-pact-boon': ['pact-boon-lame'],
      'choice-invocations-cumulative': ['invoc-a', 'invoc-a'],
    });
    expect(got.pactBoon).toBe('pact-boon-lame');
    expect(got.eldritchInvocations.length).toBeGreaterThan(0);
    expect(got.extraFeatures.filter((f) => f.refId === 'feat-x').length).toBe(1);
  });
});

