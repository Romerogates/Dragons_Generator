import {
  campaignScheduleEventUrl,
  countScheduleRsvps,
  formatRsvpCounts,
  formatRsvpSummary,
  isScheduleRsvpStatus,
} from './schedule-rsvp.util';

describe('schedule-rsvp.util', () => {
  it('counts and formats RSVPs', () => {
    expect(formatRsvpSummary(undefined)).toBe('Aucune réponse');
    expect(formatRsvpSummary([])).toBe('Aucune réponse');
    expect(formatRsvpCounts({ yes: 0, no: 0, maybe: 0, total: 0 })).toBe('Aucune réponse');
    const counted = countScheduleRsvps([
      { userId: 'a', status: 'yes', at: '' },
      { userId: 'b', status: 'maybe', at: '' },
      { userId: 'c', status: 'no', at: '' },
      { userId: 'd', status: 'yes', at: '' },
    ]);
    expect(counted).toEqual({ yes: 2, no: 1, maybe: 1, total: 4 });
    expect(formatRsvpCounts(counted)).toBe('2 oui · 1 peut-être · 1 non');
    expect(formatRsvpSummary([
      { userId: 'a', status: 'yes', at: '' },
      { userId: 'b', status: 'maybe', at: '' },
    ])).toBe('1 oui · 1 peut-être · 0 non');
  });

  it('validates status and builds deep-link URL', () => {
    expect(isScheduleRsvpStatus('yes')).toBe(true);
    expect(isScheduleRsvpStatus('no')).toBe(true);
    expect(isScheduleRsvpStatus('maybe')).toBe(true);
    expect(isScheduleRsvpStatus('later')).toBe(false);
    const url = campaignScheduleEventUrl('camp-1', 'evt/2');
    expect(url).toContain('/campaigns/camp-1?tab=calendar&event=evt%2F2');
    expect(url.startsWith(window.location.origin)).toBe(true);
  });

  it('ignores unknown RSVP statuses in counts', () => {
    const counted = countScheduleRsvps([
      { userId: 'a', status: 'yes', at: '' },
      { userId: 'b', status: 'wat' as never, at: '' },
    ]);
    expect(counted).toEqual({ yes: 1, no: 0, maybe: 0, total: 2 });
  });
});
