import type { ScheduleRsvp, ScheduleRsvpStatus } from '@core/models/Campaign/campaign';

export interface RsvpCounts {
  yes: number;
  no: number;
  maybe: number;
  total: number;
}

export function countScheduleRsvps(rsvps: ScheduleRsvp[] | null | undefined): RsvpCounts {
  const list = rsvps ?? [];
  let yes = 0;
  let no = 0;
  let maybe = 0;
  for (const r of list) {
    if (r.status === 'yes') yes++;
    else if (r.status === 'no') no++;
    else if (r.status === 'maybe') maybe++;
  }
  return { yes, no, maybe, total: list.length };
}

/** Ex. `2 oui · 1 peut-être · 0 non` ou `Aucune réponse`. */
export function formatRsvpSummary(rsvps: ScheduleRsvp[] | null | undefined): string {
  const c = countScheduleRsvps(rsvps);
  if (c.total === 0) return 'Aucune réponse';
  return `${c.yes} oui · ${c.maybe} peut-être · ${c.no} non`;
}

export function formatRsvpCounts(c: Pick<RsvpCounts, 'yes' | 'no' | 'maybe' | 'total'>): string {
  if (!c.total) return 'Aucune réponse';
  return `${c.yes} oui · ${c.maybe} peut-être · ${c.no} non`;
}

export function isScheduleRsvpStatus(v: string): v is ScheduleRsvpStatus {
  return v === 'yes' || v === 'no' || v === 'maybe';
}

/** Deep-link calendrier campagne vers une date précise. */
export function campaignScheduleEventUrl(campaignId: string, eventId: string): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://dragons-generator.top';
  return `${base}/campaigns/${campaignId}?tab=calendar&event=${encodeURIComponent(eventId)}`;
}
