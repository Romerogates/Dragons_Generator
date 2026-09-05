import { shouldAcknowledgeEmptyGuideCatalog } from './guide-preferences.service';

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
