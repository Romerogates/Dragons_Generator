import {
  catalogClassResourceLabel,
  formatClassResources,
  formatFeatBenefits,
  formatFeatPrerequisites,
  humanizeKey,
  resolveFeatureNames,
} from './catalog-display.util';

describe('catalog-display.util', () => {
  it('labels known class resources', () => {
    expect(catalogClassResourceLabel('fougue_count')).toBe('Fougue');
    expect(catalogClassResourceLabel('unknown_thing')).toContain('nknown');
    expect(formatClassResources({ fougue_count: 1, extra_attacks: 2 })).toEqual([
      { label: 'Fougue', value: '1' },
      { label: 'Attaques supplémentaires', value: '2' },
    ]);
    expect(formatClassResources(null)).toEqual([]);
    expect(formatClassResources({ empty: '' })).toEqual([]);
    expect(formatClassResources({ spell_slots: { '1': 2, '2': 3 } })).toEqual([
      { label: 'Emplacements de sorts', value: 'niv. 1 ×2 · niv. 2 ×3' },
    ]);
    expect(catalogClassResourceLabel('bardic_inspiration_die')).toBe('Dé d’inspiration');
  });

  it('formats feat benefits and prerequisites', () => {
    const benefits = formatFeatBenefits({
      benefits: [
        { type: 'speed_bonus', value_m: 3 },
        { type: 'free_action', activity: 'boire une fiole' },
        { type: 'ignore_property', property: 'rechargement' },
        { type: 'reduced_cost', activity: 'se relever', cost_m: 1.5 },
        'texte libre',
        { type: 'custom', desc: 'effet custom' },
      ],
    });
    expect(benefits[0]?.title).toBe('Bonus de vitesse');
    expect(benefits[0]?.detail).toContain('+3 m');
    expect(benefits[1]?.detail).toContain('boire une fiole');
    expect(benefits[4]?.title).toBe('Effet');
    expect(formatFeatBenefits(null)).toEqual([]);
    expect(formatFeatBenefits({})).toEqual([]);
    expect(formatFeatPrerequisites({ prerequisites: ['Niveau 4'] })).toEqual(['Niveau 4']);
    expect(formatFeatPrerequisites({ prerequisites: [{ name: 'For 13' }] })).toEqual(['For 13']);
    expect(formatFeatPrerequisites({ prerequisite: 'Aucun' })).toEqual(['Aucun']);
    expect(formatFeatPrerequisites(null)).toEqual([]);
  });

  it('resolves feature ids to names', () => {
    expect(
      resolveFeatureNames(['feat-fougue'], [{ id: 'feat-fougue', name: 'Fougue' }]),
    ).toBe('Fougue');
    expect(resolveFeatureNames(['feat-inconnu'], [])).toBe('Inconnu');
    expect(resolveFeatureNames([], [])).toBe('');
    expect(resolveFeatureNames(null, null)).toBe('');
  });

  it('humanizes keys', () => {
    expect(humanizeKey('spell_slots')).toBe('Spell slots');
  });
});
