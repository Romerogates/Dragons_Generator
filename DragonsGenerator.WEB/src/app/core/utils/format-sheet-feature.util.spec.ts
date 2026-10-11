import { foldFeaturesForSheet, formatFeatureSheetLabel } from './format-sheet-feature.util';
import type { FeatureInstance } from '@core/models/Character/character';

function feat(partial: Partial<FeatureInstance> & Pick<FeatureInstance, 'name'>): FeatureInstance {
  return {
    desc: '',
    source: 'class',
    ...partial,
  };
}

describe('formatFeatureSheetLabel', () => {
  it('resolves ranger fighting style ids to a French name', () => {
    expect(formatFeatureSheetLabel({ name: 'Style : style-archerie-rodeur', refId: 'style-archerie-rodeur' })).toBe(
      'Style : Archerie',
    );
  });

  it('humanizes a slug-like stored name', () => {
    expect(formatFeatureSheetLabel({ name: 'ennemi-creations-magiques', refId: 'ennemi-creations-magiques' })).toMatch(
      /Créations magiques/i,
    );
  });
});

describe('foldFeaturesForSheet', () => {
  it('merges ranger enemy/terrain picks into the parent feats and drops the clones', () => {
    const folded = foldFeaturesForSheet([
      feat({ refId: 'trait-adaptabilite', name: 'Adaptabilité', source: 'species' }),
      feat({ refId: 'feat-ennemi-jure', name: 'Ennemi juré' }),
      feat({ refId: 'feat-explorateur-ne', name: 'Explorateur-né' }),
      feat({ refId: 'style-archerie-rodeur', name: 'Style : style-archerie-rodeur' }),
      feat({ refId: 'ennemi-creations-magiques', name: 'Ennemi Creations Magiques' }),
      feat({ refId: 'terrain-marecage-zones-humides', name: 'Terrain Marecage Zones Humides' }),
      feat({ refId: 'terrain-urbain-et-ruines', name: 'Terrain Urbain Et Ruines' }),
    ]);
    const names = folded.map((f) => f.name);
    expect(names).toContain('Adaptabilité');
    expect(names.some((n) => n.startsWith('Ennemi juré :') && /créations magiques/i.test(n))).toBeTrue();
    expect(names.some((n) => n.startsWith('Explorateur-né :') && /marécage/i.test(n) && /urbain/i.test(n))).toBeTrue();
    expect(names).toContain('Style : Archerie');
    expect(names.some((n) => /style-archerie/i.test(n))).toBeFalse();
    expect(folded.some((f) => f.refId?.startsWith('ennemi-') || f.refId?.startsWith('terrain-'))).toBeFalse();
  });
});
