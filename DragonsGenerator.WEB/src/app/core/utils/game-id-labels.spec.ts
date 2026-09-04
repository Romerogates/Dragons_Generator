import {
  formatGameIds,
  GAME_ID_LABELS,
  labelForGameId,
  labelForItemRef,
  registerGameLabel,
  registerGameLabels,
} from './game-id-labels';

describe('game-id-labels', () => {
  it('resolves dictionary entries directly', () => {
    expect(labelForGameId('wp-cat-martial')).toBe('Armes de guerre');
    expect(labelForGameId('skill-arcanes')).toBe('Arcanes');
  });

  it('returns the placeholder for null/undefined/empty ids', () => {
    expect(labelForGameId(null)).toBe('—');
    expect(labelForGameId(undefined)).toBe('—');
    expect(labelForGameId('')).toBe('—');
    expect(labelForGameId('   ')).toBe('—');
  });

  it('registers and prioritizes a runtime label over the static dictionary', () => {
    registerGameLabel('wp-epee-longue', 'Longue épée (custom)');
    expect(labelForGameId('wp-epee-longue')).toBe('Longue épée (custom)');
  });

  it('ignores registerGameLabel calls with an empty id or label', () => {
    registerGameLabel('', 'Ignoré');
    registerGameLabel('wp-quelque-chose', '');
    expect(labelForGameId('wp-quelque-chose')).not.toBe('');
  });

  it('registers a skill- alias when given a legacy ski- id', () => {
    registerGameLabel('ski-perception', 'Perception (custom)');
    expect(labelForGameId('skill-perception')).toBe('Perception (custom)');
  });

  it('registerGameLabels registers a batch of entries', () => {
    registerGameLabels([
      ['tl-des', 'Dés (custom)'],
      ['tl-luth', 'Luth (custom)'],
    ]);
    expect(labelForGameId('tl-des')).toBe('Dés (custom)');
    expect(labelForGameId('tl-luth')).toBe('Luth (custom)');
  });

  it('falls back to a category filter label when nothing else matches', () => {
    expect(GAME_ID_LABELS['category-simple-weapons']).toBeDefined();
  });

  it('falls back to a humanized slug for a totally unknown id', () => {
    expect(labelForGameId('wp-nouvelle-arme-magique')).toBe('Nouvelle Arme Magique');
  });

  it('falls back to the raw id when the slug resolves to an empty string', () => {
    expect(labelForGameId('wp-')).toBe('wp-');
  });

  it('formatGameIds joins labels with a custom separator and empty fallback', () => {
    expect(formatGameIds(null)).toBe('—');
    expect(formatGameIds([])).toBe('—');
    expect(formatGameIds(['skill-arcanes', 'skill-histoire'])).toBe('Arcanes, Histoire');
    expect(formatGameIds(['skill-arcanes', 'skill-histoire'], ' / ')).toBe('Arcanes / Histoire');
    expect(formatGameIds(null, ', ', 'Aucune')).toBe('Aucune');
  });

  it('labelForItemRef handles strings, refs, missing qty and quantities > 1', () => {
    expect(labelForItemRef(null)).toBe('—');
    expect(labelForItemRef('skill-arcanes')).toBe('Arcanes');
    expect(labelForItemRef({ id: 'wp-dague' })).toBe('Dague');
    expect(labelForItemRef({ id: 'wp-dague', qty: 1 })).toBe('Dague');
    expect(labelForItemRef({ id: 'wp-dague', qty: 3 })).toBe('3× Dague');
  });
});
