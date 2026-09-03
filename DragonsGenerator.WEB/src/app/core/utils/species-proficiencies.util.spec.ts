import type { Species, Subspecies, Trait } from '@core/models/Species/species';
import {
  resolveLineageDamageType,
  speciesResistancesFromTraits,
  speciesTraitBonusProficiencies,
} from './species-proficiencies.util';

describe('speciesTraitBonusProficiencies', () => {
  it('extracts skill/weapon/armor/tool grants and normalizes ids', () => {
    const traits: Trait[] = [
      {
        id: 't1',
        name: 'Sens aiguisés',
        desc: '',
        mechanics: { type: 'skill_proficiency', grants: ['skill-perception'] },
      },
      {
        id: 't2',
        name: 'Formation martiale',
        desc: '',
        mechanics: { type: 'weapon_proficiency', grants: ['hachette', 'wp-arc-court'] },
      },
      {
        id: 't3',
        name: 'Gardien',
        desc: '',
        mechanics: { type: 'armor_proficiency', grants: ['bouclier', 'ar-cotte-de-mailles'] },
      },
      {
        id: 't4',
        name: 'Bricoleur',
        desc: '',
        mechanics: { type: 'crafting_ability', tool_proficiency_granted: 'tl-outils-de-retameur' },
      },
    ];
    const result = speciesTraitBonusProficiencies(traits);
    expect(result.skills).toEqual(['skill-perception']);
    expect(result.weapons).toEqual(['wp-hachette', 'wp-arc-court']);
    expect(result.armor).toEqual(['ar-bouclier', 'ar-cotte-de-mailles']);
    expect(result.tools).toEqual(['tl-outils-de-retameur']);
  });

  it('returns empty arrays when no mechanics present', () => {
    const traits: Trait[] = [{ id: 't1', name: 'Flavor only', desc: '' }];
    const result = speciesTraitBonusProficiencies(traits);
    expect(result).toEqual({ skills: [], weapons: [], armor: [], tools: [] });
  });

  it('ignores unrelated mechanics types', () => {
    const traits: Trait[] = [
      { id: 't1', name: 'X', desc: '', mechanics: { type: 'darkvision', range_m: 18 } },
    ];
    expect(speciesTraitBonusProficiencies(traits)).toEqual({
      skills: [],
      weapons: [],
      armor: [],
      tools: [],
    });
  });
});

describe('resolveLineageDamageType', () => {
  const species = {
    creationChoices: [
      {
        id: 'choice-lignee-draconique',
        name: '',
        desc: '',
        type: 'single_select',
        options: [{ id: 'drag-rouge', name: 'Rouge', damage_type: 'damage-feu' }, 'drag-bleu'],
      },
    ],
  } as unknown as Species;

  it('resolves the damage type for a matching lineage option', () => {
    expect(resolveLineageDamageType(species, null, 'drag-rouge')).toBe('damage-feu');
  });

  it('returns null when lineage id is missing', () => {
    expect(resolveLineageDamageType(species, null, undefined)).toBeNull();
  });

  it('returns null when species is missing', () => {
    expect(resolveLineageDamageType(null, null, 'drag-rouge')).toBeNull();
  });

  it('returns null when no matching choice exists', () => {
    const empty = { creationChoices: [] } as unknown as Species;
    expect(resolveLineageDamageType(empty, null, 'drag-rouge')).toBeNull();
  });

  it('returns null when option has no damage_type', () => {
    expect(resolveLineageDamageType(species, null, 'drag-bleu')).toBeNull();
  });

  it('falls back to subspecies creation choices', () => {
    const sub = {
      creationChoices: [
        {
          id: 'choice-heritage-draconique',
          name: '',
          desc: '',
          type: 'single_select',
          options: [{ id: 'drag-vert', name: 'Vert', damage_type: 'damage-poison' }],
        },
      ],
    } as unknown as Subspecies;
    const emptySpecies = { creationChoices: [] } as unknown as Species;
    expect(resolveLineageDamageType(emptySpecies, sub, 'drag-vert')).toBe('damage-poison');
  });
});

describe('speciesResistancesFromTraits', () => {
  const species = {
    creationChoices: [
      {
        id: 'choice-lignee-draconique',
        name: '',
        desc: '',
        type: 'single_select',
        options: [{ id: 'drag-rouge', name: 'Rouge', damage_type: 'damage-feu' }],
      },
    ],
  } as unknown as Species;

  it('collects plain string resistances', () => {
    const traits: Trait[] = [
      { id: 't1', name: '', desc: '', mechanics: { damage_resistance: ['damage-feu'] } },
    ];
    expect(speciesResistancesFromTraits(traits, species, null, undefined)).toEqual(['damage-feu']);
  });

  it('resolves damage-from-lineage placeholders via the chosen lineage', () => {
    const traits: Trait[] = [
      { id: 't1', name: '', desc: '', mechanics: { resistances: ['damage-from-lineage'] } },
    ];
    expect(speciesResistancesFromTraits(traits, species, null, 'drag-rouge')).toEqual(['damage-feu']);
  });

  it('resolves type=damage_resistance with damage_type_from=heritage_draconique', () => {
    const traits: Trait[] = [
      {
        id: 't1',
        name: '',
        desc: '',
        mechanics: { type: 'damage_resistance', damage_type_from: 'heritage_draconique' },
      },
    ];
    expect(speciesResistancesFromTraits(traits, species, null, 'drag-rouge')).toEqual(['damage-feu']);
  });

  it('dedupes and skips traits without mechanics', () => {
    const traits: Trait[] = [
      { id: 't1', name: '', desc: '' },
      { id: 't2', name: '', desc: '', mechanics: { damage_resistance: ['damage-feu', 'damage-feu'] } },
    ];
    expect(speciesResistancesFromTraits(traits, species, null, undefined)).toEqual(['damage-feu']);
  });
});
