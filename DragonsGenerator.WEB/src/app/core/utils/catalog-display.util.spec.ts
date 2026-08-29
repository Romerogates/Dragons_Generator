import {
  classResourceLabel,
  formatClassResources,
  formatFeatBenefits,
  formatFeatPrerequisites,
  resolveFeatureNames,
} from './catalog-display.util';

describe('catalog-display.util', () => {
  it('labels known class resources', () => {
    expect(classResourceLabel('fougue_count')).toBe('Fougue');
    expect(formatClassResources({ fougue_count: 1, extra_attacks: 2 })).toEqual([
      { label: 'Fougue', value: '1' },
      { label: 'Attaques supplémentaires', value: '2' },
    ]);
  });

  it('formats feat benefits and prerequisites', () => {
    const benefits = formatFeatBenefits({
      benefits: [
        { type: 'speed_bonus', value_m: 3 },
        { type: 'free_action', activity: 'boire une fiole' },
      ],
    });
    expect(benefits[0]?.title).toBe('Bonus de vitesse');
    expect(benefits[0]?.detail).toContain('+3 m');
    expect(formatFeatPrerequisites({ prerequisites: ['Niveau 4'] })).toEqual(['Niveau 4']);
  });

  it('resolves feature ids to names', () => {
    expect(
      resolveFeatureNames(['feat-fougue'], [{ id: 'feat-fougue', name: 'Fougue' }]),
    ).toBe('Fougue');
  });
});
