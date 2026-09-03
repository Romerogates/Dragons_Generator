import {
  featAsiAbilityOptions,
  featAsiNeedsAbilityChoice,
  featAsiValue,
  featBonusArmorProficiencies,
  featDarkvisionRadius,
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
