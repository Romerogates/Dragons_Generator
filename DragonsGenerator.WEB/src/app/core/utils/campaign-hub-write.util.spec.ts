import {
  atlasAlreadyHasCiv,
  atlasAlreadyHasName,
  bumpEncounterCreatureDefeated,
  canWriteCampaignHub,
  dataAfterDeletingHandout,
  dataAfterRemovingSession,
  formatScheduleOccurrenceLabel,
  handoutPublishPatch,
  inviteErrorMessage,
  linkScheduleEventToSession,
  plannedSessionFromScheduleEvent,
  scheduleYesInviteUserIds,
  shouldDebounceCampaignPersist,
  splitEncounterXp,
  storyEncounterGroups,
  withMappedHandout,
  withMappedSession,
  withMappedEncounter,
  scheduleRsvpFeedback,
  creatureTrackKey,
  withCreatureRole,
  withCreatureCardField,
  withBulkCreatureRole,
} from './campaign-hub-write.util';
import type { EncounterGroup } from '@core/models/Campaign/campaign';
import type { StoryCreatureSelection } from '@core/models/Story/story';

function creature(partial: Partial<StoryCreatureSelection> & { creatureId: string }): StoryCreatureSelection {
  return {
    creatureName: partial.creatureName ?? partial.creatureId,
    category: 'humanoid',
    challengeRating: '1',
    customName: '',
    backstory: '',
    role: 'antagonist',
    ...partial,
  };
}

describe('campaign-hub-write.util', () => {
  it('blocks history and support inspect writes', () => {
    expect(canWriteCampaignHub({ isHistory: true }, false)).toBeFalse();
    expect(canWriteCampaignHub({}, true)).toBeFalse();
    expect(canWriteCampaignHub({}, false)).toBeTrue();
    expect(canWriteCampaignHub(null, false)).toBeFalse();
  });

  it('debounces notes-only patches', () => {
    expect(shouldDebounceCampaignPersist({ notes: 'x' })).toBeTrue();
    expect(shouldDebounceCampaignPersist({ notes: 'x', encounters: [] })).toBeFalse();
    expect(shouldDebounceCampaignPersist({ sessions: [] })).toBeFalse();
  });

  it('bumps defeated within quantity bounds', () => {
    const enc: EncounterGroup[] = [
      {
        id: 'e1',
        name: 'A',
        creatures: [
          {
            creatureId: 'c1',
            creatureName: 'Gob',
            challengeRating: '1/4',
            xp: 50,
            quantity: 2,
            defeated: 1,
          },
        ],
      },
    ];
    expect(bumpEncounterCreatureDefeated(enc, 'e1', 0, 1)[0]!.creatures[0]!.defeated).toBe(2);
    expect(bumpEncounterCreatureDefeated(enc, 'e1', 0, 1)[0]!.creatures[0]!.defeated).toBe(2);
    const over = bumpEncounterCreatureDefeated(
      bumpEncounterCreatureDefeated(enc, 'e1', 0, 1),
      'e1',
      0,
      1,
    );
    expect(over[0]!.creatures[0]!.defeated).toBe(2);
    expect(bumpEncounterCreatureDefeated(enc, 'e1', 0, -1)[0]!.creatures[0]!.defeated).toBe(0);
    expect(bumpEncounterCreatureDefeated(enc, 'e1', 0, -1)[0]!.creatures[0]!.defeated).toBe(0);
    const atZero: EncounterGroup[] = [
      { ...enc[0]!, creatures: [{ ...enc[0]!.creatures[0]!, defeated: 0 }] },
    ];
    expect(bumpEncounterCreatureDefeated(atZero, 'e1', 0, -1)[0]!.creatures[0]!.defeated).toBe(0);
    expect(bumpEncounterCreatureDefeated(enc, 'other', 0, 1)).toEqual(enc);
  });

  it('splits story creatures into main vs secondary encounters', () => {
    const groups = storyEncounterGroups(
      [
        creature({ creatureId: 'a', role: 'antagonist' }),
        creature({ creatureId: 'b', role: 'ally' }),
      ],
      { a: 100, b: 0 },
    );
    expect(groups.map((g) => g.name)).toEqual([
      'Confrontation principale',
      'Rencontres secondaires',
    ]);
    expect(storyEncounterGroups([], {})).toEqual([]);
  });

  it('shares encounter XP per approved player', () => {
    expect(splitEncounterXp(0, 2)).toEqual({ ok: false, reason: 'no-xp' });
    expect(splitEncounterXp(100, 0)).toEqual({ ok: false, reason: 'no-players' });
    expect(splitEncounterXp(2, 5)).toEqual({ ok: false, reason: 'share-zero' });
    expect(splitEncounterXp(100, 4)).toEqual({ ok: true, share: 25 });
  });

  it('builds a planned session and links the calendar event', () => {
    const session = plannedSessionFromScheduleEvent(
      { title: '  Soirée  ', location: 'Discord', notes: 'ok' },
      '2026-10-08T20:00:00.000Z',
      's1',
    );
    expect(session).toEqual(
      jasmine.objectContaining({
        id: 's1',
        title: 'Soirée',
        status: 'planned',
        mode: 'online',
        location: 'Discord',
      }),
    );
    const linked = linkScheduleEventToSession(
      [
        { id: 'e1', title: 'A', startsAt: '', kind: 'game' },
        { id: 'e2', title: 'B', startsAt: '', kind: 'game' },
      ],
      'e1',
      's1',
    );
    expect(linked[0]!.linkedSessionId).toBe('s1');
    expect(linked[1]!.linkedSessionId).toBeUndefined();
  });

  it('invites RSVP yes who are not members yet', () => {
    expect(
      scheduleYesInviteUserIds(
        [
          { status: 'yes', userId: 'a' },
          { status: 'yes', userId: 'b' },
          { status: 'no', userId: 'c' },
          { status: 'yes' },
        ],
        new Set(['b']),
      ),
    ).toEqual(['a']);
  });

  it('reads invite API error reason', () => {
    expect(inviteErrorMessage({})).toBe('Invitation impossible.');
    expect(inviteErrorMessage({ error: { errors: [{ reason: ' Déjà invité ' }] } })).toBe(
      'Déjà invité',
    );
  });

  it('formats a schedule occurrence in fr-FR', () => {
    expect(formatScheduleOccurrenceLabel('2026-10-08T20:00:00.000Z')).toMatch(/\d/);
  });

  it('patches sessions and handouts by id', () => {
    const sessions = withMappedSession(
      [{ id: 's1', title: 'A', scheduledAt: '', status: 'planned' }],
      's1',
      { title: 'B' },
    );
    expect(sessions[0]!.title).toBe('B');
    const handouts = withMappedHandout(
      [{ id: 'h1', title: 'Doc', body: '', kind: 'other', published: false, createdAt: '' }],
      'h1',
      { title: 'Carte' },
      'now',
    );
    expect(handouts[0]!.title).toBe('Carte');
    expect(handouts[0]!.updatedAt).toBe('now');
    expect(handoutPublishPatch(true, 't1')).toEqual({ published: true, publishedAt: 't1' });
    expect(handoutPublishPatch(false, 't1')).toEqual({ published: false });
    const encs = withMappedEncounter(
      [{ id: 'e1', name: 'A', creatures: [], xpAwarded: false }],
      'e1',
      { name: 'Boss' },
    );
    expect(encs[0]!.name).toBe('Boss');
    expect(scheduleRsvpFeedback('Soir', 1, 2, 0)).toBe(
      'Session « Soir » créée · 1 déjà à la table · 2 invitation(s) envoyée(s)',
    );
    expect(scheduleRsvpFeedback('Soir', 0, 0, 1)).toBe(
      'Session « Soir » créée · 1 invitation(s) en échec',
    );
  });

  it('clears handout links and active session on delete', () => {
    const afterHo = dataAfterDeletingHandout(
      {
        handouts: [
          { id: 'h1', title: 'A', body: '', kind: 'other', published: false, createdAt: '' },
          { id: 'h2', title: 'B', body: '', kind: 'other', published: false, createdAt: '' },
        ],
        pinnedHandoutId: 'h1',
        dungeonMaps: [{ id: 'm1', handoutId: 'h1' } as never],
      },
      'h1',
    );
    expect(afterHo.handouts.map((h) => h.id)).toEqual(['h2']);
    expect(afterHo.pinnedHandoutId).toBeNull();
    expect(afterHo.dungeonMaps?.[0]?.handoutId).toBeNull();

    const cleared = dataAfterRemovingSession(
      {
        sessions: [
          { id: 's1', title: 'A', scheduledAt: '', status: 'planned' },
          { id: 's2', title: 'B', scheduledAt: '', status: 'planned' },
        ],
        activeSessionId: 's1',
      },
      's1',
    );
    expect(cleared.clearedActive).toBeTrue();
    expect(cleared.patch.activeSessionId).toBeNull();
    expect((cleared.patch.sessions ?? []).map((s) => s.id)).toEqual(['s2']);
  });

  it('detects duplicate atlas pins', () => {
    const pins = [{ name: 'Valdris', civId: 'civ1' }];
    expect(atlasAlreadyHasCiv(pins, 'civ1')).toBeTrue();
    expect(atlasAlreadyHasCiv(pins, 'civ2')).toBeFalse();
    expect(atlasAlreadyHasName(pins, ' valdris ')).toBeTrue();
    expect(atlasAlreadyHasName(pins, 'Autre')).toBeFalse();
  });

  it('maps creature roles, card fields and bulk classify', () => {
    const gob = creature({ creatureId: 'g1', customName: 'Grik', creatureName: 'Gobelin', role: 'neutral' });
    const orc = creature({ creatureId: 'o1', creatureName: 'Orc', role: 'neutral' });
    expect(creatureTrackKey(gob)).toBe('g1::Grik');
    expect(creatureTrackKey(orc)).toBe('o1::Orc');
    const role = withCreatureRole([gob, orc], gob, 'ally');
    expect(role[0]!.role).toBe('ally');
    expect(role[1]!.role).toBe('neutral');
    const card = withCreatureCardField(role, gob, 'voice', '  grave  ');
    expect(card[0]!.voice).toBe('grave');
    const cleared = withCreatureCardField(card, gob, 'voice', '   ');
    expect(cleared[0]!.voice).toBeUndefined();
    const bulk = withBulkCreatureRole(
      [gob, orc],
      new Set([creatureTrackKey(orc)]),
      'antagonist',
    );
    expect(bulk[0]!.role).toBe('neutral');
    expect(bulk[1]!.role).toBe('antagonist');
  });
});
