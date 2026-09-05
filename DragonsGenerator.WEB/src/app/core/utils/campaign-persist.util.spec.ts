import { mergeRemoteInitiativeRolls } from './campaign-persist.util';
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
  it('keeps local play notes while merging player rolls', () => {
    const local = baseCampaign();
    const remote = baseCampaign();
    remote.updatedAt = '2026-01-01T00:01:00Z';
    remote.data.notes = 'notes serveur périmées';
    remote.data.sessions![0].playNotes = 'notes serveur';
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
    expect(merged.data.sessions![0].playNotes).toBe('brouillon MJ');
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
    expect(mergeRemoteInitiativeRolls(local, remoteNoCombat).data.sessions![0].playNotes).toBe(
      'brouillon MJ',
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
});
