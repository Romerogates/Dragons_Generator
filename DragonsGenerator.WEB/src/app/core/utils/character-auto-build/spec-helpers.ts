export type { CharacterClass } from '@core/models/CharacterClasses/character-class';
export type { Species } from '@core/models/Species/species';
export type { Background } from '@core/models/Backgrounds/background';
export type { Civilisation } from '@core/models/Civilisations/civilisations';
export type { Language } from '@core/models/Languages/language';
export type { Spell } from '@core/models/Spells/spell';
export type { Skill } from '@core/models/Skills/skill';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Species } from '@core/models/Species/species';
import type { Background } from '@core/models/Backgrounds/background';
import type { Civilisation } from '@core/models/Civilisations/civilisations';
import type { Skill } from '@core/models/Skills/skill';
import { type EquipmentCatalogItem } from '../character-auto-build.util';
export type { EquipmentCatalogItem };
export { createLettreClass } from '../../../../testing/lettre-fixtures';
export {
  equipmentDescription,
  equipmentStatLines,
  equipmentSubtypeLabel,
  equipmentSummaryText,
  equipmentTypeLabel,
} from '../equipment-display.util';
export {
  evaluatePreparedFormula,
  resolveSpellQuota,
  spellPickCount,
} from '../spell-quota.util';
export { extractSubclassBonusSpells } from '../subclass-bonus-spells.util';
export {
  featAsiAbilityOptions,
  featAsiNeedsAbilityChoice,
  featBonusArmorProficiencies,
  featBonusToolProficiencies,
  featDarkvisionRadius,
  featFlexiblePointsTotal,
  featIsFlexiblePoints,
  featNeedsResistanceChoice,
  featResistanceOptions,
  isTalentSpendComplete,
  resolveFeatAsiAbilityKey,
  talentSpendsTotalCost,
} from '../feat-benefits.util';

// --- Fixtures -----------------------------------------------------------

export function makeGuerrierCls(): CharacterClass {
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
    },
  };
}

export function makeMagicienCls(): CharacterClass {
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
    },
  };
}

export function makePretreLikeCls(): CharacterClass {
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
    },
  };
}

export function makeElfSpecies(): Species {
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
  };
}

export function makeDrakeideLikeSpecies(): Species {
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
  };
}

export function makeCivilisation(): Civilisation {
  return {
    id: 'civ-ajagar',
    name: 'Ajagar',
    randomization: { diceMin: 1, diceMax: 6 },
    demographics: {
      primarySpecies: [],
      secondarySpecies: [],
      isCosmopolitan: false,
      cosmopolitanZones: [],
      socialRoles: [],
    },
    linguistics: {
      officialLanguages: [{ id: 'lg-commun', label: 'Commun' }],
      additionalLanguagesSpoken: true,
      writingSystems: [{ id: 'ws-runique', label: 'Runique' }],
    },
    lore: {
      fullDescription: '',
      threatIds: [],
      geographyTags: [],
    },
  };
}

export function makeErudBackground(): Background {
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
            { chooseCount: 1, options: [{ type: 'vehicle' }, { type: 'gameSet', id: 'tl-des' }] },
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
    },
  };
}

export const SKILLS: Skill[] = [
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

export const TOOL_CATALOG: EquipmentCatalogItem[] = [
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

