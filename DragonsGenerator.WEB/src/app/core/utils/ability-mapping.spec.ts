import { proficiencyBonusForLevel } from '@core/services/character-builder.service';
import {
  apiAsiToPartialScores,
  apiCodeToAbilityKey,
  abilityKeyToApiCode,
  mergePartialScores,
} from './ability-mapping';

describe('proficiencyBonusForLevel', () => {
  it('follows D&D progression table', () => {
    expect(proficiencyBonusForLevel(1)).toBe(2);
    expect(proficiencyBonusForLevel(4)).toBe(2);
    expect(proficiencyBonusForLevel(5)).toBe(3);
    expect(proficiencyBonusForLevel(9)).toBe(4);
    expect(proficiencyBonusForLevel(20)).toBe(6);
    expect(proficiencyBonusForLevel(0)).toBe(2);
    expect(proficiencyBonusForLevel(99)).toBe(6);
  });
});

describe('ability-mapping', () => {
  it('maps API codes to ability keys', () => {
    expect(apiCodeToAbilityKey('str')).toBe('force');
    expect(abilityKeyToApiCode('charisme')).toBe('cha');
    expect(apiCodeToAbilityKey('invalid')).toBeNull();
  });

  it('converts and merges ASI partial scores', () => {
    const partial = apiAsiToPartialScores({ str: 2, cha: 1 });
    expect(partial.force).toBe(2);
    expect(partial.charisme).toBe(1);

    const merged = mergePartialScores({ force: 2 }, { force: 1, charisme: 1 });
    expect(merged.force).toBe(3);
    expect(merged.charisme).toBe(1);
  });
});
