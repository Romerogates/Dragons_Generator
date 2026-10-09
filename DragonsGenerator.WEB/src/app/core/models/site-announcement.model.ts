export type SiteAnnouncementSeverity = 'info' | 'warning' | 'outage';

export interface SiteAnnouncement {
  id: string;
  title: string;
  message: string;
  severity: SiteAnnouncementSeverity;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  active: boolean;
}

export interface CreateSiteAnnouncementRequest {
  title?: string | null;
  message: string;
  severity: SiteAnnouncementSeverity;
  durationDays: number;
}

export const SITE_ANNOUNCEMENT_LIMITS = {
  titleMax: 120,
  messageMin: 3,
  messageMax: 1000,
  minDays: 1,
  maxDays: 60,
} as const;

export function announcementNotificationKey(id: string): string {
  return `announcement-${id}`;
}
