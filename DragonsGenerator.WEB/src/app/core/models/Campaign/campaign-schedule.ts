/** Type d’entrée du calendrier de table (hors / autour du play). */
export type CampaignScheduleKind = 'game' | 'prep' | 'social' | 'other';

export const CAMPAIGN_SCHEDULE_KIND_LABELS: Record<CampaignScheduleKind, string> = {
  game: 'Soirée de jeu',
  prep: 'Préparation',
  social: 'Social / hors jeu',
  other: 'Autre',
};

/** Réponse d’un joueur à une date de table. */
export type ScheduleRsvpStatus = 'yes' | 'no' | 'maybe';

export interface ScheduleRsvp {
  userId: string;
  displayName?: string;
  status: ScheduleRsvpStatus;
  at: string;
}

/** Date libre du calendrier de table (pas forcément une session de play). */
export interface CampaignScheduleEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  allDay?: boolean;
  kind: CampaignScheduleKind;
  location?: string;
  notes?: string;
  /** Héros liés (ids personnages cloud / pré-tirés). */
  characterIds?: string[];
  /** Optionnel : lier une vraie session de play. */
  linkedSessionId?: string | null;
  createdByUserId?: string;
  /**
   * Récurrence iCalendar (sous-ensemble) — ex. `FREQ=WEEKLY;INTERVAL=1`.
   * Absent / vide = ponctuel.
   */
  rrule?: string | null;
  /** Confirmations joueurs (oui / non / peut-être). */
  rsvps?: ScheduleRsvp[];
}

/** Presets RRULE pour l’UI calendrier. */
export const CAMPAIGN_SCHEDULE_RRULE_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'Une seule fois' },
  { value: 'FREQ=WEEKLY;INTERVAL=1', label: 'Chaque semaine' },
  { value: 'FREQ=WEEKLY;INTERVAL=2', label: 'Toutes les 2 semaines' },
  { value: 'FREQ=MONTHLY;INTERVAL=1', label: 'Chaque mois' },
];

export function createCampaignScheduleEvent(
  partial?: Partial<CampaignScheduleEvent>,
): CampaignScheduleEvent {
  const starts = partial?.startsAt ? new Date(partial.startsAt) : new Date();
  const ends =
    partial?.endsAt != null
      ? partial.endsAt
      : new Date(starts.getTime() + 3 * 60 * 60 * 1000).toISOString();
  return {
    id: partial?.id ?? crypto.randomUUID?.() ?? `sched-${Date.now()}`,
    title: partial?.title?.trim() || 'Soirée de table',
    startsAt: starts.toISOString(),
    endsAt: ends,
    allDay: partial?.allDay ?? false,
    kind: partial?.kind ?? 'game',
    location: partial?.location ?? '',
    notes: partial?.notes ?? '',
    characterIds: partial?.characterIds ? [...partial.characterIds] : [],
    linkedSessionId: partial?.linkedSessionId ?? null,
    createdByUserId: partial?.createdByUserId,
    rrule: partial?.rrule?.trim() || null,
    rsvps: partial?.rsvps ? [...partial.rsvps] : [],
  };
}
