import { testCharacter } from '@testing/typed-fixtures';
import { buildPregenPhysicalDescription } from './pregen-narrative.util';
import type { Character } from '@core/models/Character/character';

function base(sex: 'M' | 'F' | 'X' | undefined): Character {
  return testCharacter({
    name: 'Test',
    classes: [{ classId: 'cls', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
    personality: { sex: sex ?? 'X' },
  });
}

describe('buildPregenPhysicalDescription', () => {
  it('conjugates for F / M / X / missing sex', () => {
    expect(buildPregenPhysicalDescription(base('F'), 'Humain', 'Guerrier')).toContain('Elle est');
    expect(buildPregenPhysicalDescription(base('M'), 'Humain', 'Guerrier')).toContain('Il est');
    expect(buildPregenPhysicalDescription(base('X'), 'Humain', 'Guerrier')).toContain('Iel est');
    expect(buildPregenPhysicalDescription(base(undefined), 'Elfes', 'Magicien')).toContain('Iel est');
  });
});
