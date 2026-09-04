import {
  featAsiAbilityOptions,
  featAsiNeedsAbilityChoice,
  featAsiValue,
  featBonusArmorProficiencies,
  featBonusToolProficiencies,
  featDarkvisionRadius,
  featNeedsResistanceChoice,
  featResistanceOptions,
  resolveFeatAsiAbilityKey,
  type RawFeatData,
} from './feat-benefits.util';

describe('featAsiNeedsAbilityChoice', () => {
  it('is false for a fixed ability code', () => {
    expect(featAsiNeedsAbilityChoice({ ability_score_increase: { ability: 'DEX', value: 1 } })).toBeFalse();
  });

  it('is false for spellcasting', () => {
    expect(
      featAsiNeedsAbilityChoice({ ability_score_increase: { ability: 'spellcasting', value: 1 } }),
    ).toBeFalse();
  });

  it('is true for "any"', () => {
    expect(featAsiNeedsAbilityChoice({ ability_score_increase: { ability: 'any', value: 1 } })).toBeTrue();
  });

  it('is true for a compound "X_or_Y" code', () => {
    expect(
      featAsiNeedsAbilityChoice({ ability_score_increase: { ability: 'CON_or_CHA', value: 1 } }),
    ).toBeTrue();
  });

  it('is false when the feat has no ASI at all', () => {
    expect(featAsiNeedsAbilityChoice(undefined)).toBeFalse();
    expect(featAsiNeedsAbilityChoice({})).toBeFalse();
  });
});

describe('featAsiAbilityOptions', () => {
  it('returns all six abilities for "any"', () => {
    expect(featAsiAbilityOptions({ ability_score_increase: { ability: 'any', value: 1 } }).length).toBe(6);
  });

  it('parses a compound "X_or_Y" code', () => {
    expect(featAsiAbilityOptions({ ability_score_increase: { ability: 'CON_or_CHA', value: 1 } })).toEqual([
      'constitution',
      'charisme',
    ]);
  });

  it('returns empty array when missing', () => {
    expect(featAsiAbilityOptions(undefined)).toEqual([]);
  });
});

describe('resolveFeatAsiAbilityKey', () => {
  it('resolves a fixed ability code directly', () => {
    const feat: RawFeatData = { ability_score_increase: { ability: 'WIS', value: 1 } };
    expect(resolveFeatAsiAbilityKey(feat, null, null)).toBe('sagesse');
  });

  it('resolves "spellcasting" using the class spellcasting ability', () => {
    const feat: RawFeatData = { ability_score_increase: { ability: 'spellcasting', value: 1 } };
    expect(resolveFeatAsiAbilityKey(feat, 'charisme', null)).toBe('charisme');
  });

  it('falls back to the player choice for flexible codes', () => {
    const feat: RawFeatData = { ability_score_increase: { ability: 'any', value: 1 } };
    expect(resolveFeatAsiAbilityKey(feat, null, 'force')).toBe('force');
  });

  it('returns null when there is no ASI on the feat', () => {
    expect(resolveFeatAsiAbilityKey(undefined, null, null)).toBeNull();
  });
});

describe('featAsiValue', () => {
  it('reads the numeric ASI value', () => {
    expect(featAsiValue({ ability_score_increase: { ability: 'DEX', value: 1 } })).toBe(1);
  });

  it('defaults to 0 when missing', () => {
    expect(featAsiValue(undefined)).toBe(0);
  });
});

describe('featDarkvisionRadius', () => {
  it('reads the darkvision benefit range', () => {
    const feat: RawFeatData = { benefits: [{ type: 'darkvision', range_m: 9 }] };
    expect(featDarkvisionRadius(feat)).toBe(9);
  });

  it('returns 0 when no darkvision benefit is present', () => {
    expect(featDarkvisionRadius({ benefits: [{ type: 'advantage_on_check' }] })).toBe(0);
    expect(featDarkvisionRadius(undefined)).toBe(0);
  });
});

describe('featBonusArmorProficiencies', () => {
  it('maps a known armor name to its id', () => {
    const feat: RawFeatData = {
      benefits: [{ type: 'proficiency', proficiency_type: 'armor', value: 'Bouclier' }],
    };
    expect(featBonusArmorProficiencies(feat)).toEqual(['ar-bouclier']);
  });

  it('ignores unknown armor names and non-armor proficiencies', () => {
    const feat: RawFeatData = {
      benefits: [
        { type: 'proficiency', proficiency_type: 'skill', value: 'Dressage' },
        { type: 'proficiency', proficiency_type: 'armor', value: 'Armure inconnue' },
      ],
    };
    expect(featBonusArmorProficiencies(feat)).toEqual([]);
  });

  it('returns empty array when feat has no benefits', () => {
    expect(featBonusArmorProficiencies(undefined)).toEqual([]);
  });
});

describe('featBonusToolProficiencies', () => {
  it('maps a known tool name to its id (ex. Herboriste)', () => {
    const feat: RawFeatData = {
      benefits: [{ type: 'proficiency', proficiency_type: 'tool', value: "nécessaire d'herboristerie" }],
    };
    expect(featBonusToolProficiencies(feat)).toEqual(['tl-necessaire-dherboristerie']);
  });

  it('ignores unknown tool names', () => {
    const feat: RawFeatData = {
      benefits: [{ type: 'proficiency', proficiency_type: 'tool', value: 'outil inconnu' }],
    };
    expect(featBonusToolProficiencies(feat)).toEqual([]);
  });

  it('returns empty array when feat is undefined', () => {
    expect(featBonusToolProficiencies(undefined)).toEqual([]);
  });
});

describe('featNeedsResistanceChoice / featResistanceOptions', () => {
  it('detects a feat offering a damage resistance choice (ex. Gladiateur)', () => {
    const feat: RawFeatData = {
      benefits: [{ type: 'damage_resistance', choose_from: ['contondants', 'tranchants', 'perforants'] }],
    };
    expect(featNeedsResistanceChoice(feat)).toBeTrue();
    expect(featResistanceOptions(feat)).toEqual([
      { id: 'damage-contondant', label: 'contondants' },
      { id: 'damage-tranchant', label: 'tranchants' },
      { id: 'damage-perforant', label: 'perforants' },
    ]);
  });

  it('maps elemental resistance words (ex. Insensibilité élémentaire)', () => {
    const feat: RawFeatData = {
      benefits: [{ type: 'damage_resistance', choose_from: ['acide', 'feu', 'foudre', 'froid', 'tonnerre'] }],
    };
    expect(featResistanceOptions(feat).map((o) => o.id)).toEqual([
      'damage-acide',
      'damage-feu',
      'damage-foudre',
      'damage-froid',
      'damage-tonnerre',
    ]);
  });

  it('is false/empty for feats without a resistance choice', () => {
    const feat: RawFeatData = { benefits: [{ type: 'damage_resistance', condition: "attaques d'opportunité" }] };
    expect(featNeedsResistanceChoice(feat)).toBeFalse();
    expect(featResistanceOptions(feat)).toEqual([]);
  });

  it('is false/empty when feat is undefined', () => {
    expect(featNeedsResistanceChoice(undefined)).toBeFalse();
    expect(featResistanceOptions(undefined)).toEqual([]);
  });
});
