import {
  abilityKeyForSkillId,
  buildSkillMap,
  formatSkillModifier,
  normalizeSkillId,
  prettifySkillId,
  resolveSkillInfo,
} from './skill.utils';

describe('skill.utils', () => {
  const map = buildSkillMap([
    { id: 'skill-athletisme', name: 'Athlétisme', ability: 'FOR' } as any,
    { id: 'ski-perception', name: 'Perception', ability: 'SAG' } as any,
  ]);

  it('normalizeSkillId converts ski- prefix', () => {
    expect(normalizeSkillId('ski-nature')).toBe('skill-nature');
    expect(normalizeSkillId('skill-survie')).toBe('skill-survie');
  });

  it('buildSkillMap normalizes ids and abilities', () => {
    expect(map['skill-athletisme'].label).toBe('Athlétisme');
    expect(map['skill-athletisme'].ability).toBe('Force');
    expect(map['skill-perception'].ability).toBe('Sagesse');
  });

  it('resolveSkillInfo and prettifySkillId', () => {
    expect(resolveSkillInfo('ski-athletisme', map)?.label).toBe('Athlétisme');
    expect(prettifySkillId('skill-survie', map)).toBe('Survie');
    expect(prettifySkillId('skill-unknown', {})).toContain('Unknown');
  });

  it('formatSkillModifier covers proficiency, expertise, and negatives', () => {
    expect(formatSkillModifier(2, false, false, 3)).toBe('+2');
    expect(formatSkillModifier(2, true, false, 3)).toBe('+5');
    expect(formatSkillModifier(2, true, true, 3)).toBe('+8');
    expect(formatSkillModifier(-1, false, false, 2)).toBe('-1');
    expect(formatSkillModifier(-2, true, false, 2)).toBe('+0');
  });

  it('abilityKeyForSkillId maps known skills', () => {
    expect(abilityKeyForSkillId('skill-athletisme')).toBe('force');
    expect(abilityKeyForSkillId('skill-unknown')).toBeNull();
  });
});
