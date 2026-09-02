import {
  mergeCreationLanguages,
  normalizeLanguageName,
} from './character-languages.util';

describe('character-languages.util', () => {
  it('normalizeLanguageName converts lg- IDs to readable labels', () => {
    expect(normalizeLanguageName('lg-elfique')).toBe('Elfique');
    expect(normalizeLanguageName('lg-vieil-commun')).toBe('Vieil Commun');
    expect(normalizeLanguageName('Commun')).toBe('Commun');
  });

  it('mergeCreationLanguages dedupes and normalizes', () => {
    expect(
      mergeCreationLanguages(['lg-elfique', 'Commun'], ['lg-elfique', 'lg-nain']),
    ).toEqual(['Elfique', 'Commun', 'Nain']);
  });
});
