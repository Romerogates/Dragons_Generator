import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import type { CalendarOptions, EventClickInfo, EventInput } from 'fullcalendar';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import listPlugin from '@fullcalendar/angular/list';
import breezyThemePlugin from '@fullcalendar/angular/themes/breezy';
import frLocale from 'fullcalendar/locales/fr';
import 'temporal-polyfill/global';

import {
  AgendaEventDto,
  CampaignCloudService,
} from '@core/services/campaign-cloud.service';
import {
  buildIcsCalendar,
  downloadIcsFile,
  type IcsEventInput,
} from '@core/utils/schedule-ics.util';

@Component({
  selector: 'app-global-agenda',
  standalone: true,
  imports: [CommonModule, RouterLink, FullCalendarModule],
  templateUrl: './global-agenda.html',
  styleUrl: './global-agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalAgendaPage implements OnInit {
  private readonly campaigns = inject(CampaignCloudService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly events = signal<AgendaEventDto[]>([]);

  readonly fcEvents = computed((): EventInput[] =>
    this.events().map((e) => {
      const colors = eventColors(e);
      return {
        id: e.id,
        title: `${e.campaignTitle} · ${e.title}`,
        start: e.startsAt,
        end: e.endsAt ?? undefined,
        allDay: e.allDay,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        editable: false,
        extendedProps: {
          campaignId: e.campaignId,
          source: e.source,
          status: e.status,
          kind: e.kind,
        },
      };
    }),
  );

  readonly options = computed((): CalendarOptions => ({
    plugins: [breezyThemePlugin, dayGridPlugin, timeGridPlugin, listPlugin],
    locale: frLocale,
    initialView: 'listMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listMonth',
    },
    height: 'auto',
    slotMinTime: '12:00:00',
    slotMaxTime: '22:00:00',
    scrollTime: '18:00:00',
    slotDuration: '00:30:00',
    editable: false,
    selectable: false,
    dayMaxEvents: true,
    nowIndicator: true,
    eventClick: (arg) => this.onEventClick(arg),
  }));

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.campaigns.listAgenda().subscribe({
      next: (list) => {
        this.events.set(list ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger l’agenda.');
        this.loading.set(false);
      },
    });
  }

  exportIcs(): void {
    const inputs: IcsEventInput[] = this.events().map((e) => ({
      uid: `${e.id}@dragons-generator`,
      title: `[${e.campaignTitle}] ${e.title}`,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      location: e.location ?? undefined,
      description: [e.source === 'session' ? `Session (${e.status ?? ''})` : e.kind, e.campaignTitle]
        .filter(Boolean)
        .join('\n'),
    }));
    const ics = buildIcsCalendar('Agenda Dragons Generator', inputs);
    downloadIcsFile('agenda-dragons.ics', ics);
  }

  private onEventClick(arg: EventClickInfo): void {
    const campaignId = arg.event.extendedProps['campaignId'] as string | undefined;
    const source = arg.event.extendedProps['source'] as string | undefined;
    if (!campaignId) return;
    const tab = source === 'session' ? 'sessions' : 'calendar';
    void this.router.navigate(['/campaigns', campaignId], { queryParams: { tab } });
  }
}

function eventColors(e: AgendaEventDto): { bg: string; border: string } {
  if (e.source === 'session') {
    if (e.status === 'played') return { bg: '#047857', border: '#34d399' };
    if (e.status === 'cancelled') return { bg: '#57534e', border: '#78716c' };
    return { bg: '#7c3aed', border: '#a78bfa' };
  }
  switch (e.kind) {
    case 'prep':
      return { bg: '#1d4ed8', border: '#60a5fa' };
    case 'social':
      return { bg: '#be185d', border: '#f472b6' };
    case 'other':
      return { bg: '#475569', border: '#94a3b8' };
    default:
      return { bg: '#b45309', border: '#fbbf24' };
  }
}
