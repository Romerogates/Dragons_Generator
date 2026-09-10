import { mergeRemoteInitiativeRolls, mergeRemoteLiveTable } from './campaign-persist.util';
import type { CampaignDetail } from '@core/models/Campaign/campaign';

function baseCampaign(overrides: Partial<CampaignDetail['data']> = {}): CampaignDetail {
  return {
    id: 'c1',
    title: 'Test',
    role: 'dm',
    isOwner: true,
    updatedAt: '2026-01-01T00:00:00Z',
    members: [],
    data: {
      setting: '',
      regionId: null,
      regionName: '',
      partyLevel: 3,
      tone: 'classic',
      adventure: '',
      creatures: [],
      encounters: [],
      notes: 'notes locales',
      pregenCharacters: [],
      sessions: [
        {
          id: 's1',
          title: 'S1',
          scheduledAt: '2026-01-01T20:00:00Z',
          status: 'planned',
          playNotes: 'brouillon MJ',
          playPads: [
            {
              id: 'pad-1',
              kind: 'note',
              title: 'Notes',
              order: 0,
              page: {
                id: 'nb-1',
                title: 'Notes',
                mode: 'text',
                text: 'calepin local',
                inkStrokes: [],
                updatedAt: '2026-01-01T00:00:00Z',
              },
            },
          ],
          activeCombat: {
            id: 'combat-1',
            label: 'Combat',
            round: 1,
            collectingInitiative: true,
            initiativeCode: 'ABCD',
            turnIndex: 0,
            combatants: [
              {
                id: 'p1',
                name: 'Héro',
                kind: 'player',
                initiativeBonus: 2,
                playerSubmitted: false,
              },
              {
                id: 'm1',
                name: 'Gobelin',
                kind: 'monster',
                initiativeBonus: 1,
                playerSubmitted: false,
              },
            ],
          },
        },
      ],
      handouts: [],
      activeSessionId: 's1',
      dungeonMaps: [],
      ...overrides,
    },
  };
}

describe('mergeRemoteInitiativeRolls', () => {
  it('keeps local play pads while merging player rolls', () => {
    const local = baseCampaign();
    const remote = baseCampaign();
    remote.updatedAt = '2026-01-01T00:01:00Z';
    remote.data.notes = 'notes serveur périmées';
    remote.data.sessions![0].playNotes = 'notes serveur';
    remote.data.sessions![0].playPads = [];
    remote.data.sessions![0].activeCombat!.combatants[0] = {
      id: 'p1',
      name: 'Héro',
      kind: 'player',
      initiativeBonus: 2,
      initiativeRoll: 15,
      playerSubmitted: true,
    };

    const merged = mergeRemoteInitiativeRolls(local, remote);

    expect(merged.data.notes).toBe('notes locales');
    expect(merged.data.sessions![0].playPads?.[0]?.page?.text).toBe('calepin local');
    expect(merged.data.sessions![0].activeCombat!.combatants[0].initiativeRoll).toBe(15);
    expect(merged.data.sessions![0].activeCombat!.combatants[0].playerSubmitted).toBe(true);
    expect(merged.updatedAt).toBe(remote.updatedAt);
  });

  it('only updates updatedAt when no active session or remote combat', () => {
    const noSession = baseCampaign({ activeSessionId: null });
    const remote = baseCampaign();
    remote.updatedAt = '2026-01-02T00:00:00Z';
    expect(mergeRemoteInitiativeRolls(noSession, remote).updatedAt).toBe(remote.updatedAt);
    expect(mergeRemoteInitiativeRolls(noSession, remote).data.notes).toBe('notes locales');

    const local = baseCampaign();
    const remoteNoCombat = baseCampaign();
    remoteNoCombat.updatedAt = '2026-01-03T00:00:00Z';
    remoteNoCombat.data.sessions![0].activeCombat = undefined;
    expect(mergeRemoteInitiativeRolls(local, remoteNoCombat).updatedAt).toBe(
      remoteNoCombat.updatedAt,
    );
    expect(mergeRemoteInitiativeRolls(local, remoteNoCombat).data.sessions![0].playPads?.[0]?.page?.text).toBe(
      'calepin local',
    );
  });

  it('ignores remote combatants without playerSubmitted', () => {
    const local = baseCampaign();
    const remote = baseCampaign();
    remote.data.sessions![0].activeCombat!.combatants[0] = {
      id: 'p1',
      name: 'Héro',
      kind: 'player',
      initiativeBonus: 2,
      initiativeRoll: 99,
      playerSubmitted: false,
    };
    remote.data.sessions![0].activeCombat!.initiativeCode = 'ZZZZ';
    const merged = mergeRemoteInitiativeRolls(local, remote);
    expect(merged.data.sessions![0].activeCombat!.combatants[0].initiativeRoll).toBeUndefined();
    expect(merged.data.sessions![0].activeCombat!.initiativeCode).toBe('ZZZZ');
  });

  it('keeps local initiativeCode and skips non-active sessions', () => {
    const local = baseCampaign({
      sessions: [
        {
          id: 'other',
          title: 'Autre',
          scheduledAt: '2026-01-01T18:00:00Z',
          status: 'planned',
          playNotes: '',
          playPads: [],
        },
        {
          id: 's1',
          title: 'S1',
          scheduledAt: '2026-01-01T20:00:00Z',
          status: 'planned',
          playNotes: 'brouillon MJ',
          playPads: [],
          activeCombat: {
            id: 'combat-1',
            label: 'Combat',
            round: 1,
            collectingInitiative: true,
            initiativeCode: 'KEEP',
            turnIndex: 0,
            combatants: [
              {
                id: 'p1',
                name: 'Héro',
                kind: 'player',
                initiativeBonus: 2,
                playerSubmitted: false,
              },
            ],
          },
        },
      ],
    });
    const remote = baseCampaign();
    remote.updatedAt = '2026-01-04T00:00:00Z';
    remote.data.sessions![0].activeCombat!.initiativeCode = undefined;
    remote.data.sessions![0].activeCombat!.combatants[0] = {
      id: 'p1',
      name: 'Héro',
      kind: 'player',
      initiativeBonus: 2,
      initiativeRoll: 11,
      playerSubmitted: true,
    };

    const merged = mergeRemoteInitiativeRolls(local, remote);
    expect(merged.data.sessions!.find((s) => s.id === 'other')?.title).toBe('Autre');
    expect(merged.data.sessions!.find((s) => s.id === 's1')?.activeCombat?.initiativeCode).toBe('KEEP');
    expect(merged.data.sessions!.find((s) => s.id === 's1')?.activeCombat?.combatants[0]?.initiativeRoll).toBe(11);
  });

  it('only updates updatedAt when remote active session is missing', () => {
    const local = baseCampaign();
    const remote = baseCampaign({ sessions: [], activeSessionId: 's1' });
    remote.updatedAt = '2026-01-05T00:00:00Z';
    const merged = mergeRemoteInitiativeRolls(local, remote);
    expect(merged.updatedAt).toBe(remote.updatedAt);
    expect(merged.data.sessions![0].playNotes).toBe('brouillon MJ');
  });
});

describe('mergeRemoteLiveTable', () => {
  it('merges HP / fog without wiping local notes', () => {
    const local = baseCampaign({
      dungeonMaps: [
        {
          id: 'm1',
          name: 'Cave',
          theme: 'cave',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          fogOfWarEnabled: true,
          revealedRoomIds: [],
          rooms: [],
          markers: [],
          tiles: [],
          gridWidth: 20,
          gridHeight: 20,
        },
      ],
    });
    local.data.sessions![0].activeCombat!.combatants[0] = {
      id: 'p1',
      name: 'Héro',
      kind: 'player',
      initiativeBonus: 2,
      currentHp: 20,
      maxHp: 20,
      playerSubmitted: false,
    };

    const remote = baseCampaign({
      dungeonMaps: [
        {
          id: 'm1',
          name: 'Cave',
          theme: 'cave',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:01:00Z',
          fogOfWarEnabled: true,
          revealedRoomIds: ['r1'],
          rooms: [],
          markers: [],
          tiles: [],
          gridWidth: 20,
          gridHeight: 20,
        },
      ],
    });
    remote.updatedAt = '2026-01-01T00:02:00Z';
    remote.data.notes = 'notes serveur';
    remote.data.sessions![0].activeCombat!.combatants[0] = {
      id: 'p1',
      name: 'Héro',
      kind: 'player',
      initiativeBonus: 2,
      currentHp: 12,
      maxHp: 20,
      conditions: ['Empoisonné'],
      playerSubmitted: true,
      initiativeRoll: 14,
    };
    remote.data.sessions![0].activeCombat!.turnIndex = 2;
    remote.data.sessions![0].combatLog = ['Attaque'];
    remote.members = [
      {
        id: 'mem1',
        userId: 'u1',
        displayName: 'Alice',
        role: 'player',
        proposalStatus: 'approved',
        xpEarnedInCampaign: 50,
      },
    ];

    const merged = mergeRemoteLiveTable(local, remote);
    expect(merged.data.notes).toBe('notes locales');
    expect(merged.data.sessions![0].activeCombat!.combatants[0].currentHp).toBe(12);
    expect(merged.data.sessions![0].activeCombat!.combatants[0].conditions).toEqual(['Empoisonné']);
    expect(merged.data.sessions![0].activeCombat!.turnIndex).toBe(2);
    expect(merged.data.sessions![0].combatLog).toEqual(['Attaque']);
    expect(merged.data.dungeonMaps![0].revealedRoomIds).toEqual(['r1']);
    expect(merged.members[0].xpEarnedInCampaign).toBe(50);
  });

  it('adds remote-only combatants and handles missing local combat', () => {
    const local = baseCampaign();
    local.data.sessions![0].activeCombat = undefined;
    const remote = baseCampaign();
    remote.data.sessions![0].activeCombat!.combatants.push({
      id: 'new',
      name: 'Nouveau',
      kind: 'monster',
      initiativeBonus: 0,
    });
    const merged = mergeRemoteLiveTable(local, remote);
    expect(merged.data.sessions![0].activeCombat?.combatants.some((c) => c.id === 'new')).toBe(true);

    const local2 = baseCampaign();
    const remote2 = baseCampaign();
    remote2.data.sessions![0].activeCombat!.combatants.push({
      id: 'extra',
      name: 'Extra',
      kind: 'monster',
      initiativeBonus: 0,
    });
    const merged2 = mergeRemoteLiveTable(local2, remote2);
    expect(merged2.data.sessions![0].activeCombat!.combatants.some((c) => c.id === 'extra')).toBe(
      true,
    );
  });

  it('handles no active session', () => {
    const local = baseCampaign({ activeSessionId: null });
    const remote = baseCampaign({ activeSessionId: null });
    remote.updatedAt = '2026-01-09T00:00:00Z';
    const merged = mergeRemoteLiveTable(local, remote);
    expect(merged.updatedAt).toBe(remote.updatedAt);
    expect(merged.data.notes).toBe('notes locales');
  });

  it('merges status when remote has session without combat', () => {
    const local = baseCampaign();
    const remote = baseCampaign();
    remote.updatedAt = '2026-01-10T00:00:00Z';
    remote.data.sessions![0].activeCombat = undefined;
    remote.data.sessions![0].status = 'played';
    const merged = mergeRemoteLiveTable(local, remote);
    expect(merged.data.sessions![0].status).toBe('played');
    expect(merged.data.notes).toBe('notes locales');
  });

  it('keeps local fog when remote map missing and members empty', () => {
    const local = baseCampaign({
      dungeonMaps: [
        {
          id: 'm1',
          name: 'Cave',
          theme: 'cave',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          fogOfWarEnabled: true,
          revealedRoomIds: ['keep'],
          rooms: [],
          markers: [],
          tiles: [],
          gridWidth: 10,
          gridHeight: 10,
        },
      ],
    });
    const remote = baseCampaign({ dungeonMaps: [] });
    remote.members = [];
    remote.data.sessions![0].activeCombat!.combatants = [
      {
        id: 'gone-locally',
        name: 'Ghost',
        kind: 'monster',
        initiativeBonus: 0,
        currentHp: 1,
        maxHp: 1,
      },
    ];
    const merged = mergeRemoteLiveTable(local, remote);
    expect(merged.data.dungeonMaps![0].revealedRoomIds).toEqual(['keep']);
    expect(merged.members).toEqual([]);
    expect(
      merged.data.sessions![0].activeCombat!.combatants.some((c) => c.id === 'gone-locally'),
    ).toBe(true);
  });

  it('skips unrelated sessions and prefers remote empty combatLog', () => {
    const local = baseCampaign({
      sessions: [
        {
          id: 'other',
          title: 'Autre',
          scheduledAt: '2026-01-01T20:00:00Z',
          status: 'planned',
        },
        ...(baseCampaign().data.sessions ?? []),
      ],
    });
    local.data.sessions![1].combatLog = ['local'];
    const remote = baseCampaign();
    remote.data.sessions![0].combatLog = [];
    remote.data.sessions![0].activeCombat!.round = 3;
    const merged = mergeRemoteLiveTable(local, remote);
    expect(merged.data.sessions!.find((s) => s.id === 'other')?.title).toBe('Autre');
    expect(merged.data.sessions!.find((s) => s.id === 's1')?.combatLog).toEqual(['local']);
    expect(merged.data.sessions!.find((s) => s.id === 's1')?.activeCombat?.round).toBe(3);
  });
});
