import type {
  CampaignDetail,
  CampaignHandout,
  CampaignMember,
  CampaignPregen,
  CampaignScheduleEvent,
  CampaignSession,
  FriendUser,
  HandoutKind,
} from '@core/models/Campaign/campaign';
import type { StoryCreatureSelection } from '@core/models/Story/story';
import { nextScheduleOccurrenceAt } from './schedule-ics.util';
import type { CalendarHeroOption } from './schedule-ics.util';
import { formatRsvpSummary } from './schedule-rsvp.util';
import { resolveHubNextAction, type HubNextAction } from './hub-next-action.util';

export function membersByRole(
  members: CampaignMember[] | undefined,
  role: CampaignMember['role'],
): CampaignMember[] {
  return (members ?? []).filter((m) => m.role === role);
}

export function approvedPlayersWithCharacter(players: CampaignMember[]): CampaignMember[] {
  return players.filter((p) => p.proposalStatus === 'approved' && p.approvedCharacterId);
}

export function pdfSheetMembers(players: CampaignMember[]): CampaignMember[] {
  return players.filter(
    (p) =>
      (p.proposalStatus === 'pending' && !!p.proposedCharacterId) ||
      (p.proposalStatus === 'approved' && !!p.approvedCharacterId),
  );
}

export function pdfUnassignedPregens(
  pregens: CampaignPregen[] | undefined,
  sheetMembers: CampaignMember[],
): CampaignPregen[] {
  const usedCharacterIds = new Set(
    sheetMembers.flatMap((m) =>
      [m.approvedCharacterId, m.proposedCharacterId].filter((id): id is string => !!id),
    ),
  );
  return (pregens ?? []).filter((p) => {
    if (p.status === 'assigned' || p.status === 'claimed') return false;
    if (p.assignedUserId) return false;
    if (usedCharacterIds.has(p.characterId)) return false;
    return true;
  });
}

export function pendingProposals(players: CampaignMember[]): CampaignMember[] {
  return players.filter((p) => p.proposalStatus === 'pending' && p.proposedCharacterId);
}

export function playersNeedingCharacter(players: CampaignMember[]): CampaignMember[] {
  return players.filter((p) => !p.approvedCharacterId && p.proposalStatus !== 'pending');
}

export function invitableFriends(
  friends: FriendUser[],
  players: CampaignMember[],
  pendingUserIds: Set<string>,
): FriendUser[] {
  const memberUserIds = new Set(players.map((m) => m.userId));
  return friends.filter((f) => !memberUserIds.has(f.id) && !pendingUserIds.has(f.id));
}

export function otherPlayers(players: CampaignMember[], me: string | null | undefined): CampaignMember[] {
  return players.filter((p) => p.userId !== me);
}

export function totalXpAwarded(members: CampaignMember[] | undefined): number {
  return membersByRole(members, 'player').reduce((s, m) => s + m.xpEarnedInCampaign, 0);
}

export function findPlayerMember(
  players: CampaignMember[],
  userId: string | null | undefined,
): CampaignMember | undefined {
  if (!userId) return undefined;
  return players.find((p) => p.userId === userId);
}

export function pastSessions(sessions: CampaignSession[] | undefined): CampaignSession[] {
  return [...(sessions ?? [])]
    .filter((s) => s.status === 'played' || s.status === 'cancelled')
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
}

export function upcomingPlannedSessions(sessions: CampaignSession[] | undefined): CampaignSession[] {
  return [...(sessions ?? [])]
    .filter((s) => s.status === 'planned')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

export function sortedSessionsByDate(sessions: CampaignSession[] | undefined): CampaignSession[] {
  return [...(sessions ?? [])].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
}

export function nextPlannedSession(
  sessions: CampaignSession[] | undefined,
  now = Date.now(),
): CampaignSession | null {
  const planned = upcomingPlannedSessions(sessions);
  return planned.find((s) => new Date(s.scheduledAt).getTime() >= now) ?? planned[0] ?? null;
}

export function ownerActiveSession(
  campaign: CampaignDetail | null | undefined,
): CampaignSession | null {
  if (!campaign?.isOwner) return null;
  return sessionById(campaign.data.sessions, campaign.data.activeSessionId);
}

export function sessionById(
  sessions: CampaignSession[] | undefined,
  id: string | null | undefined,
): CampaignSession | null {
  if (!id) return null;
  return (sessions ?? []).find((s) => s.id === id) ?? null;
}

export function pendingHubRsvp(
  campaign: CampaignDetail | null | undefined,
  userId: string | null | undefined,
  formatWhen: (iso: string) => string,
  now = Date.now(),
): { eventId: string; title: string; whenLabel: string } | null {
  if (!campaign || !userId || campaign.isOwner || campaign.role === 'spectator') return null;
  let best: { eventId: string; title: string; whenLabel: string; at: number } | null = null;
  for (const e of campaign.data.scheduleEvents ?? []) {
    if (e.kind && e.kind !== 'game') continue;
    const at = nextScheduleOccurrenceAt(e, new Date(now));
    if (!at) continue;
    const t = new Date(at).getTime();
    if (t < now) continue;
    if ((e.rsvps ?? []).some((r) => r.userId === userId)) continue;
    if (!best || t < best.at) {
      best = {
        eventId: e.id,
        title: e.title || 'Soirée de table',
        whenLabel: formatWhen(at),
        at: t,
      };
    }
  }
  return best ? { eventId: best.eventId, title: best.title, whenLabel: best.whenLabel } : null;
}

export function nextScheduleGame(
  events: CampaignScheduleEvent[] | undefined,
  now = Date.now(),
): { id: string; title: string; startsAt: string; rsvpSummary: string } | null {
  let best: { id: string; title: string; startsAt: string; rsvpSummary: string } | null = null;
  for (const e of events ?? []) {
    if (e.kind && e.kind !== 'game') continue;
    const at = nextScheduleOccurrenceAt(e, new Date(now));
    if (!at) continue;
    const t = new Date(at).getTime();
    if (t < now) continue;
    if (!best || t < new Date(best.startsAt).getTime()) {
      best = {
        id: e.id,
        title: e.title || 'Soirée de table',
        startsAt: at,
        rsvpSummary: formatRsvpSummary(e.rsvps),
      };
    }
  }
  return best;
}

export type NextHubTable = {
  source: 'session' | 'schedule';
  title: string;
  at: string;
  sessionId?: string;
  rsvpSummary?: string;
};

export function nextHubTableSlot(
  session: CampaignSession | null,
  schedule: { title: string; startsAt: string; rsvpSummary: string } | null,
): NextHubTable | null {
  const sessionAt = session ? new Date(session.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
  const scheduleAt = schedule ? new Date(schedule.startsAt).getTime() : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(sessionAt) && !Number.isFinite(scheduleAt)) return null;
  if (session && sessionAt <= scheduleAt) {
    return {
      source: 'session',
      title: session.title,
      at: session.scheduledAt,
      sessionId: session.id,
    };
  }
  if (schedule) {
    return {
      source: 'schedule',
      title: schedule.title,
      at: schedule.startsAt,
      rsvpSummary: schedule.rsvpSummary,
    };
  }
  return null;
}

export function hubNextActionForPlayer(
  campaign: CampaignDetail | null | undefined,
  mine: CampaignMember | undefined,
  planned: CampaignSession | null,
  pendingRsvp: { eventId: string; title: string; whenLabel: string } | null,
): HubNextAction | null {
  if (!campaign || campaign.isOwner) return null;
  let heroStatus: 'none' | 'pending' | 'rejected' | 'approved' = 'none';
  if (mine?.proposalStatus === 'approved' && mine.approvedCharacterId) heroStatus = 'approved';
  else if (mine?.proposalStatus === 'pending') heroStatus = 'pending';
  else if (mine?.proposalStatus === 'rejected') heroStatus = 'rejected';
  return resolveHubNextAction({
    isOwner: false,
    isSpectator: campaign.role === 'spectator',
    heroStatus,
    hasActiveSession: !!campaign.data.activeSessionId,
    hasPlannedSession: !!planned,
    pendingRsvp,
  });
}

export function documentCount(campaign: CampaignDetail | null | undefined): number {
  if (!campaign) return 0;
  const list = campaign.data.handouts ?? [];
  return campaign.isOwner ? list.length : list.filter((h) => h.published).length;
}

export function pinnedPublishedHandout(campaign: CampaignDetail | null | undefined): CampaignHandout | null {
  const pinId = campaign?.data.pinnedHandoutId;
  if (!pinId) return null;
  return (campaign?.data.handouts ?? []).find((h) => h.id === pinId && h.published) ?? null;
}

export function lastPublishedHandoutTitle(handouts: CampaignHandout[] | undefined): string | null {
  const list = (handouts ?? []).filter((h) => h.published);
  if (!list.length) return null;
  return [...list].sort(
    (a, b) =>
      new Date(b.publishedAt ?? b.createdAt).getTime() -
      new Date(a.publishedAt ?? a.createdAt).getTime(),
  )[0].title;
}

export function creaturesByRoleBucket(
  creatures: StoryCreatureSelection[] | undefined,
  bucket: 'ally' | 'antagonist' | 'other',
): StoryCreatureSelection[] {
  const list = creatures ?? [];
  if (bucket === 'other') {
    return list.filter((cr) => cr.role !== 'ally' && cr.role !== 'antagonist');
  }
  return list.filter((cr) => cr.role === bucket);
}

export function calendarHeroOptions(campaign: CampaignDetail | null | undefined): CalendarHeroOption[] {
  if (!campaign) return [];
  const options: CalendarHeroOption[] = [];
  const seen = new Set<string>();
  for (const m of campaign.members ?? []) {
    const id = m.approvedCharacterId || m.proposedCharacterId;
    const name = m.approvedCharacterName || m.proposedCharacterName || m.displayName;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    options.push({
      id,
      label: `${name}${m.role === 'dm' ? ' (MJ)' : ''}`,
    });
  }
  for (const p of campaign.data.pregenCharacters ?? []) {
    if (seen.has(p.characterId)) continue;
    seen.add(p.characterId);
    options.push({
      id: p.characterId,
      label: `${p.characterName || p.label || 'Pré-tiré'} (pré-tiré)`,
    });
  }
  return options;
}

export function sortedHandouts(
  handouts: CampaignHandout[] | undefined,
  filter: HandoutKind | 'all',
): CampaignHandout[] {
  return [...(handouts ?? [])]
    .filter((h) => filter === 'all' || h.kind === filter)
    .sort((a, b) => {
      const ta = new Date(a.publishedAt ?? a.createdAt).getTime();
      const tb = new Date(b.publishedAt ?? b.createdAt).getTime();
      return tb - ta;
    });
}

export function countSessionsByStatus(
  sessions: CampaignSession[] | undefined,
  status: CampaignSession['status'],
): number {
  return (sessions ?? []).filter((s) => s.status === status).length;
}

export function readyPregenCount(pregens: CampaignPregen[] | undefined): number {
  return (pregens ?? []).filter((p) => p.status === 'ready').length;
}
