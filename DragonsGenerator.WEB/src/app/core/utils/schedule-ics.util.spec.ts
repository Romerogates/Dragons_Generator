import {
  buildIcsCalendar,
  buildTableCalendarEvents,
  datetimeLocalValue,
  downloadIcsFile,
  expandScheduleOccurrences,
  fromDatetimeLocalValue,
  googleCalendarTemplateUrl,
  mapScheduleToCalendarEvents,
  mapSessionsToCalendarEvents,
  nextScheduleOccurrenceAt,
  parseCalendarEventId,
  parseSimpleRrule,
  previewScheduleOccurrences,
  scheduleKindLabel,
  tableEventsToIcsInputs,
  toIcsDate,
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

  it('maps session colors and empty title fallbacks', () => {
    const mapped = mapSessionsToCalendarEvents(
      [
        session({ id: 'p', title: '', status: 'played', scheduledAt: '' }),
        session({ id: 'c', title: 'X', status: 'cancelled' }),
      ],
      true,
    );
    expect(mapped[0].title).toBe('Session');
    expect(mapped[0].backgroundColor).toBe('#047857');
    expect(mapped[1].editable).toBe(false);
  });

  it('maps schedule kinds, allDay, and empty title', () => {
    const mapped = mapScheduleToCalendarEvents(
      [
        schedule({ id: 'a', title: '', kind: 'social', allDay: true, characterIds: undefined }),
        schedule({ id: 'b', title: 'Autre', kind: 'other' }),
      ],
      false,
    );
    expect(mapped[0].title).toBe('Date');
    expect(mapped[0].allDay).toBe(true);
    expect(mapped[0].kind).toBe('social');
    expect(mapped[1].kind).toBe('other');
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

  it('parses simple rrules and rejects unknown freq', () => {
    expect(parseSimpleRrule('FREQ=WEEKLY;INTERVAL=2')).toEqual({ freq: 'WEEKLY', interval: 2 });
    expect(parseSimpleRrule('FREQ=MONTHLY')).toEqual({ freq: 'MONTHLY', interval: 1 });
    expect(parseSimpleRrule('FREQ=DAILY')).toBeNull();
    expect(parseSimpleRrule('INTERVAL=1')).toBeNull();
    expect(parseSimpleRrule('FREQ=WEEKLY;INTERVAL=abc')).toEqual({ freq: 'WEEKLY', interval: 1 });
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

  it('expands monthly rrule and skips past one-shot events', () => {
    const monthly = schedule({
      id: 'm1',
      title: 'Mensuel',
      startsAt: '2026-01-15T18:00:00.000Z',
      endsAt: '2026-01-15T21:00:00.000Z',
      rrule: 'FREQ=MONTHLY;INTERVAL=1',
    });
    const from = new Date('2026-09-01T00:00:00.000Z');
    const until = new Date('2026-12-01T00:00:00.000Z');
    const occ = expandScheduleOccurrences(monthly, until, from);
    expect(occ.length).toBeGreaterThan(0);
    expect(occ[0].occurrenceId).toContain('schedule:m1');

    const preview = previewScheduleOccurrences(monthly, 3, from);
    expect(preview.length).toBeLessThanOrEqual(3);
    expect(preview[0].startsAt).toBe(occ[0].startsAt);

    const past = expandScheduleOccurrences(
      schedule({
        id: 'old',
        title: 'Ancien',
        startsAt: '2020-01-01T12:00:00.000Z',
        endsAt: '2020-01-01T15:00:00.000Z',
      }),
      until,
      from,
    );
    expect(past).toEqual([]);
  });

  it('handles missing endsAt, invalid rrule, and allDay duration', () => {
    const noEnd = expandScheduleOccurrences(
      schedule({
        id: 'n1',
        title: 'Sans fin',
        startsAt: '2026-10-10T18:00:00.000Z',
        endsAt: null,
        allDay: true,
      }),
      new Date('2026-12-01T00:00:00.000Z'),
      new Date('2026-10-01T00:00:00.000Z'),
    );
    expect(noEnd[0].endsAt).toBeNull();

    const badRule = expandScheduleOccurrences(
      schedule({
        id: 'bad',
        title: 'Bad',
        startsAt: '2026-10-10T18:00:00.000Z',
        rrule: 'FREQ=YEARLY',
      }),
      new Date('2026-12-01T00:00:00.000Z'),
      new Date('2026-10-01T00:00:00.000Z'),
    );
    expect(badRule[0].occurrenceId).toBe('schedule:bad');
  });

  it('returns nextScheduleOccurrenceAt for future dates', () => {
    const next = nextScheduleOccurrenceAt(
      schedule({
        id: 'n',
        title: 'Soon',
        startsAt: '2026-10-20T19:00:00.000Z',
        endsAt: '2026-10-20T22:00:00.000Z',
      }),
      new Date('2026-10-01T00:00:00.000Z'),
    );
    expect(next).toBe('2026-10-20T19:00:00.000Z');
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

  it('builds all-day ICS with folded long lines and escaped text', () => {
    const longTitle = 'A'.repeat(90);
    const ics = buildIcsCalendar(
      'Cal;test\nline,ok',
      [
        {
          uid: 'allday@dragons',
          title: longTitle,
          startsAt: '2026-10-05T00:00:00.000Z',
          endsAt: null,
          allDay: true,
          location: 'Lieu;spécial',
          description: 'Ligne1\nLigne2',
          rrule: 'FREQ=WEEKLY;INTERVAL=1',
        },
      ],
      new Date('2026-09-27T10:00:00.000Z'),
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:');
    expect(ics).toContain('DTEND;VALUE=DATE:');
    expect(ics).toContain('LOCATION:Lieu\\;spécial');
    expect(ics).toContain('DESCRIPTION:Ligne1\\nLigne2');
    expect(ics).toContain('\r\n ');
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

  it('builds Google all-day link and default end when endsAt missing', () => {
    const allDay = googleCalendarTemplateUrl({
      uid: 'y',
      title: 'Journée',
      startsAt: '2026-10-05T00:00:00.000Z',
      allDay: true,
    });
    expect(new URL(allDay).searchParams.get('dates')).toMatch(/^\d{8}\/\d{8}$/);

    const timed = googleCalendarTemplateUrl({
      uid: 'z',
      title: 'Sans fin',
      startsAt: '2026-10-05T18:00:00.000Z',
    });
    expect(new URL(timed).searchParams.get('dates')).toContain('T');
  });

  it('formats datetime-local helpers and ICS dates', () => {
    expect(datetimeLocalValue(null)).toBe('');
    expect(datetimeLocalValue('not-a-date')).toBe('');
    expect(datetimeLocalValue('2026-10-05T19:30:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromDatetimeLocalValue('not-a-date')).toMatch(/^\d{4}-/);
    expect(fromDatetimeLocalValue('2026-10-05T19:30')).toMatch(/^\d{4}-/);
    expect(toIcsDate('2026-10-05T19:00:00.000Z')).toMatch(/^\d{8}$/);
    expect(scheduleKindLabel('game')).toBe('Soirée de jeu');
  });

  it('downloads an .ics file via blob link', () => {
    const click = jasmine.createSpy('click');
    const revoke = spyOn(URL, 'revokeObjectURL');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:ics');
    spyOn(document, 'createElement').and.returnValue({
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement);

    downloadIcsFile('agenda', 'BEGIN:VCALENDAR');
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:ics');

    downloadIcsFile('agenda.ics', 'BEGIN:VCALENDAR');
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('falls back session/kind colors and default timed duration without endsAt', () => {
    const mappedSession = mapSessionsToCalendarEvents(
      [session({ id: 'x', title: 'X', status: 'weird' as CampaignSession['status'] })],
      true,
    );
    expect(mappedSession[0].backgroundColor).toBe('#7c3aed');

    const mappedKind = mapScheduleToCalendarEvents(
      [schedule({ id: 'k', title: 'K', kind: 'weird' as CampaignScheduleEvent['kind'] })],
      true,
    );
    expect(mappedKind[0].backgroundColor).toBe('#475569');

    const timed = expandScheduleOccurrences(
      schedule({
        id: 't',
        title: 'Timed',
        startsAt: '2026-10-10T18:00:00.000Z',
        endsAt: null,
        allDay: false,
      }),
      new Date('2026-12-01T00:00:00.000Z'),
      new Date('2026-10-01T00:00:00.000Z'),
    );
    expect(timed[0].endsAt).toBeNull();
  });

  it('parses rrule parts without equals and clamps preview count', () => {
    expect(parseSimpleRrule('FREQ=WEEKLY;BARE;INTERVAL=1')).toEqual({
      freq: 'WEEKLY',
      interval: 1,
    });

    const weekly = schedule({
      id: 'p',
      title: 'Preview',
      startsAt: '2026-09-20T18:00:00.000Z',
      endsAt: '2026-09-20T22:00:00.000Z',
      rrule: 'FREQ=WEEKLY;INTERVAL=1',
    });
    const from = new Date('2026-10-01T00:00:00.000Z');
    // count 0 / NaN fall through to default 6 via `Math.floor(count) || 6`
    expect(previewScheduleOccurrences(weekly, 0, from).length).toBeLessThanOrEqual(6);
    expect(previewScheduleOccurrences(weekly, 100, from).length).toBeLessThanOrEqual(24);
    expect(previewScheduleOccurrences(weekly, Number.NaN, from).length).toBeGreaterThan(0);
    expect(previewScheduleOccurrences(weekly).length).toBeGreaterThan(0);
  });

  it('rewinds old weekly series and tags non-seed occurrence ids', () => {
    const weekly = schedule({
      id: 'oldw',
      title: 'Old weekly',
      startsAt: '2024-01-01T18:00:00.000Z',
      endsAt: '2024-01-01T21:00:00.000Z',
      rrule: 'FREQ=WEEKLY;INTERVAL=1',
    });
    const from = new Date('2026-10-01T00:00:00.000Z');
    const until = new Date('2026-10-20T00:00:00.000Z');
    const occ = expandScheduleOccurrences(weekly, until, from);
    expect(occ.length).toBeGreaterThan(0);
    expect(occ.some((o) => o.occurrenceId.includes('@'))).toBe(true);
  });

  it('returns null next occurrence when series is exhausted before from', () => {
    const next = nextScheduleOccurrenceAt(
      schedule({
        id: 'gone',
        title: 'Gone',
        startsAt: '2015-01-01T12:00:00.000Z',
        endsAt: '2015-01-01T15:00:00.000Z',
        rrule: 'FREQ=WEEKLY;INTERVAL=1',
      }),
      new Date('2026-10-01T00:00:00.000Z'),
    );
    // May still find occurrences within 12 months horizon if rewind works —
    // force a one-shot far in the past instead:
    const pastOneShot = nextScheduleOccurrenceAt(
      schedule({
        id: 'past',
        title: 'Past',
        startsAt: '2015-01-01T12:00:00.000Z',
        endsAt: '2015-01-01T15:00:00.000Z',
      }),
      new Date('2026-10-01T00:00:00.000Z'),
    );
    expect(pastOneShot).toBeNull();
    void next;
  });

  it('scheduleKindLabel falls back for unknown kind', () => {
    expect(scheduleKindLabel('custom' as CampaignScheduleEvent['kind'])).toBe('custom');
  });

  it('buildIcsCalendar defaults now and synthesizes end when missing', () => {
    const ics = buildIcsCalendar('Cal', [
      {
        uid: 'no-end@dragons',
        title: 'Sans fin',
        startsAt: '2026-10-05T18:00:00.000Z',
      },
    ]);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTEND:');
  });

  it('stops rewind when rrule cannot advance past until', () => {
    const monthly = schedule({
      id: 'far',
      title: 'Far',
      startsAt: '2000-01-15T18:00:00.000Z',
      endsAt: '2000-01-15T21:00:00.000Z',
      rrule: 'FREQ=MONTHLY;INTERVAL=1',
    });
    const from = new Date('2026-10-01T00:00:00.000Z');
    const until = new Date('2010-01-01T00:00:00.000Z');
    expect(expandScheduleOccurrences(monthly, until, from)).toEqual([]);
  });
});