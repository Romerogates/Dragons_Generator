import { breathShapeLabel } from './species-step.types';

describe('species-step.types', () => {
  it('traduit la forme de souffle', () => {
    expect(breathShapeLabel('cone')).toBe('Cône');
    expect(breathShapeLabel('LINE')).toBe('Ligne');
    expect(breathShapeLabel('weird')).toBe('weird');
    expect(breathShapeLabel(undefined)).toBe('');
  });
});
