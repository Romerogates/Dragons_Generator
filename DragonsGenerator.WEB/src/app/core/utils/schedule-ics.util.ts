import type {
  CampaignScheduleEvent,
  CampaignScheduleKind,
  CampaignSession,
} from '@core/models/Campaign/campaign';
import { CAMPAIGN_SCHEDULE_KIND_LABELS } from '@core/models/Campaign/campaign';

export type CalendarEventSource = 'schedule' | 'session';

export interface CalendarHeroOption {
  id: string;
  label: string;
}

/** Event normalisé pour FullCalendar + panneau d’édition. */
export interface TableCalendarEventView {
  id: string;
  source: CalendarEventSource;
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  kind?: CampaignScheduleKind;
  status?: CampaignSession['status'];
  location?: string;
  notes?: string;
  characterIds: string[];
  linkedSessionId?: string | null;
  /** Couleur FullCalendar. */
  backgroundColor: string;
  borderColor: string;
  editable: boolean;
}

const SESSION_COLORS: Record<CampaignSession['status'], { bg: string; border: string }> = {
  planned: { bg: '#7c3aed', border: '#a78bfa' },
  played: { bg: '#047857', border: '#34d399' },
  cancelled: { bg: '#57534e', border: '#78716c' },
};

const KIND_COLORS: Record<CampaignScheduleKind, { bg: string; border: string }> = {
  game: { bg: '#b45309', border: '#fbbf24' },
  prep: { bg: '#1d4ed8', border: '#60a5fa' },
  social: { bg: '#be185d', border: '#f472b6' },
  other: { bg: '#475569', border: '#94a3b8' },
};

export function mapSessionsToCalendarEvents(
  sessions: CampaignSession[],
  editable: boolean,
): TableCalendarEventView[] {
  return sessions.map((s) => {
    const colors = SESSION_COLORS[s.status] ?? SESSION_COLORS.planned;
    const start = s.scheduledAt || new Date().toISOString();
    const end = new Date(new Date(start).getTime() + 3 * 60 * 60 * 1000).toISOString();
    return {
      id: `session:${s.id}`,
      source: 'session',
      title: s.title || 'Session',
      start,
      end,
      allDay: false,
      status: s.status,
      location: s.location,
      notes: s.notes,
      characterIds: [],
      backgroundColor: colors.bg,
      borderColor: colors.border,
      editable: editable && s.status !== 'cancelled',
    };
  });
}

export function mapScheduleToCalendarEvents(
  events: CampaignScheduleEvent[],
  editable: boolean,
): TableCalendarEventView[] {
  return events.map((e) => {
    const colors = KIND_COLORS[e.kind] ?? KIND_COLORS.other;
    return {
      id: `schedule:${e.id}`,
      source: 'schedule',
      title: e.title || 'Date',
      start: e.startsAt,
      end: e.endsAt ?? null,
      allDay: !!e.allDay,
      kind: e.kind,
      location: e.location,
      notes: e.notes,
      characterIds: e.characterIds ?? [],
      linkedSessionId: e.linkedSessionId ?? null,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      editable,
    };
  });
}

export function buildTableCalendarEvents(
  sessions: CampaignSession[],
  scheduleEvents: CampaignScheduleEvent[],
  editable: boolean,
): TableCalendarEventView[] {
  // Joueurs : masquer les sessions annulées. MJ : tout voir.
  const sessionsVisible = editable
    ? sessions
    : sessions.filter((s) => s.status !== 'cancelled');
  return [
    ...mapScheduleToCalendarEvents(scheduleEvents, editable),
    ...mapSessionsToCalendarEvents(sessionsVisible, editable),
  ];
}

export function parseCalendarEventId(
  id: string,
): { source: CalendarEventSource; entityId: string } | null {
  if (id.startsWith('schedule:')) return { source: 'schedule', entityId: id.slice('schedule:'.length) };
  if (id.startsWith('session:')) return { source: 'session', entityId: id.slice('session:'.length) };
  return null;
}

export function scheduleKindLabel(kind: CampaignScheduleKind): string {
  return CAMPAIGN_SCHEDULE_KIND_LABELS[kind] ?? kind;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format UTC for ICS: 20260927T190000Z */
export function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Format local date for all-day ICS: 20260927 */
export function toIcsDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

export interface IcsEventInput {
  uid: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  allDay?: boolean;
  location?: string;
  description?: string;
}

export function buildIcsCalendar(
  calendarName: string,
  events: IcsEventInput[],
  now = new Date(),
): string {
  const stamp = toIcsUtc(now.toISOString());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dragons Generator//Table Calendar//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];

  for (const ev of events) {
    const endIso =
      ev.endsAt ||
      new Date(new Date(ev.startsAt).getTime() + (ev.allDay ? 24 : 3) * 60 * 60 * 1000).toISOString();
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${icsEscape(ev.uid)}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(ev.startsAt)}`);
      const endDay = new Date(endIso);
      endDay.setDate(endDay.getDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${toIcsDate(endDay.toISOString())}`);
    } else {
      lines.push(`DTSTART:${toIcsUtc(ev.startsAt)}`);
      lines.push(`DTEND:${toIcsUtc(endIso)}`);
    }
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.location?.trim()) lines.push(`LOCATION:${icsEscape(ev.location.trim())}`);
    if (ev.description?.trim()) lines.push(`DESCRIPTION:${icsEscape(ev.description.trim())}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

export function tableEventsToIcsInputs(
  campaignTitle: string,
  sessions: CampaignSession[],
  scheduleEvents: CampaignScheduleEvent[],
): IcsEventInput[] {
  const fromSchedule = scheduleEvents.map((e) => ({
    uid: `schedule-${e.id}@dragons-generator`,
    title: `[${campaignTitle}] ${e.title}`,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay,
    location: e.location,
    description: [scheduleKindLabel(e.kind), e.notes].filter(Boolean).join('\n'),
  }));
  const fromSessions = sessions
    .filter((s) => s.status !== 'cancelled')
    .map((s) => ({
      uid: `session-${s.id}@dragons-generator`,
      title: `[${campaignTitle}] ${s.title}`,
      startsAt: s.scheduledAt,
      endsAt: new Date(new Date(s.scheduledAt).getTime() + 3 * 60 * 60 * 1000).toISOString(),
      allDay: false,
      location: s.location,
      description: [`Session (${s.status})`, s.notes].filter(Boolean).join('\n'),
    }));
  return [...fromSchedule, ...fromSessions];
}

export function downloadIcsFile(filename: string, icsBody: string): void {
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Deep-link « Ajouter à Google Agenda » pour un événement. */
export function googleCalendarTemplateUrl(ev: IcsEventInput): string {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', ev.title);
  if (ev.allDay) {
    const start = toIcsDate(ev.startsAt);
    const endDate = new Date(ev.endsAt || ev.startsAt);
    endDate.setDate(endDate.getDate() + 1);
    params.set('dates', `${start}/${toIcsDate(endDate.toISOString())}`);
  } else {
    const end =
      ev.endsAt ||
      new Date(new Date(ev.startsAt).getTime() + 3 * 60 * 60 * 1000).toISOString();
    params.set('dates', `${toIcsUtc(ev.startsAt)}/${toIcsUtc(end)}`);
  }
  if (ev.location?.trim()) params.set('location', ev.location.trim());
  if (ev.description?.trim()) params.set('details', ev.description.trim());
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function datetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
