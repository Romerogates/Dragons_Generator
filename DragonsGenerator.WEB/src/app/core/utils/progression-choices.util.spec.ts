import {
  subclassBonusProficiencies,
  subclassBonusResistances,
  classBonusSenses,
  classRootSavingThrowGrants,
  extractSubclassSkillProficiencyChoices,
} from './progression-choices.util';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';

function makeCls(subclasses: unknown): CharacterClass {
  return {
    id: 'cls-pretre',
    name: 'Prêtre',
    data: { subclasses } as any,
  } as unknown as CharacterClass;
}

const EMPTY_BONUS = {
  armor: [],
  weapons: [],
  skills: [],
  expertise: [],
  tools: [],
  languages: [],
  savingThrows: [],
  bonusLanguages: 0,
  requiredExoticLanguages: 0,
  conditionalSkills: [],
};

describe('subclassBonusProficiencies', () => {
  it('returns empty result when no subclassId provided', () => {
    const cls = makeCls({ options: [] });
    expect(subclassBonusProficiencies(cls, null)).toEqual(EMPTY_BONUS);
  });

  it('extracts armor + skills bonus from a matching subclass (Domaine de la Force)', () => {
    const cls = makeCls({
      options: [
        {
          id: 'subcls-domaine-de-la-force',
          bonus_proficiencies: {
            weapons: ['category-martial-weapons'],
            skills: ['skill-acrobaties', 'skill-athletisme'],
          },
        },
      ],
    });
    const res = subclassBonusProficiencies(cls, 'subcls-domaine-de-la-force');
    expect(res.weapons).toEqual(['category-martial-weapons']);
    expect(res.skills).toEqual(['skill-acrobaties', 'skill-athletisme']);
    expect(res.armor).toEqual([]);
    expect(res.expertise).toEqual([]);
  });

  it('extracts armor bonus from Domaine de la Vie', () => {
    const cls = makeCls({
      options: [
        {
          id: 'subcls-domaine-de-la-vie',
          bonus_proficiencies: { armor: ['category-heavy-armor'] },
        },
      ],
    });
    expect(subclassBonusProficiencies(cls, 'subcls-domaine-de-la-vie').armor).toEqual([
      'category-heavy-armor',
    ]);
  });

  it('extracts fixed expertise from Domaine du Partage', () => {
    const cls = makeCls({
      options: [
        {
          id: 'subcls-domaine-du-partage',
          bonus_proficiencies: {
            skills: ['skill-persuasion'],
            expertise: ['skill-persuasion'],
          },
        },
      ],
    });
    const res = subclassBonusProficiencies(cls, 'subcls-domaine-du-partage');
    expect(res.skills).toEqual(['skill-persuasion']);
    expect(res.expertise).toEqual(['skill-persuasion']);
  });

  it('returns empty result for a subclass without bonus_proficiencies', () => {
    const cls = makeCls({ options: [{ id: 'subcls-other' }] });
    expect(subclassBonusProficiencies(cls, 'subcls-other')).toEqual(EMPTY_BONUS);
  });

  it('returns empty result when subclass id is not found', () => {
    const cls = makeCls({ options: [{ id: 'subcls-other' }] });
    expect(subclassBonusProficiencies(cls, 'subcls-unknown')).toEqual(EMPTY_BONUS);
  });

  it('extracts nested feature grants (skill, tool, language, saving throw, bonus languages)', () => {
    const cls = makeCls({
      options: [
        {
          id: 'subcls-domaine-du-partage',
          features: [
            {
              id: 'feat-polyglotte',
              level: 3,
              mechanics: { bonus_languages: 3, required_exotic_count: 1 },
            },
            {
              id: 'feat-sacoche',
              level: 3,
              grants_proficiency: 'tl-necessaire-alchimiste',
            },
            {
              id: 'feat-intimidation',
              level: 3,
              grants_proficiency: 'skill-intimidation',
              double_prof_if_already_proficient: true,
            },
            {
              id: 'feat-draconique',
              level: 1,
              mechanics: { grants_language: 'lang-draconique' },
            },
            {
              id: 'feat-esprit-fuyant',
              level: 15,
              mechanics: { grants_saving_throw_proficiency: 'wis' },
            },
            {
              id: 'feat-too-high-level',
              level: 20,
              grants_proficiency: 'skill-histoire',
            },
          ],
        },
      ],
    });
    const res = subclassBonusProficiencies(cls, 'subcls-domaine-du-partage', 15);
    expect(res.tools).toEqual(['tl-necessaire-alchimiste']);
    expect(res.skills).toEqual(['skill-intimidation']);
    expect(res.conditionalSkills).toEqual(['skill-intimidation']);
    expect(res.languages).toEqual(['lang-draconique']);
    expect(res.savingThrows).toEqual(['wis']);
    expect(res.bonusLanguages).toBe(3);
    expect(res.requiredExoticLanguages).toBe(1);
    // Feature de niveau 20 non incluse car level (15) < 20
    expect(res.skills).not.toContain('skill-histoire');
  });

  it('does not double-count nested grants when features and features_details both exist', () => {
    const rawFeature = {
      id: 'feat-polyglotte',
      unlocks_at_level: 3,
      mechanics: { bonus_languages: 3, required_exotic_count: 1 },
    };
    const cls = makeCls({
      options: [
        {
          id: 'subcls-domaine-du-partage',
          // Simule le spread `...sub` de l'adapter qui laisse `features_details` brut
          // en plus de `features` déjà normalisé.
          features: [{ ...rawFeature, level: 3 }],
          features_details: [rawFeature],
        },
      ],
    });
    const res = subclassBonusProficiencies(cls, 'subcls-domaine-du-partage', 20);
    expect(res.bonusLanguages).toBe(3);
    expect(res.requiredExoticLanguages).toBe(1);
  });
});

describe('subclassBonusResistances', () => {
  function makeClsWithFeature(feature: unknown): CharacterClass {
    return {
      id: 'cls-druide',
      name: 'Druide',
      data: {
        subclasses: {
          options: [{ id: 'subcls-cercle-des-esprits', features: [feature] }],
        },
      } as any,
    } as unknown as CharacterClass;
  }

  it('extracts a fixed damage_type resistance (Esprit solide, niv. 6, données API réelles : unlocks_at_level)', () => {
    const cls = makeClsWithFeature({
      id: 'feat-esprit-solide',
      unlocks_at_level: 6,
      mechanics: { resistances: [{ type: 'damage_type', damage_type: 'psychic' }] },
    });
    expect(subclassBonusResistances(cls, 'subcls-cercle-des-esprits', 5)).toEqual([]);
    expect(subclassBonusResistances(cls, 'subcls-cercle-des-esprits', 6)).toEqual(['psychic']);
  });

  it('ignores plain-string conditional resistances (ex. Rage) and returns [] without subclass', () => {
    const cls = makeClsWithFeature({
      id: 'feat-fougue',
      unlocks_at_level: 1,
      mechanics: { resistances: ['bludgeoning', 'piercing', 'slashing'] },
    });
    expect(subclassBonusResistances(cls, 'subcls-cercle-des-esprits', 20)).toEqual([]);
    expect(subclassBonusResistances(cls, null, 20)).toEqual([]);
  });
});

describe('classRootSavingThrowGrants', () => {
  it('returns saving throws granted by a root class feature unlocked at the target level (données API réelles : unlocks_at_level)', () => {
    // Forme réelle de l'API (cls-roublard.json "Esprit fuyant") : le champ s'appelle
    // `unlocks_at_level`, pas `level`. Sans fallback, ce bonus s'appliquait dès le niveau 1.
    const cls: CharacterClass = {
      id: 'cls-roublard',
      name: 'Roublard',
      data: {
        features_details: [
          {
            id: 'feat-esprit-fuyant',
            unlocks_at_level: 15,
            mechanics: { grants_saving_throw_proficiency: 'wis' },
          },
        ],
      } as any,
    } as unknown as CharacterClass;

    expect(classRootSavingThrowGrants(cls, 1)).toEqual([]);
    expect(classRootSavingThrowGrants(cls, 14)).toEqual([]);
    expect(classRootSavingThrowGrants(cls, 15)).toEqual(['wis']);
  });

  it('still supports a pre-normalized `level` field', () => {
    const cls: CharacterClass = {
      id: 'cls-roublard',
      name: 'Roublard',
      data: {
        features_details: [
          { id: 'feat-esprit-fuyant', level: 15, mechanics: { grants_saving_throw_proficiency: 'wis' } },
        ],
      } as any,
    } as unknown as CharacterClass;

    expect(classRootSavingThrowGrants(cls, 14)).toEqual([]);
    expect(classRootSavingThrowGrants(cls, 15)).toEqual(['wis']);
  });
});

describe('classBonusSenses', () => {
  it('reads blindsight from a root class feature (Rôdeur "Perception sauvage", niv. 18, unlocks_at_level)', () => {
    const cls: CharacterClass = {
      id: 'cls-rodeur',
      name: 'Rôdeur',
      data: {
        features_details: [
          {
            id: 'feat-perception-sauvage',
            unlocks_at_level: 18,
            mechanics: { blindsight_radius_m: 9 },
          },
        ],
      } as any,
    } as unknown as CharacterClass;

    expect(classBonusSenses(cls, null, 17)).toEqual({
      darkvisionRadius: 0,
      hasBlindsight: false,
      blindsightRadius: 0,
    });
    expect(classBonusSenses(cls, null, 18)).toEqual({
      darkvisionRadius: 0,
      hasBlindsight: true,
      blindsightRadius: 9,
    });
  });

  it('reads darkvision from a subclass feature (Rôdeur Ombre urbaine "Ombre mouvante", niv. 7)', () => {
    const cls: CharacterClass = {
      id: 'cls-rodeur',
      name: 'Rôdeur',
      data: {
        subclasses: {
          options: [
            {
              id: 'subcls-ombre-urbaine',
              features: [
                {
                  id: 'feat-ombre-mouvante',
                  unlocks_at_level: 7,
                  mechanics: { darkvision_radius_m: 18 },
                },
              ],
            },
          ],
        },
      } as any,
    } as unknown as CharacterClass;

    expect(classBonusSenses(cls, 'subcls-ombre-urbaine', 6).darkvisionRadius).toBe(0);
    expect(classBonusSenses(cls, 'subcls-ombre-urbaine', 7).darkvisionRadius).toBe(18);
    expect(classBonusSenses(cls, null, 20).darkvisionRadius).toBe(0);
  });

  it('reads a `sense_type: blindsight` root feature (Roublard "Perception aveugle", niv. 14)', () => {
    const cls: CharacterClass = {
      id: 'cls-roublard',
      name: 'Roublard',
      data: {
        features_details: [
          {
            id: 'feat-perception-aveugle-cls-roublard',
            unlocks_at_level: 14,
            mechanics: { sense_type: 'blindsight', range_m: 3 },
          },
        ],
      } as any,
    } as unknown as CharacterClass;

    expect(classBonusSenses(cls, null, 13).hasBlindsight).toBe(false);
    expect(classBonusSenses(cls, null, 14)).toEqual({
      darkvisionRadius: 0,
      hasBlindsight: true,
      blindsightRadius: 3,
    });
  });

  it('only counts a choice-option sense grant (Rôdeur "Œil des profondeurs", niv. 15) if it was picked', () => {
    const cls: CharacterClass = {
      id: 'cls-rodeur',
      name: 'Rôdeur',
      data: {
        subclasses: {
          options: [
            {
              id: 'subcls-traqueur',
              features: [
                {
                  id: 'feat-oeil-des-profondeurs',
                  unlocks_at_level: 15,
                  mechanics: {
                    choice_quantity: 1,
                    options: [
                      { id: 'oeil-critique-redondant', name: 'Critique redondant' },
                      { id: 'oeil-vision-aveugle', name: 'Vision aveugle', blindsight_radius_m: 18 },
                    ],
                  },
                },
              ],
            },
          ],
        },
      } as any,
    } as unknown as CharacterClass;

    expect(classBonusSenses(cls, 'subcls-traqueur', 15, []).hasBlindsight).toBe(false);
    expect(classBonusSenses(cls, 'subcls-traqueur', 15, ['oeil-critique-redondant']).hasBlindsight).toBe(
      false,
    );
    expect(
      classBonusSenses(cls, 'subcls-traqueur', 15, ['oeil-vision-aveugle']),
    ).toEqual({ darkvisionRadius: 0, hasBlindsight: true, blindsightRadius: 18 });
  });
});

describe('extractSubclassSkillProficiencyChoices', () => {
  function makeClsWithFeature(feature: unknown): CharacterClass {
    return {
      id: 'cls-rodeur',
      name: 'Rôdeur',
      data: {
        subclasses: {
          options: [{ id: 'subcls-ombre-urbaine', features: [feature] }],
        },
      } as any,
    } as unknown as CharacterClass;
  }

  it('extracts a skill_or_tool_proficiency pool nested in choice_pools', () => {
    const cls = makeClsWithFeature({
      id: 'feat-connaissance-de-la-rue',
      level: 3,
      choice_pools: [
        {
          id: 'choice-competences-ombre-urbaine-lv3',
          name: 'Connaissance de la rue : maîtrises',
          type: 'skill_or_tool_proficiency',
          quantity: 2,
          expertise_if_already_proficient: true,
          pool: ['skill-acrobaties', 'skill-discretion', 'tl-outils-de-voleur'],
        },
      ],
    });
    const res = extractSubclassSkillProficiencyChoices(cls, 3, 'subcls-ombre-urbaine');
    expect(res).toEqual([
      {
        id: 'choice-competences-ombre-urbaine-lv3',
        label: 'Connaissance de la rue : maîtrises',
        count: 2,
        poolIds: ['skill-acrobaties', 'skill-discretion', 'tl-outils-de-voleur'],
        expertiseIfAlreadyProficient: true,
      },
    ]);
  });

  it('extracts a single choice_pool object (Lettré style)', () => {
    const cls = makeClsWithFeature({
      id: 'feat-aisance-sociale',
      level: 3,
      grants_proficiency: 'skill-intuition',
      choice_pool: {
        id: 'choice-aisance-sociale-subcls-lettre',
        type: 'skill_proficiency',
        quantity: 2,
        pool: ['skill-intimidation', 'skill-persuasion'],
      },
    });
    const res = extractSubclassSkillProficiencyChoices(cls, 3, 'subcls-ombre-urbaine');
    expect(res.length).toBe(1);
    expect(res[0].poolIds).toEqual(['skill-intimidation', 'skill-persuasion']);
    expect(res[0].expertiseIfAlreadyProficient).toBe(false);
  });

  it('extracts a mechanics.choice_pool array (Paladin style)', () => {
    const cls = makeClsWithFeature({
      id: 'feat-justicier-des-ombres',
      level: 3,
      mechanics: {
        grant_type: 'proficiency_or_expertise',
        choice_pool: ['skill-discretion', 'skill-investigation'],
      },
    });
    const res = extractSubclassSkillProficiencyChoices(cls, 3, 'subcls-ombre-urbaine');
    expect(res).toEqual([
      {
        id: 'choice-skill-feat-justicier-des-ombres',
        label: 'Compétence au choix',
        count: 1,
        poolIds: ['skill-discretion', 'skill-investigation'],
        expertiseIfAlreadyProficient: true,
      },
    ]);
  });

  it('ignores features above the requested level and returns [] without a subclass id', () => {
    const cls = makeClsWithFeature({
      id: 'feat-connaissance-de-la-rue',
      level: 7,
      choice_pool: { id: 'x', type: 'skill_proficiency', quantity: 1, pool: ['skill-acrobaties'] },
    });
    expect(extractSubclassSkillProficiencyChoices(cls, 3, 'subcls-ombre-urbaine')).toEqual([]);
    expect(extractSubclassSkillProficiencyChoices(cls, 20, null)).toEqual([]);
  });
});
