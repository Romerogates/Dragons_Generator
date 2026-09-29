import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import type {
  CalendarOptions,
  DateSelectInfo,
  EventClickInfo,
  EventInput,
} from 'fullcalendar';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import listPlugin from '@fullcalendar/angular/list';
import breezyThemePlugin from '@fullcalendar/angular/themes/breezy';
import frLocale from 'fullcalendar/locales/fr';
import 'temporal-polyfill/global';

import {
  AgendaEventDto,
  CampaignCloudService,
} from '@core/services/campaign-cloud.service';
import { CharacterCloudService, CloudCharacterSummary } from '@core/services/character-cloud.service';
import {
  createCampaignScheduleEvent,
  type CampaignScheduleKind,
  type CampaignSummary,
  CAMPAIGN_SCHEDULE_KIND_LABELS,
} from '@core/models/Campaign/campaign';
import {
  buildIcsCalendar,
  datetimeLocalValue,
  downloadIcsFile,
  fromDatetimeLocalValue,
  type IcsEventInput,
} from '@core/utils/schedule-ics.util';

@Component({
  selector: 'app-global-agenda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FullCalendarModule],
  templateUrl: './global-agenda.html',
  styleUrl: './global-agenda.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalAgendaPage implements OnInit {
  private readonly campaignsApi = inject(CampaignCloudService);
  private readonly charactersApi = inject(CharacterCloudService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly events = signal<AgendaEventDto[]>([]);
  readonly ownedCampaigns = signal<CampaignSummary[]>([]);
  readonly heroes = signal<CloudCharacterSummary[]>([]);

  readonly panelOpen = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly draftTitle = signal('Soirée de table');
  readonly draftKind = signal<CampaignScheduleKind>('game');
  readonly draftStartsLocal = signal('');
  readonly draftEndsLocal = signal('');
  /** Vide = date perso (héros / hors campagne). */
  readonly draftCampaignId = signal('');
  readonly draftHeroId = signal('');
  readonly draftNotes = signal('');

  readonly kinds = Object.entries(CAMPAIGN_SCHEDULE_KIND_LABELS) as [
    CampaignScheduleKind,
    string,
  ][];

  /** Campagne MJ **ou** héros (date perso) suffisent. */
  readonly canSave = computed(() => {
    const hasCampaign = !!this.draftCampaignId();
    const hasHero = !!this.draftHeroId().trim();
    return (
      (hasCampaign || hasHero) &&
      !!this.draftStartsLocal() &&
      !!this.draftTitle().trim() &&
      !this.saving()
    );
  });

  readonly canAddDate = computed(
    () => this.ownedCampaigns().length > 0 || this.heroes().length > 0,
  );

  readonly fcEvents = computed((): EventInput[] =>
    this.events().map((e) => {
      const colors = eventColors(e);
      const prefix = e.source === 'personal' ? e.campaignTitle || 'Perso' : e.campaignTitle;
      return {
        id: e.id,
        title: `${prefix} · ${e.title}`,
        start: e.startsAt,
        end: e.endsAt ?? undefined,
        allDay: e.allDay,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        editable: false,
        extendedProps: {
          campaignId: e.campaignId,
          characterId: e.characterId,
          source: e.source,
          status: e.status,
          kind: e.kind,
        },
      };
    }),
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
    slotMinTime: '12:00:00',
    slotMaxTime: '22:00:00',
    scrollTime: '18:00:00',
    slotDuration: '00:30:00',
    editable: false,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    nowIndicator: true,
    select: (arg) => this.onSelect(arg),
    eventClick: (arg) => this.onEventClick(arg),
  }));

  ngOnInit(): void {
    this.reload();
    this.campaignsApi.list().subscribe({
      next: (list) => {
        this.ownedCampaigns.set((list ?? []).filter((c) => c.role === 'dm' && !c.isClosed));
      },
    });
    this.charactersApi.list().subscribe({
      next: (list) => this.heroes.set(list ?? []),
      error: () => this.heroes.set([]),
    });
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.campaignsApi.listAgenda().subscribe({
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

  openAddPanel(startsAt?: Date): void {
    const start = startsAt ?? defaultTableStartsAt();
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    this.draftTitle.set('Soirée de table');
    this.draftKind.set('game');
    this.draftStartsLocal.set(datetimeLocalValue(start.toISOString()));
    this.draftEndsLocal.set(datetimeLocalValue(end.toISOString()));
    this.draftNotes.set('');
    this.saveError.set(null);
    // MJ : préselection campagne (parcours courant). Sans campagne : premier héros → date perso.
    if (this.ownedCampaigns().length) {
      this.draftCampaignId.set(this.ownedCampaigns()[0].id);
      this.draftHeroId.set('');
    } else if (this.heroes().length) {
      this.draftCampaignId.set('');
      this.draftHeroId.set(this.heroes()[0].id);
    } else {
      this.draftCampaignId.set('');
      this.draftHeroId.set('');
    }
    this.panelOpen.set(true);
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.saveError.set(null);
  }

  saveDraft(): void {
    if (!this.canSave()) return;
    const campaignId = this.draftCampaignId().trim();
    const startsAt = fromDatetimeLocalValue(this.draftStartsLocal());
    const endsAt = this.draftEndsLocal()
      ? fromDatetimeLocalValue(this.draftEndsLocal())
      : new Date(new Date(startsAt).getTime() + 3 * 60 * 60 * 1000).toISOString();
    const heroId = this.draftHeroId().trim();
    const hero = this.heroes().find((h) => h.id === heroId);
    const title = this.draftTitle().trim() || 'Soirée de table';
    const notes = this.draftNotes().trim();

    this.saving.set(true);
    this.saveError.set(null);

    // Sans campagne → date perso (héros optionnel mais recommandé côté UI).
    if (!campaignId) {
      this.campaignsApi
        .createPersonalAgendaEvent({
          title,
          startsAt,
          endsAt,
          kind: this.draftKind(),
          notes: notes || undefined,
          characterId: heroId || null,
        })
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.panelOpen.set(false);
            this.reload();
          },
          error: () => {
            this.saving.set(false);
            this.saveError.set('Impossible d’enregistrer la date perso. Réessayez.');
          },
        });
      return;
    }

    const notesParts = [notes, hero ? `Héros : ${hero.name}` : ''].filter(Boolean);
    this.campaignsApi.get(campaignId).subscribe({
      next: (detail) => {
        const created = createCampaignScheduleEvent({
          title,
          kind: this.draftKind(),
          startsAt,
          endsAt,
          characterIds: heroId ? [heroId] : [],
          notes: notesParts.join('\n'),
        });
        const scheduleEvents = [...(detail.data.scheduleEvents ?? []), created];
        this.campaignsApi.update(campaignId, detail.title, { ...detail.data, scheduleEvents }).subscribe({
          next: () => {
            this.saving.set(false);
            this.panelOpen.set(false);
            this.reload();
          },
          error: () => {
            this.saving.set(false);
            this.saveError.set('Impossible d’enregistrer la date. Réessayez.');
          },
        });
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('Impossible de charger la campagne choisie.');
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
      description: [
        e.source === 'session' ? `Session (${e.status ?? ''})` : e.source === 'personal' ? 'Perso' : e.kind,
        e.campaignTitle,
      ]
        .filter(Boolean)
        .join('\n'),
    }));
    const ics = buildIcsCalendar('Agenda Dragons Generator', inputs);
    downloadIcsFile('agenda-dragons.ics', ics);
  }

  private onSelect(arg: DateSelectInfo): void {
    arg.view.calendar.unselect();
    const start = arg.start;
    if (arg.allDay) {
      const d = new Date(start);
      d.setHours(19, 0, 0, 0);
      this.openAddPanel(d);
      return;
    }
    this.openAddPanel(start);
  }

  private onEventClick(arg: EventClickInfo): void {
    const campaignId = arg.event.extendedProps['campaignId'] as string | null | undefined;
    const source = arg.event.extendedProps['source'] as string | undefined;
    if (source === 'personal') {
      void this.router.navigate(['/characters']);
      return;
    }
    if (!campaignId) return;
    const tab = source === 'session' ? 'sessions' : 'calendar';
    void this.router.navigate(['/campaigns', campaignId], { queryParams: { tab } });
  }
}

function defaultTableStartsAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

function eventColors(e: AgendaEventDto): { bg: string; border: string } {
  if (e.source === 'personal') {
    return { bg: '#0e7490', border: '#22d3ee' };
  }
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
