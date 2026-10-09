import { emptyCampaignData } from '@core/models/Campaign/campaign';
import type {
  CampaignDetail,
  CampaignHandout,
  CampaignMember,
  CampaignPregen,
  CampaignScheduleEvent,
  CampaignSession,
} from '@core/models/Campaign/campaign';
import type { StoryCreatureSelection } from '@core/models/Story/story';
import {
  approvedPlayersWithCharacter,
  calendarHeroOptions,
  creaturesByRoleBucket,
  documentCount,
  countSessionsByStatus,
  findPlayerMember,
  hubNextActionForPlayer,
  invitableFriends,
  lastPublishedHandoutTitle,
  membersByRole,
  nextHubTableSlot,
  nextPlannedSession,
  nextScheduleGame,
  otherPlayers,
  ownerActiveSession,
  pastSessions,
  pdfSheetMembers,
  pdfUnassignedPregens,
  pendingHubRsvp,
  pendingProposals,
  pinnedPublishedHandout,
  playersNeedingCharacter,
  readyPregenCount,
  sessionById,
  sortedHandouts,
  sortedSessionsByDate,
  totalXpAwarded,
  upcomingPlannedSessions,
} from './campaign-hub-view.util';

function member(over: Partial<CampaignMember> = {}): CampaignMember {
  return {
    id: 'm1',
    userId: 'u1',
    displayName: 'Alice',
    role: 'player',
    proposalStatus: 'none',
    xpEarnedInCampaign: 0,
    ...over,
  };
}

function session(over: Partial<CampaignSession> = {}): CampaignSession {
  return {
    id: 's1',
    title: 'Soirée',
    scheduledAt: '2026-10-20T19:00:00.000Z',
    status: 'planned',
    ...over,
  };
}

function pregen(over: Partial<CampaignPregen> = {}): CampaignPregen {
  return {
    id: 'p1',
    characterId: 'ch1',
    characterName: 'Mira',
    publicHook: '',
    dmBackstory: '',
    dmSecrets: '',
    status: 'ready',
    ...over,
  };
}

function campaign(over: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 'c1',
    title: 'Hub',
    role: 'player',
    isOwner: false,
    updatedAt: '',
    members: [],
    data: emptyCampaignData(),
    ...over,
  };
}

function creature(role: StoryCreatureSelection['role']): StoryCreatureSelection {
  return {
    creatureId: 'g',
    creatureName: 'Gob',
    category: 'humanoid',
    challengeRating: '1/4',
    customName: 'Grib',
    role,
    backstory: '',
  };
}

describe('campaign-hub-view.util', () => {
  const now = Date.parse('2026-10-01T00:00:00.000Z');

  it('splits roster / PDF / XP lists', () => {
    const approved = member({
      proposalStatus: 'approved',
      approvedCharacterId: 'chA',
    });
    const pending = member({
      id: 'm2',
      userId: 'u2',
      proposalStatus: 'pending',
      proposedCharacterId: 'chP',
    });
    const need = member({ id: 'm3', userId: 'u3' });
    const players = [approved, pending, need];
    expect(membersByRole([approved, member({ role: 'spectator', id: 's' })], 'player').length).toBe(1);
    expect(approvedPlayersWithCharacter(players)).toEqual([approved]);
    expect(pdfSheetMembers(players).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(pendingProposals(players)).toEqual([pending]);
    expect(playersNeedingCharacter(players).map((m) => m.id)).toEqual(['m3']);
    expect(totalXpAwarded([approved, member({ xpEarnedInCampaign: 12, id: 'x', userId: 'ux' })])).toBe(12);
    expect(
      invitableFriends(
        [{ id: 'u9', displayName: 'Bob' }, { id: 'u1', displayName: 'Alice' }],
        players,
        new Set(['u9']),
      ),
    ).toEqual([]);
    expect(
      invitableFriends([{ id: 'u9', displayName: 'Bob' }], players, new Set()),
    ).toEqual([{ id: 'u9', displayName: 'Bob' }]);
    expect(otherPlayers(players, 'u1').map((p) => p.id)).toEqual(['m2', 'm3']);
    expect(findPlayerMember(players, null)).toBeUndefined();
    expect(findPlayerMember(players, 'u1')?.id).toBe('m1');
    expect(countSessionsByStatus([session(), session({ status: 'played', id: 'p' })], 'played')).toBe(1);
  });

  it('hides assigned pregens already on a sheet', () => {
    const sheet = [member({ approvedCharacterId: 'ch1', proposalStatus: 'approved' })];
    expect(
      pdfUnassignedPregens(
        [
          pregen(),
          pregen({ id: 'p2', characterId: 'ch2', status: 'assigned' }),
          pregen({ id: 'p3', characterId: 'ch3', assignedUserId: 'u1' }),
        ],
        sheet,
      ).map((p) => p.id),
    ).toEqual([]);
    expect(pdfUnassignedPregens([pregen({ characterId: 'free' })], sheet)[0].characterId).toBe('free');
    expect(
      pdfUnassignedPregens([pregen({ id: 'claimed', characterId: 'cx', status: 'claimed' })], []),
    ).toEqual([]);
  });

  it('orders sessions and owner active session', () => {
    const a = session({ id: 'a', scheduledAt: '2026-10-10T19:00:00.000Z' });
    const b = session({ id: 'b', scheduledAt: '2026-10-05T19:00:00.000Z', status: 'played' });
    const c = session({ id: 'c', scheduledAt: '2026-11-01T19:00:00.000Z' });
    expect(pastSessions([a, b]).map((s) => s.id)).toEqual(['b']);
    expect(upcomingPlannedSessions([c, a]).map((s) => s.id)).toEqual(['a', 'c']);
    expect(sortedSessionsByDate([c, a]).map((s) => s.id)).toEqual(['a', 'c']);
    expect(nextPlannedSession([a, c], now)?.id).toBe('a');
    expect(nextPlannedSession([session({ scheduledAt: '2020-01-01T00:00:00.000Z' })], now)?.id).toBe('s1');
    expect(sessionById([a], null)).toBeNull();
    expect(
      ownerActiveSession(
        campaign({
          isOwner: true,
          role: 'dm',
          data: { ...emptyCampaignData(), activeSessionId: 'a', sessions: [a] },
        }),
      )?.id,
    ).toBe('a');
    expect(ownerActiveSession(campaign())).toBeNull();
    expect(
      ownerActiveSession(
        campaign({
          isOwner: true,
          role: 'dm',
          data: { ...emptyCampaignData(), activeSessionId: 'missing', sessions: [a] },
        }),
      ),
    ).toBeNull();
    expect(sessionById([a], 'a')?.id).toBe('a');
    expect(membersByRole(undefined, 'player')).toEqual([]);
    expect(readyPregenCount(undefined)).toBe(0);
  });

  it('picks next schedule / hub slot / RSVP', () => {
    const ev: CampaignScheduleEvent = {
      id: 'e1',
      title: 'Vendredi',
      startsAt: '2026-10-20T19:00:00.000Z',
      kind: 'game',
    };
    const later: CampaignScheduleEvent = {
      id: 'e2',
      title: '',
      startsAt: '2026-11-01T19:00:00.000Z',
      kind: 'game',
    };
    expect(nextScheduleGame([ev, later, { ...ev, id: 'prep', kind: 'prep' }], now)?.id).toBe('e1');
    expect(
      nextScheduleGame([{ ...ev, id: 'nokind', kind: '' as CampaignScheduleEvent['kind'] }], now)
        ?.id,
    ).toBe('nokind');
    expect(nextScheduleGame([], now)).toBeNull();
    expect(nextHubTableSlot(null, null)).toBeNull();
    const sess = session({ scheduledAt: '2026-10-20T18:00:00.000Z' });
    expect(nextHubTableSlot(sess, nextScheduleGame([later], now))?.source).toBe('session');
    expect(nextHubTableSlot(null, nextScheduleGame([ev], now))?.source).toBe('schedule');
    expect(
      nextHubTableSlot(
        session({ scheduledAt: '2026-11-10T19:00:00.000Z' }),
        nextScheduleGame([ev], now),
      )?.source,
    ).toBe('schedule');
    expect(nextScheduleGame([{ ...ev, startsAt: '2020-01-01T00:00:00.000Z' }], now)).toBeNull();

    const rsvpCamp = campaign({
      data: {
        ...emptyCampaignData(),
        scheduleEvents: [
          ev,
          { ...ev, id: 'mine', rsvps: [{ userId: 'u1', status: 'yes', at: ev.startsAt }] },
        ],
      },
    });
    expect(pendingHubRsvp(rsvpCamp, 'u1', (iso) => iso, now)?.eventId).toBe('e1');
    expect(pendingHubRsvp(campaign({ isOwner: true, role: 'dm' }), 'u1', () => '', now)).toBeNull();
    expect(pendingHubRsvp(campaign({ role: 'spectator' }), 'u1', () => '', now)).toBeNull();
    expect(
      pendingHubRsvp(
        campaign({
          data: {
            ...emptyCampaignData(),
            scheduleEvents: [{ ...ev, startsAt: '2020-01-01T00:00:00.000Z' }],
          },
        }),
        'u1',
        () => '',
        now,
      ),
    ).toBeNull();
  });

  it('builds player next action and documents helpers', () => {
    expect(hubNextActionForPlayer(null, undefined, null, null)).toBeNull();
    expect(
      hubNextActionForPlayer(
        campaign({ isOwner: true, role: 'dm' }),
        undefined,
        null,
        null,
      ),
    ).toBeNull();
    const action = hubNextActionForPlayer(
      campaign(),
      member({ proposalStatus: 'rejected' }),
      null,
      null,
    );
    expect(action?.cta).toBeTruthy();
    expect(
      hubNextActionForPlayer(campaign(), member({ proposalStatus: 'pending' }), null, null)?.kind,
    ).toBe('wait_approval');
    expect(
      hubNextActionForPlayer(
        campaign(),
        member({ proposalStatus: 'approved', approvedCharacterId: 'chA' }),
        null,
        null,
      )?.kind,
    ).toBe('idle');
    expect(
      hubNextActionForPlayer(
        campaign(),
        member({ proposalStatus: 'approved', approvedCharacterId: 'chA' }),
        session(),
        null,
      )?.kind,
    ).toBe('wait_session');
    expect(hubNextActionForPlayer(campaign({ role: 'spectator' }), undefined, null, null)?.kind).toBe(
      'spectator',
    );
    expect(lastPublishedHandoutTitle([])).toBeNull();
    expect(pinnedPublishedHandout(campaign())).toBeNull();

    const handout = (over: Partial<CampaignHandout> = {}): CampaignHandout =>
      ({
        id: 'h1',
        title: 'Carte',
        kind: 'map',
        body: '',
        published: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...over,
      }) as CampaignHandout;
    const dm = campaign({
      isOwner: true,
      role: 'dm',
      data: {
        ...emptyCampaignData(),
        pinnedHandoutId: 'h1',
        handouts: [handout(), handout({ id: 'h2', published: false, title: 'Secret' })],
      },
    });
    expect(documentCount(null)).toBe(0);
    expect(documentCount(dm)).toBe(2);
    expect(documentCount(campaign({ data: dm.data }))).toBe(1);
    expect(pinnedPublishedHandout(dm)?.id).toBe('h1');
    expect(lastPublishedHandoutTitle(dm.data.handouts)).toBe('Carte');
    expect(sortedHandouts(dm.data.handouts, 'map').length).toBe(2);
    expect(sortedHandouts(dm.data.handouts, 'summary').length).toBe(0);
    expect(sortedHandouts(dm.data.handouts, 'all').length).toBe(2);
    expect(
      lastPublishedHandoutTitle([
        handout({ publishedAt: '2026-02-01T00:00:00.000Z', title: 'Old' }),
        handout({
          id: 'h3',
          publishedAt: '2026-03-01T00:00:00.000Z',
          title: 'New',
        }),
      ]),
    ).toBe('New');
    expect(
      hubNextActionForPlayer(
        campaign({ data: { ...emptyCampaignData(), activeSessionId: 's1' } }),
        member({ proposalStatus: 'approved', approvedCharacterId: 'chA' }),
        null,
        null,
      )?.kind,
    ).toBe('enter_play');
    expect(
      hubNextActionForPlayer(
        campaign(),
        member({ proposalStatus: 'approved', approvedCharacterId: 'chA' }),
        null,
        { eventId: 'e1', title: 'Vendredi', whenLabel: 'demain' },
      )?.kind,
    ).toBe('rsvp');
  });

  it('groups creatures and calendar heroes', () => {
    const list = [creature('ally'), creature('antagonist'), creature('neutral')];
    expect(creaturesByRoleBucket(list, 'ally').length).toBe(1);
    expect(creaturesByRoleBucket(list, 'other')[0].role).toBe('neutral');
    expect(calendarHeroOptions(null)).toEqual([]);
    expect(
      calendarHeroOptions(
        campaign({
          members: [
            member({ displayName: 'Sans fiche' }),
            member({
              role: 'dm',
              approvedCharacterId: 'chA',
              approvedCharacterName: 'Thorn',
            }),
            member({
              id: 'dup',
              userId: 'ud',
              approvedCharacterId: 'chA',
              approvedCharacterName: 'Thorn 2',
            }),
          ],
          data: {
            ...emptyCampaignData(),
            pregenCharacters: [
              pregen({ characterId: 'chA', label: 'skip' }),
              pregen({ characterId: 'chP', characterName: '', label: '' }),
            ],
          },
        }),
      ).map((o) => o.label),
    ).toEqual(['Thorn (MJ)', 'Pré-tiré (pré-tiré)']);
    expect(readyPregenCount([pregen(), pregen({ status: 'claimed', id: 'x' })])).toBe(1);
  });
});
