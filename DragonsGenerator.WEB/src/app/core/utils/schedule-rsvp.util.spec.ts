import {
  campaignScheduleEventUrl,
  countScheduleRsvps,
  formatRsvpCounts,
  formatRsvpSummary,
} from './schedule-rsvp.util';

describe('schedule-rsvp.util', () => {
  it('counts and formats RSVPs', () => {
    expect(formatRsvpSummary(undefined)).toBe('Aucune réponse');
    expect(formatRsvpSummary([])).toBe('Aucune réponse');
    const counted = countScheduleRsvps([
      { userId: 'a', status: 'yes', at: '' },
      { userId: 'b', status: 'maybe', at: '' },
      { userId: 'c', status: 'no', at: '' },
      { userId: 'd', status: 'yes', at: '' },
    ]);
    expect(counted).toEqual({ yes: 2, no: 1, maybe: 1, total: 4 });
    expect(formatRsvpCounts(counted)).toBe('2 oui · 1 peut-être · 1 non');
  });

  it('builds deep-link URL', () => {
    const url = campaignScheduleEventUrl('camp-1', 'evt/2');
    expect(url).toContain('/campaigns/camp-1?tab=calendar&event=evt%2F2');
  });
});
