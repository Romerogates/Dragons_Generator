import type { CampaignDetail } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';

export const STORAGE_KEY = 'dg_custom_background_templates';

export function baseCampaign(overrides: Partial<CampaignDetail['data']> = {}): CampaignDetail {
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
      notes: 'notes',
      pregenCharacters: [],
      sessions: [
        {
          id: 's1',
          title: 'S1',
          scheduledAt: '2026-01-01T20:00:00Z',
          status: 'planned',
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

export function emptyMap(overrides: Partial<CampaignDungeonMap> = {}): CampaignDungeonMap {
  return {
    id: 'm1',
    name: 'Cave',
    theme: 'cave',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fogOfWarEnabled: false,
    revealedRoomIds: [],
    rooms: [{ id: 'r1', label: 'Entrée', x: 1, y: 1, width: 2, height: 2 }],
    markers: [],
    tiles: [
      ['wall', 'wall', 'wall'],
      ['wall', 'floor', 'door'],
      ['wall', 'wall', 'wall'],
    ],
    gridWidth: 3,
    gridHeight: 3,
    ...overrides,
  };
}
