import {
  foldFeaturesForSheet,
  formatFeatureSheetLabel,
  isRangerChoiceFeatureId,
} from './format-sheet-feature.util';
import type { FeatureInstance } from '@core/models/Character/character';

function feat(partial: Partial<FeatureInstance> & Pick<FeatureInstance, 'name'>): FeatureInstance {
  return {
    desc: '',
    source: 'class',
    ...partial,
  };
}

describe('isRangerChoiceFeatureId', () => {
  it('classifies enemy, terrain, and other ids', () => {
    expect(isRangerChoiceFeatureId(undefined)).toBeNull();
    expect(isRangerChoiceFeatureId('feat-ennemi-jure')).toBeNull();
    expect(isRangerChoiceFeatureId('ennemi-creations-magiques')).toBe('enemy');
    expect(isRangerChoiceFeatureId('terrain-foret')).toBe('terrain');
  });
});

describe('formatFeatureSheetLabel', () => {
  it('resolves ranger fighting style ids to a French name', () => {
    expect(formatFeatureSheetLabel({ name: 'Style : style-archerie-rodeur', refId: 'style-archerie-rodeur' })).toBe(
      'Style : Archerie',
    );
  });

  it('uses the combat-style fallback table from a feat-prefixed id', () => {
    expect(formatFeatureSheetLabel({ name: '', refId: 'feat-style-duel' })).toBe('Style : Duel');
    expect(formatFeatureSheetLabel({ name: '', refId: 'feat-style-archerie-rodeur' })).toBe('Style : Archerie');
  });

  it('falls back to a humanized slug for an unknown concrete style id', () => {
    expect(formatFeatureSheetLabel({ name: '', refId: 'feat-style-inconnu-xyz' })).toMatch(/^Style : /);
  });

  it('rewrites a Style: line whose refId is not a style key', () => {
    expect(formatFeatureSheetLabel({ name: 'Style : style-defense', refId: 'feat-style-de-combat' })).toBe(
      'Style : Défense',
    );
    expect(formatFeatureSheetLabel({ name: 'Style : foobar-inconnu', refId: 'feat-style-de-combat' })).toMatch(
      /^Style : /,
    );
  });

  it('humanizes a slug-like stored name', () => {
    expect(formatFeatureSheetLabel({ name: 'ennemi-creations-magiques', refId: 'ennemi-creations-magiques' })).toMatch(
      /Créations magiques/i,
    );
  });

  it('keeps a plain French name and falls back when the name is empty', () => {
    expect(formatFeatureSheetLabel({ name: 'Adaptabilité', refId: 'trait-adaptabilite' })).toBe('Adaptabilité');
    expect(formatFeatureSheetLabel({ name: '  ', refId: 'feat-ennemi-jure' })).toMatch(/ennemi|jurer|juré/i);
    expect(formatFeatureSheetLabel({ name: '', refId: '' })).toBe('');
    expect(formatFeatureSheetLabel({ name: 'Sans ref' })).toBe('Sans ref');
    expect(formatFeatureSheetLabel({ name: undefined as unknown as string, refId: undefined })).toBe('');
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

  it('leaves parent ranger feats unchanged when no child picks were stored', () => {
    const folded = foldFeaturesForSheet([
      feat({ refId: 'feat-ennemi-jure', name: 'Ennemi juré' }),
      feat({ refId: 'feat-explorateur-ne', name: 'Explorateur-né' }),
      feat({ name: 'Anecdote' }),
    ]);
    expect(folded.map((f) => f.name)).toEqual(['Ennemi juré', 'Explorateur-né', 'Anecdote']);
  });

  it('merges terrains onto an id that only contains explorateur-ne', () => {
    const folded = foldFeaturesForSheet([
      feat({ refId: 'cls-rodeur-explorateur-ne', name: 'Explorateur-né' }),
      feat({ refId: 'terrain-foret', name: 'Terrain Foret' }),
    ]);
    expect(folded).toHaveSize(1);
    expect(folded[0]!.name).toMatch(/Explorateur-né :/i);
    expect(folded[0]!.name).toMatch(/forêt|Foret/i);
  });
});
