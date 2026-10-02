import { shouldAcknowledgeEmptyGuideCatalog } from './guide-preferences.service';
import { isGuideBlogPostNew, GUIDE_NEWS_TTL_MS } from '@features/guide/guide-content';

describe('shouldAcknowledgeEmptyGuideCatalog', () => {
  const now = Date.parse('2026-09-05T00:00:00.000Z');

  it('treats missing or invalid dates as a returning account', () => {
    expect(shouldAcknowledgeEmptyGuideCatalog(undefined, now)).toBe(true);
    expect(shouldAcknowledgeEmptyGuideCatalog(null, now)).toBe(true);
    expect(shouldAcknowledgeEmptyGuideCatalog('not-a-date', now)).toBe(true);
  });

  it('keeps discovery badges for accounts created today', () => {
    expect(shouldAcknowledgeEmptyGuideCatalog('2026-09-04T12:00:00.000Z', now)).toBe(false);
  });

  it('acknowledges the current catalog for older accounts with empty prefs', () => {
    expect(shouldAcknowledgeEmptyGuideCatalog('2026-08-01T00:00:00.000Z', now)).toBe(true);
  });
});

describe('isGuideBlogPostNew (prefs badge)', () => {
  it('ignores static isNew once past the 14-day window', () => {
    const post = {
      id: 'x',
      date: '1 septembre 2026',
      tag: 't',
      title: 't',
      summary: 's',
      icon: 'i',
      border: 'b',
      tagColor: 'c',
      isNew: true,
    };
    const published = Date.UTC(2026, 8, 1);
    expect(isGuideBlogPostNew(post, published + 3 * 86_400_000)).toBe(true);
    expect(isGuideBlogPostNew(post, published + GUIDE_NEWS_TTL_MS + 86_400_000)).toBe(false);
  });
});
