import type {
  CampaignData,
  CampaignHandout,
  CampaignScheduleEvent,
  CampaignSession,
  EncounterGroup,
} from '@core/models/Campaign/campaign';
import { createEncounterFromCreatures } from '@core/models/Campaign/campaign';
import type { CreatureRole, StoryCreatureSelection } from '@core/models/Story/story';

export type CreatureCardPersistField = 'voice' | 'desire' | 'fear' | 'secret' | 'noteStats';

export function creatureTrackKey(
  cr: Pick<StoryCreatureSelection, 'creatureId' | 'customName' | 'creatureName'>,
): string {
  return `${cr.creatureId}::${cr.customName || cr.creatureName}`;
}

export function withCreatureRole(
  creatures: StoryCreatureSelection[],
  cr: Pick<StoryCreatureSelection, 'creatureId' | 'customName'>,
  role: CreatureRole,
): StoryCreatureSelection[] {
  return creatures.map((entry) =>
    entry.creatureId === cr.creatureId && entry.customName === cr.customName
      ? { ...entry, role }
      : entry,
  );
}

export function withCreatureCardField(
  creatures: StoryCreatureSelection[],
  cr: Pick<StoryCreatureSelection, 'creatureId' | 'customName'>,
  field: CreatureCardPersistField,
  value: string,
): StoryCreatureSelection[] {
  const trimmed = value.trim();
  return creatures.map((entry) =>
    entry.creatureId === cr.creatureId && entry.customName === cr.customName
      ? { ...entry, [field]: trimmed || undefined }
      : entry,
  );
}

export function withBulkCreatureRole(
  creatures: StoryCreatureSelection[],
  keys: Set<string>,
  role: 'ally' | 'antagonist',
): StoryCreatureSelection[] {
  return creatures.map((entry) =>
    keys.has(creatureTrackKey(entry)) ? { ...entry, role } : entry,
  );
}

export function canWriteCampaignHub(
  c: { isHistory?: boolean } | null | undefined,
  supportInspect: boolean,
): boolean {
  return !!c && !c.isHistory && !supportInspect;
}

/** Un patch `notes` seul est debounce ; le reste flush tout de suite. */
export function shouldDebounceCampaignPersist(patch: Partial<CampaignData>): boolean {
  const keys = Object.keys(patch);
  return keys.length === 1 && keys[0] === 'notes';
}

export function bumpEncounterCreatureDefeated(
  encounters: EncounterGroup[],
  encounterId: string,
  creatureIndex: number,
  delta: 1 | -1,
): EncounterGroup[] {
  return encounters.map((enc) => {
    if (enc.id !== encounterId) return enc;
    const creatures = enc.creatures.map((cr, i) => {
      if (i !== creatureIndex) return cr;
      if (delta > 0 && cr.defeated >= cr.quantity) return cr;
      if (delta < 0 && cr.defeated <= 0) return cr;
      return { ...cr, defeated: cr.defeated + delta };
    });
    return { ...enc, creatures };
  });
}

export function storyEncounterGroups(
  creatures: StoryCreatureSelection[],
  xpMap: Record<string, number>,
): EncounterGroup[] {
  const antagonists = creatures.filter((x) => x.role === 'antagonist');
  const others = creatures.filter((x) => x.role !== 'antagonist');
  const groups: EncounterGroup[] = [];
  if (antagonists.length) {
    groups.push(createEncounterFromCreatures('Confrontation principale', antagonists, xpMap));
  }
  if (others.length) {
    groups.push(createEncounterFromCreatures('Rencontres secondaires', others, xpMap));
  }
  return groups;
}

export function splitEncounterXp(
  xpGained: number,
  approvedCount: number,
): { ok: true; share: number } | { ok: false; reason: 'no-xp' | 'no-players' | 'share-zero' } {
  if (xpGained <= 0) return { ok: false, reason: 'no-xp' };
  if (approvedCount <= 0) return { ok: false, reason: 'no-players' };
  const share = Math.floor(xpGained / approvedCount);
  if (share <= 0) return { ok: false, reason: 'share-zero' };
  return { ok: true, share };
}

export function plannedSessionFromScheduleEvent(
  ev: Pick<CampaignScheduleEvent, 'title' | 'location' | 'notes'>,
  scheduledAt: string,
  id: string,
): CampaignSession {
  return {
    id,
    title: ev.title?.trim() || 'Session',
    scheduledAt,
    status: 'planned',
    mode: 'online',
    location: ev.location || undefined,
    notes: ev.notes || undefined,
  };
}

export function linkScheduleEventToSession(
  events: CampaignScheduleEvent[],
  eventId: string,
  sessionId: string,
): CampaignScheduleEvent[] {
  return events.map((e) => (e.id === eventId ? { ...e, linkedSessionId: sessionId } : e));
}

export function scheduleYesInviteUserIds(
  rsvps: { status: string; userId?: string }[] | undefined,
  memberIds: Set<string>,
): string[] {
  return (rsvps ?? [])
    .filter((r) => r.status === 'yes' && r.userId && !memberIds.has(r.userId))
    .map((r) => r.userId as string);
}

export function inviteErrorMessage(err: unknown): string {
  const reason = (err as { error?: { errors?: { reason?: string }[] } })?.error?.errors?.[0]?.reason;
  return reason?.trim() || 'Invitation impossible.';
}

export function withMappedSession(
  sessions: CampaignSession[] | undefined,
  sessionId: string,
  patch: Partial<CampaignSession>,
): CampaignSession[] {
  return (sessions ?? []).map((s) => (s.id === sessionId ? { ...s, ...patch } : s));
}

export function withMappedEncounter(
  encounters: EncounterGroup[] | undefined,
  encounterId: string,
  patch: Partial<EncounterGroup>,
): EncounterGroup[] {
  return (encounters ?? []).map((e) => (e.id === encounterId ? { ...e, ...patch } : e));
}

export function scheduleRsvpFeedback(
  sessionTitle: string,
  yesAlreadyAtTable: number,
  invited: number,
  inviteFails: number,
): string {
  return [
    `Session « ${sessionTitle} » créée`,
    yesAlreadyAtTable ? `${yesAlreadyAtTable} déjà à la table` : null,
    invited ? `${invited} invitation(s) envoyée(s)` : null,
    inviteFails ? `${inviteFails} invitation(s) en échec` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function withMappedHandout(
  handouts: CampaignHandout[] | undefined,
  handoutId: string,
  patch: Partial<CampaignHandout>,
  updatedAt: string,
): CampaignHandout[] {
  return (handouts ?? []).map((h) =>
    h.id === handoutId ? { ...h, ...patch, updatedAt } : h,
  );
}

export function handoutPublishPatch(
  published: boolean,
  publishedAt: string,
): Partial<CampaignHandout> {
  return published ? { published: true, publishedAt } : { published: false };
}

export function dataAfterDeletingHandout(
  data: Pick<CampaignData, 'handouts' | 'pinnedHandoutId' | 'dungeonMaps'>,
  handoutId: string,
): Pick<CampaignData, 'handouts' | 'pinnedHandoutId' | 'dungeonMaps'> {
  return {
    handouts: (data.handouts ?? []).filter((h) => h.id !== handoutId),
    pinnedHandoutId: data.pinnedHandoutId === handoutId ? null : data.pinnedHandoutId,
    dungeonMaps: (data.dungeonMaps ?? []).map((m) =>
      m.handoutId === handoutId ? { ...m, handoutId: null } : m,
    ),
  };
}

export function dataAfterRemovingSession(
  data: Pick<CampaignData, 'sessions' | 'activeSessionId'>,
  sessionId: string,
): { patch: Partial<CampaignData>; clearedActive: boolean } {
  const sessions = (data.sessions ?? []).filter((s) => s.id !== sessionId);
  const clearedActive = data.activeSessionId === sessionId;
  return {
    clearedActive,
    patch: {
      sessions,
      ...(clearedActive ? { activeSessionId: null } : {}),
    },
  };
}

export function atlasAlreadyHasCiv(
  pins: { civId?: string | null }[] | undefined,
  civId: string,
): boolean {
  return (pins ?? []).some((p) => p.civId === civId);
}

export function atlasAlreadyHasName(pins: { name: string }[] | undefined, name: string): boolean {
  const n = name.trim().toLowerCase();
  return (pins ?? []).some((p) => p.name.trim().toLowerCase() === n);
}

export function formatScheduleOccurrenceLabel(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
