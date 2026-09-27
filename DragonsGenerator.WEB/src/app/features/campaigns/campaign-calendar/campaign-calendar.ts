import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import type {
  CalendarOptions,
  DateSelectInfo,
  EventClickInfo,
  EventDropInfo,
  EventInput,
  EventResizeDoneInfo,
} from 'fullcalendar';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import listPlugin from '@fullcalendar/angular/list';
import breezyThemePlugin from '@fullcalendar/angular/themes/breezy';
import frLocale from 'fullcalendar/locales/fr';
import 'temporal-polyfill/global';

import type {
  CampaignScheduleEvent,
  CampaignScheduleKind,
  CampaignSession,
} from '@core/models/Campaign/campaign';
import {
  CAMPAIGN_SCHEDULE_KIND_LABELS,
  CAMPAIGN_SCHEDULE_RRULE_PRESETS,
  createCampaignScheduleEvent,
} from '@core/models/Campaign/campaign';
import {
  buildIcsCalendar,
  buildTableCalendarEvents,
  datetimeLocalValue,
  downloadIcsFile,
  fromDatetimeLocalValue,
  googleCalendarTemplateUrl,
  parseCalendarEventId,
  scheduleKindLabel,
  tableEventsToIcsInputs,
  type CalendarHeroOption,
  type TableCalendarEventView,
} from '@core/utils/schedule-ics.util';

export type ScheduleEventsChange = CampaignScheduleEvent[];

@Component({
  selector: 'app-campaign-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FullCalendarModule],
  templateUrl: './campaign-calendar.html',
  styleUrl: './campaign-calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignCalendar {
  readonly isOwner = input(false);
  readonly campaignId = input<string | null>(null);
  readonly campaignTitle = input('Campagne');
  readonly sessions = input<CampaignSession[]>([]);
  readonly scheduleEvents = input<CampaignScheduleEvent[]>([]);
  readonly heroOptions = input<CalendarHeroOption[]>([]);
  readonly currentUserId = input<string | null>(null);

  readonly scheduleEventsChange = output<ScheduleEventsChange>();
  readonly openSession = output<string>();
  readonly convertToSession = output<CampaignScheduleEvent>();
  readonly rsvpChange = output<{ eventId: string; status: 'yes' | 'no' | 'maybe' }>();

  readonly kinds = Object.entries(CAMPAIGN_SCHEDULE_KIND_LABELS) as [CampaignScheduleKind, string][];
  readonly rrulePresets = CAMPAIGN_SCHEDULE_RRULE_PRESETS;
  readonly editing = signal<TableCalendarEventView | null>(null);
  readonly draft = signal<CampaignScheduleEvent | null>(null);
  readonly panelOpen = signal(false);

  constructor() {
    effect(() => {
      const events = this.scheduleEvents();
      const d = untracked(() => this.draft());
      if (!d) return;
      const fresh = events.find((e) => e.id === d.id);
      if (!fresh) return;
      const next = fresh.rsvps ?? [];
      const cur = d.rsvps ?? [];
      if (JSON.stringify(next) === JSON.stringify(cur)) return;
      untracked(() =>
        this.draft.update((prev) => (prev ? { ...prev, rsvps: next.map((r) => ({ ...r })) } : prev)),
      );
    });
  }

  readonly calendarEvents = computed(() =>
    buildTableCalendarEvents(this.sessions(), this.scheduleEvents(), this.isOwner()),
  );

  readonly fcEvents = computed((): EventInput[] =>
    this.calendarEvents().map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end ?? undefined,
      allDay: e.allDay,
      backgroundColor: e.backgroundColor,
      borderColor: e.borderColor,
      editable: e.editable,
      extendedProps: { source: e.source, kind: e.kind, status: e.status },
    })),
  );

  readonly options = computed((): CalendarOptions => ({
    plugins: [breezyThemePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    locale: frLocale,
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listMonth',
    },
    height: 'auto',
    // Soirées de table : pas de grille 24h
    slotMinTime: '12:00:00',
    slotMaxTime: '22:00:00',
    scrollTime: '18:00:00',
    slotDuration: '00:30:00',
    selectable: this.isOwner(),
    editable: this.isOwner(),
    eventStartEditable: this.isOwner(),
    eventDurationEditable: this.isOwner(),
    selectMirror: true,
    dayMaxEvents: true,
    nowIndicator: true,
    select: (arg) => this.onSelect(arg),
    eventClick: (arg) => this.onEventClick(arg),
    eventDrop: (arg) => this.onEventDrop(arg),
    eventResize: (arg) => this.onEventResize(arg),
  }));

  kindLabel = scheduleKindLabel;

  addBlankDate(): void {
    if (!this.isOwner()) return;
    const created = createCampaignScheduleEvent({
      title: 'Nouvelle date',
      kind: 'game',
      startsAt: defaultTableStartsAt().toISOString(),
    });
    this.editing.set({
      id: `schedule:${created.id}`,
      source: 'schedule',
      title: created.title,
      start: created.startsAt,
      end: created.endsAt,
      allDay: !!created.allDay,
      kind: created.kind,
      characterIds: [],
      backgroundColor: '#b45309',
      borderColor: '#fbbf24',
      editable: true,
    });
    this.draft.set(created);
    this.panelOpen.set(true);
  }

  exportIcs(): void {
    const title = this.campaignTitle().trim() || 'Campagne';
    const ics = buildIcsCalendar(
      title,
      tableEventsToIcsInputs(title, this.sessions(), this.scheduleEvents()),
    );
    const safe = title.replace(/[^\w-]+/g, '_').slice(0, 40) || 'campagne';
    downloadIcsFile(`${safe}-calendrier.ics`, ics);
  }

  openGoogleForDraft(): void {
    const d = this.draft();
    if (!d) return;
    const title = this.campaignTitle().trim() || 'Campagne';
    const url = googleCalendarTemplateUrl({
      uid: d.id,
      title: `[${title}] ${d.title}`,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      allDay: d.allDay,
      location: d.location,
      description: [scheduleKindLabel(d.kind), d.notes].filter(Boolean).join('\n'),
    });
    window.open(url, '_blank', 'noopener');
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.editing.set(null);
    this.draft.set(null);
  }

  saveDraft(): void {
    const d = this.draft();
    const edit = this.editing();
    if (!d || !this.isOwner()) return;
    if (edit?.source === 'session') {
      this.closePanel();
      return;
    }
    const next = this.scheduleEvents().slice();
    const idx = next.findIndex((e) => e.id === d.id);
    if (idx >= 0) next[idx] = { ...d };
    else next.unshift({ ...d });
    this.scheduleEventsChange.emit(next);
    this.closePanel();
  }

  deleteDraft(): void {
    const d = this.draft();
    if (!d || !this.isOwner()) return;
    this.scheduleEventsChange.emit(this.scheduleEvents().filter((e) => e.id !== d.id));
    this.closePanel();
  }

  convertDraftToSession(): void {
    const d = this.draft();
    if (!d || !this.isOwner()) return;
    this.convertToSession.emit({ ...d });
    this.closePanel();
  }

  openLinkedSession(): void {
    const edit = this.editing();
    if (edit?.source === 'session') {
      const parsed = parseCalendarEventId(edit.id);
      if (parsed) this.openSession.emit(parsed.entityId);
      return;
    }
    const linked = this.draft()?.linkedSessionId;
    if (linked) this.openSession.emit(linked);
  }

  patchDraft(partial: Partial<CampaignScheduleEvent>): void {
    this.draft.update((d) => (d ? { ...d, ...partial } : d));
  }

  setStartsLocal(value: string): void {
    this.patchDraft({ startsAt: fromDatetimeLocalValue(value) });
  }

  setEndsLocal(value: string): void {
    this.patchDraft({ endsAt: value ? fromDatetimeLocalValue(value) : null });
  }

  toggleHero(id: string): void {
    const d = this.draft();
    if (!d) return;
    const set = new Set(d.characterIds ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this.patchDraft({ characterIds: [...set] });
  }

  heroSelected(id: string): boolean {
    return (this.draft()?.characterIds ?? []).includes(id);
  }

  myRsvpStatus(): 'yes' | 'no' | 'maybe' | null {
    const uid = this.currentUserId();
    const d = this.draft();
    if (!uid || !d?.rsvps?.length) return null;
    return (d.rsvps.find((r) => r.userId === uid)?.status as 'yes' | 'no' | 'maybe') ?? null;
  }

  setRsvp(status: 'yes' | 'no' | 'maybe'): void {
    const d = this.draft();
    const uid = this.currentUserId();
    if (!d || !uid) return;
    const others = (d.rsvps ?? []).filter((r) => r.userId !== uid);
    this.draft.set({
      ...d,
      rsvps: [
        ...others,
        { userId: uid, status, at: new Date().toISOString() },
      ],
    });
    this.rsvpChange.emit({ eventId: d.id, status });
  }

  rsvpSummary(): string {
    const list = this.draft()?.rsvps ?? [];
    if (!list.length) return 'Aucune réponse';
    const yes = list.filter((r) => r.status === 'yes').length;
    const no = list.filter((r) => r.status === 'no').length;
    const maybe = list.filter((r) => r.status === 'maybe').length;
    return `${yes} oui · ${maybe} peut-être · ${no} non`;
  }

  startsLocal(): string {
    return datetimeLocalValue(this.draft()?.startsAt);
  }

  endsLocal(): string {
    return datetimeLocalValue(this.draft()?.endsAt);
  }

  private onSelect(arg: DateSelectInfo): void {
    if (!this.isOwner()) return;
    arg.view.calendar.unselect();
    const allDay = arg.allDay;
    const startsAt = arg.start.toISOString();
    const endsAt = arg.end ? arg.end.toISOString() : null;
    const created = createCampaignScheduleEvent({
      title: 'Nouvelle date',
      startsAt,
      endsAt,
      allDay,
      kind: 'game',
    });
    this.editing.set({
      id: `schedule:${created.id}`,
      source: 'schedule',
      title: created.title,
      start: created.startsAt,
      end: created.endsAt,
      allDay: !!created.allDay,
      kind: created.kind,
      characterIds: [],
      backgroundColor: '#b45309',
      borderColor: '#fbbf24',
      editable: true,
    });
    this.draft.set(created);
    this.panelOpen.set(true);
  }

  private onEventClick(arg: EventClickInfo): void {
    const parsed = parseCalendarEventId(arg.event.id);
    if (!parsed) return;
    if (parsed.source === 'session') {
      const session = this.sessions().find((s) => s.id === parsed.entityId);
      if (!session) return;
      const view = buildTableCalendarEvents([session], [], this.isOwner())[0] ?? null;
      this.editing.set(view);
      this.draft.set(null);
      this.panelOpen.set(true);
      return;
    }
    const ev = this.scheduleEvents().find((e) => e.id === parsed.entityId);
    if (!ev) return;
    const view = buildTableCalendarEvents([], [ev], this.isOwner())[0] ?? null;
    this.editing.set(view);
    this.draft.set({ ...ev, characterIds: [...(ev.characterIds ?? [])] });
    this.panelOpen.set(true);
  }

  private onEventDrop(arg: EventDropInfo): void {
    this.applyMoveResize(arg);
  }

  private onEventResize(arg: EventResizeDoneInfo): void {
    this.applyMoveResize(arg);
  }

  private applyMoveResize(arg: EventDropInfo | EventResizeDoneInfo): void {
    if (!this.isOwner()) {
      arg.revert();
      return;
    }
    const parsed = parseCalendarEventId(arg.event.id);
    if (!parsed) {
      arg.revert();
      return;
    }
    const startsAt = arg.event.start?.toISOString();
    if (!startsAt) {
      arg.revert();
      return;
    }
    const endsAt = arg.event.end?.toISOString() ?? null;
    const allDay = arg.event.allDay;

    if (parsed.source === 'schedule') {
      const next = this.scheduleEvents().map((e) =>
        e.id === parsed.entityId ? { ...e, startsAt, endsAt, allDay } : e,
      );
      this.scheduleEventsChange.emit(next);
      return;
    }

    // Sessions stay date-edited in the Sessions tab for V1.
    arg.revert();
  }
}

/** Prochaine soirée typique (18h), jamais le matin. */
function defaultTableStartsAt(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(0);
  if (d.getHours() >= 22) {
    d.setDate(d.getDate() + 1);
    d.setHours(18);
  } else if (d.getHours() < 18) {
    d.setHours(18);
  }
  return d;
}
