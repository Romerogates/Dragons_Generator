import type {
  Background,
  BackgroundData,
  BackgroundEquipment,
  BackgroundProficiencies,
  PersonalityTables,
} from '@core/models/Backgrounds/background';
import type { BaseStats, Species, Subspecies } from '@core/models/Species/species';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import type { Character, CharacterCreation } from '@core/models/Character/character';
import type { CharacterFixtureOverrides } from './character-fixtures';
import type { CharacterClass, CharacterClassData } from '@core/models/CharacterClasses/character-class';
import type { Language } from '@core/models/Languages/language';
import type { Skill } from '@core/models/Skills/skill';
import type { Spell } from '@core/models/Spells/spell';
import { createMinimalCharacter } from './character-fixtures';

export const EMPTY_CLASS_DATA: CharacterClassData = {
  hit_die: 8,
  primary_abilities: [],
  proficiencies: {
    armor: [],
    weapons: [],
    tools: [],
    saving_throws: [],
    skills: { count: 0, options: [] },
  },
  starting_equipment: [],
  progression: [],
  features_details: [],
};

export function testClass(
  over: Partial<Omit<CharacterClass, 'data'>> & { data?: Partial<CharacterClassData> } = {},
): CharacterClass {
  return {
    id: over.id ?? 'cls-test',
    name: over.name ?? 'Test',
    data: { ...EMPTY_CLASS_DATA, ...over.data },
  };
}

export function testSpell(over: Partial<Spell> & Pick<Spell, 'id' | 'name'>): Spell {
  return {
    level: 0,
    school: 'évocation',
    castingTime: { amount: 1, unit: 'action' },
    range: { amount: 0, unit: 'm' },
    duration: { amount: null, unit: null },
    components: { v: true, s: false, m: null },
    isRitual: false,
    isConcentration: false,
    isCorrupted: false,
    description: '',
    modularOptions: [],
    classes: [],
    ...over,
  };
}

export function testLanguage(over: Partial<Language> & Pick<Language, 'id' | 'name'>): Language {
  return {
    category: 'base',
    linguistics: { writingSystems: [], isOralOnly: false },
    speakers: { primary: [], regions: [] },
    lore: { fullDescription: '' },
    ...over,
  };
}

export function testSkill(over: Partial<Skill> & Pick<Skill, 'id' | 'name'>): Skill {
  return {
    ability: 'int',
    description: '',
    examples: [],
    passiveCheck: false,
    ...over,
  };
}

export function testCharacter(over: CharacterFixtureOverrides = {}): Character {
  return createMinimalCharacter(over);
}

export function testCreation(over: Partial<CharacterCreation> = {}): CharacterCreation {
  return { ...INITIAL_CREATION_STATE, ...over };
}

const EMPTY_BG_DATA: BackgroundData = {
  preset: false,
  source: { book: '', pages: '' },
  flavor: { summary: '', adventureHook: null },
  proficiencies: {
    skills: { chooseCount: 0, options: [] },
    tools: { fixed: [], choose: [] },
    languages: { choiceCount: 0 },
  },
  equipment: { fixed: [], currency: { or: 0 } },
  privilege: { id: null, name: null, desc: null },
  personalityTables: null,
};

export function testBackground(
  over: Partial<Omit<Background, 'data'>> & {
    data?: Omit<Partial<BackgroundData>, 'proficiencies' | 'equipment' | 'personalityTables'> & {
      proficiencies?: Partial<BackgroundProficiencies> & {
        skills?: Partial<BackgroundProficiencies['skills']>;
        tools?: Partial<BackgroundProficiencies['tools']>;
      };
      equipment?: Partial<BackgroundEquipment>;
      personalityTables?: PersonalityTables | null;
    };
  } = {},
): Background {
  return {
    id: over.id ?? 'bg-test',
    name: over.name ?? 'Test',
    data: {
      ...EMPTY_BG_DATA,
      ...over.data,
      proficiencies: {
        ...EMPTY_BG_DATA.proficiencies,
        ...over.data?.proficiencies,
        skills: {
          ...EMPTY_BG_DATA.proficiencies.skills,
          ...over.data?.proficiencies?.skills,
        },
        tools: {
          ...EMPTY_BG_DATA.proficiencies.tools,
          ...over.data?.proficiencies?.tools,
        },
        languages:
          over.data?.proficiencies?.languages ?? EMPTY_BG_DATA.proficiencies.languages,
      },
      equipment: {
        ...EMPTY_BG_DATA.equipment,
        ...over.data?.equipment,
      },
      personalityTables:
        over.data && 'personalityTables' in over.data
          ? over.data.personalityTables ?? null
          : EMPTY_BG_DATA.personalityTables,
    },
  };
}

export function testSubspecies(over: Partial<Subspecies> = {}): Subspecies {
  return {
    id: 'sub-test',
    name: 'Sous-espèce',
    playable: true,
    flavor: '',
    abilityScoreIncrease: {},
    traits: [],
    creationChoices: [],
    ...over,
  };
}

export function testSpecies(
  over: Omit<Partial<Species>, 'baseStats'> & { baseStats?: Partial<BaseStats> } = {},
): Species {
  const { baseStats, ...rest } = over;
  return {
    id: 'spc-test',
    name: 'Espèce test',
    nameAlt: [],
    source: { book: '', pages: '' },
    flavor: { summary: '' },
    optionalRules: [],
    ...rest,
    traits: rest.traits ?? [],
    creationChoices: rest.creationChoices ?? [],
    languages: rest.languages ?? { fixed: [], choiceCount: 0 },
    subspecies: rest.subspecies ?? [],
    baseStats: {
      abilityScoreIncrease: {},
      speedM: 9,
      size: 'M',
      darkvisionM: 0,
      height: { desc: '' },
      weight: { desc: '' },
      age: { maturityYears: 18, lifespanYears: 80, desc: '' },
      alignment: { tendency: '', desc: '' },
      ...baseStats,
    },
  };
}
