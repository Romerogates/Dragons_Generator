import {
  buildIcsCalendar,
  buildTableCalendarEvents,
  googleCalendarTemplateUrl,
  parseCalendarEventId,
  tableEventsToIcsInputs,
  toIcsUtc,
} from './schedule-ics.util';
import type { CampaignScheduleEvent, CampaignSession } from '@core/models/Campaign/campaign';

describe('schedule-ics.util', () => {
  const session = (partial: Partial<CampaignSession> & Pick<CampaignSession, 'id' | 'title'>): CampaignSession => ({
    scheduledAt: '2026-10-01T18:00:00.000Z',
    status: 'planned',
    mode: 'online',
    ...partial,
  });

  const schedule = (
    partial: Partial<CampaignScheduleEvent> & Pick<CampaignScheduleEvent, 'id' | 'title'>,
  ): CampaignScheduleEvent => ({
    startsAt: '2026-10-05T19:00:00.000Z',
    endsAt: '2026-10-05T22:00:00.000Z',
    kind: 'game',
    ...partial,
  });

  it('maps schedule + sessions into calendar events with distinct ids', () => {
    const events = buildTableCalendarEvents(
      [
        session({ id: 's1', title: 'Session 1', status: 'planned' }),
        session({ id: 's2', title: 'Annulée', status: 'cancelled' }),
      ],
      [schedule({ id: 'e1', title: 'Prep MJ', kind: 'prep' })],
      true,
    );
    expect(events.map((e) => e.id)).toEqual(['schedule:e1', 'session:s1', 'session:s2']);
    expect(events.find((e) => e.id === 'schedule:e1')?.kind).toBe('prep');
    expect(events.find((e) => e.id === 'session:s1')?.status).toBe('planned');
  });

  it('hides cancelled sessions for non-owners', () => {
    const events = buildTableCalendarEvents(
      [
        session({ id: 's1', title: 'OK', status: 'planned' }),
        session({ id: 's2', title: 'Annulée', status: 'cancelled' }),
      ],
      [],
      false,
    );
    expect(events.map((e) => e.id)).toEqual(['session:s1']);
  });

  it('parses calendar event ids', () => {
    expect(parseCalendarEventId('schedule:abc')).toEqual({ source: 'schedule', entityId: 'abc' });
    expect(parseCalendarEventId('schedule:abc@2026-10-12T19:00:00.000Z')).toEqual({
      source: 'schedule',
      entityId: 'abc',
    });
    expect(parseCalendarEventId('session:xyz')).toEqual({ source: 'session', entityId: 'xyz' });
    expect(parseCalendarEventId('other')).toBeNull();
  });

  it('expands weekly rrule and emits RRULE in ICS', () => {
    const weekly = schedule({
      id: 'w1',
      title: 'Hebdo',
      startsAt: '2026-09-20T18:00:00.000Z',
      endsAt: '2026-09-20T22:00:00.000Z',
      rrule: 'FREQ=WEEKLY;INTERVAL=1',
    });
    const events = buildTableCalendarEvents([], [weekly], true);
    expect(events.length).toBeGreaterThan(1);
    expect(events[0].id.startsWith('schedule:w1')).toBe(true);

    const ics = buildIcsCalendar(
      'Campagne',
      tableEventsToIcsInputs('Campagne', [], [weekly]),
      new Date('2026-09-27T10:00:00.000Z'),
    );
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1');
  });

  it('builds a minimal ICS with VEVENT blocks', () => {
    const ics = buildIcsCalendar(
      'Ma Campagne',
      tableEventsToIcsInputs(
        'Ma Campagne',
        [session({ id: 's1', title: 'Soirée 1' })],
        [schedule({ id: 'e1', title: 'Briefing', location: 'Discord' })],
      ),
      new Date('2026-09-27T10:00:00.000Z'),
    );
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:[Ma Campagne] Soirée 1');
    expect(ics).toContain('SUMMARY:[Ma Campagne] Briefing');
    expect(ics).toContain('LOCATION:Discord');
    expect(ics).toContain('END:VCALENDAR');
    expect(ics).toContain(`DTSTART:${toIcsUtc('2026-10-01T18:00:00.000Z')}`);
  });

  it('skips cancelled sessions in ICS export', () => {
    const inputs = tableEventsToIcsInputs(
      'C',
      [
        session({ id: 'ok', title: 'OK' }),
        session({ id: 'no', title: 'NO', status: 'cancelled' }),
      ],
      [],
    );
    expect(inputs.map((i) => i.uid)).toEqual(['session-ok@dragons-generator']);
  });

  it('builds a Google Calendar TEMPLATE deep-link', () => {
    const url = googleCalendarTemplateUrl({
      uid: 'x',
      title: 'Table test',
      startsAt: '2026-10-01T18:00:00.000Z',
      endsAt: '2026-10-01T21:00:00.000Z',
      location: 'Maison',
      description: 'Soirée de jeu',
    });
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('Table test');
    expect(parsed.searchParams.get('location')).toBe('Maison');
    expect(parsed.searchParams.get('details')).toBe('Soirée de jeu');
    expect(parsed.searchParams.get('dates')).toContain('/');
  });
});
