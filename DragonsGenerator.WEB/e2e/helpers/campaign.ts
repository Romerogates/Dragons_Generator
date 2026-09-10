import { expect, type Page } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD, type AuthSession } from './auth';

async function authToken(page: Page): Promise<string> {
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Login API failed: ${loginRes.status()}`).toBeTruthy();
  const auth = (await loginRes.json()) as { token: string | null };
  const fromCookie = (() => {
    for (const header of loginRes.headersArray()) {
      if (header.name.toLowerCase() !== 'set-cookie') continue;
      const match = header.value.match(/^dg_session=([^;]+)/);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
    return null;
  })();
  const token = auth.token ?? fromCookie;
  expect(token, 'auth token missing from body and cookie').toBeTruthy();
  return token!;
}

function bearer(token: string | null): Record<string, string> {
  expect(token, 'Bearer token required for multi-user API helpers').toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

/** Crée une campagne MJ avec une session planifiée (API). */
export async function createPlayableCampaign(page: Page): Promise<string> {
  const token = await authToken(page);
  const sessionId = `e2e-sess-${Date.now()}`;

  const res = await page.request.post('/api/me/campaigns', {
    headers: bearer(token),
    data: {
      title: `E2E Play ${Date.now()}`,
      data: {
        setting: 'Eana',
        regionId: null,
        regionName: '',
        partyLevel: 3,
        tone: 'classic',
        adventure: 'Synopsis E2E',
        creatures: [],
        encounters: [],
        notes: '',
        pregenCharacters: [],
        handouts: [],
        sessions: [
          {
            id: sessionId,
            title: 'Session E2E',
            scheduledAt: new Date().toISOString(),
            status: 'planned',
          },
        ],
      },
    },
  });

  expect(res.ok(), `Create campaign failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

export async function createCampaignAs(
  page: Page,
  owner: AuthSession,
  title?: string,
): Promise<string> {
  const res = await page.request.post('/api/me/campaigns', {
    headers: bearer(owner.token),
    data: {
      title: title ?? `E2E Members ${Date.now()}`,
      data: {
        setting: 'Eana',
        regionId: null,
        regionName: '',
        partyLevel: 1,
        tone: 'classic',
        adventure: 'Synopsis roster E2E',
        creatures: [],
        encounters: [],
        notes: '',
        pregenCharacters: [],
        handouts: [],
        sessions: [],
      },
    },
  });
  expect(res.ok(), `Create campaign failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

export async function createCharacterAs(
  page: Page,
  session: AuthSession,
  name: string,
): Promise<string> {
  const res = await page.request.post('/api/me/characters', {
    headers: bearer(session.token),
    data: {
      name,
      data: {
        name,
        totalLevel: 1,
        classes: [{ classLabel: 'Guerrier', level: 1 }],
        vitality: { hitPointsMax: 12, hitPointsCurrent: 12 },
        attributes: { dexterity: 12 },
      },
    },
  });
  expect(res.ok(), `Create character failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

/** Campagne avec rencontre déjà vaincue (XP prêt à distribuer). */
export async function createXpReadyCampaignAs(
  page: Page,
  owner: AuthSession,
  title?: string,
): Promise<{ campaignId: string; encounterId: string }> {
  const encounterId = `e2e-enc-${Date.now()}`;
  const res = await page.request.post('/api/me/campaigns', {
    headers: bearer(owner.token),
    data: {
      title: title ?? `E2E XP ${Date.now()}`,
      data: {
        setting: 'Eana',
        regionId: null,
        regionName: '',
        partyLevel: 1,
        tone: 'classic',
        adventure: 'Synopsis XP E2E',
        creatures: [],
        encounters: [
          {
            id: encounterId,
            name: 'Embuscade E2E',
            creatures: [
              {
                creatureId: 'e2e-gob',
                creatureName: 'Gobelin',
                challengeRating: '1/4',
                xp: 50,
                quantity: 2,
                defeated: 2,
              },
            ],
            xpAwarded: false,
          },
        ],
        notes: '',
        pregenCharacters: [],
        handouts: [],
        sessions: [],
      },
    },
  });
  expect(res.ok(), `Create XP campaign failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return { campaignId: body.id, encounterId };
}

/** Ami → invitation campagne → acceptation (API). */
export async function invitePlayerToCampaign(
  page: Page,
  owner: AuthSession,
  player: AuthSession,
  campaignId: string,
): Promise<void> {
  const friendReq = await page.request.post('/api/me/friends/request', {
    headers: bearer(owner.token),
    data: { userId: player.user.id },
  });
  expect(friendReq.ok(), `Friend request failed: ${friendReq.status()} ${await friendReq.text()}`).toBeTruthy();

  const pendingRes = await page.request.get('/api/me/friends/requests', {
    headers: bearer(player.token),
  });
  expect(pendingRes.ok()).toBeTruthy();
  const pending = (await pendingRes.json()) as Array<{ id: string }>;
  expect(pending.length).toBeGreaterThan(0);

  const acceptFriend = await page.request.post(`/api/me/friends/requests/${pending[0].id}/accept`, {
    headers: bearer(player.token),
  });
  expect(acceptFriend.ok(), `Accept friend failed: ${acceptFriend.status()}`).toBeTruthy();

  const inviteRes = await page.request.post(`/api/me/campaigns/${campaignId}/invites`, {
    headers: bearer(owner.token),
    data: { userId: player.user.id },
  });
  expect(inviteRes.ok(), `Invite failed: ${inviteRes.status()} ${await inviteRes.text()}`).toBeTruthy();

  const invitesRes = await page.request.get('/api/me/campaign-invites', {
    headers: bearer(player.token),
  });
  expect(invitesRes.ok()).toBeTruthy();
  const invites = (await invitesRes.json()) as Array<{ id: string; campaignId: string }>;
  const invite = invites.find((i) => i.campaignId === campaignId);
  expect(invite, 'campaign invite not found').toBeTruthy();

  const acceptInvite = await page.request.post(`/api/me/campaign-invites/${invite!.id}/accept`, {
    headers: bearer(player.token),
  });
  expect(acceptInvite.ok(), `Accept invite failed: ${acceptInvite.status()}`).toBeTruthy();
}

export async function proposeCharacterAs(
  page: Page,
  player: AuthSession,
  campaignId: string,
  characterId: string,
): Promise<void> {
  const res = await page.request.post(`/api/me/campaigns/${campaignId}/propose-character`, {
    headers: bearer(player.token),
    data: { characterId },
  });
  expect(res.ok(), `Propose failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** MJ valide la fiche proposée (API). */
export async function approveCharacterAs(
  page: Page,
  owner: AuthSession,
  campaignId: string,
): Promise<void> {
  const getRes = await page.request.get(`/api/me/campaigns/${campaignId}`, {
    headers: bearer(owner.token),
  });
  expect(getRes.ok(), `Get campaign failed: ${getRes.status()}`).toBeTruthy();
  const campaign = (await getRes.json()) as {
    members: Array<{ id: string; proposalStatus: string }>;
  };
  const member = campaign.members.find((m) => m.proposalStatus === 'pending');
  expect(member, 'pending member not found').toBeTruthy();

  const res = await page.request.post(
    `/api/me/campaigns/${campaignId}/members/${member!.id}/approve`,
    { headers: bearer(owner.token), data: {} },
  );
  expect(res.ok(), `Approve failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** MJ démarre une session active (API PUT data.activeSessionId). */
export async function startActiveSessionAs(
  page: Page,
  owner: AuthSession,
  campaignId: string,
): Promise<string> {
  const getRes = await page.request.get(`/api/me/campaigns/${campaignId}`, {
    headers: bearer(owner.token),
  });
  expect(getRes.ok(), `Get campaign failed: ${getRes.status()}`).toBeTruthy();
  const campaign = (await getRes.json()) as {
    title: string;
    data: {
      sessions?: Array<{ id: string; title: string; scheduledAt: string; status: string }>;
      [key: string]: unknown;
    };
  };

  const sessionId = `e2e-live-${Date.now()}`;
  const sessions = [
    ...(campaign.data.sessions ?? []),
    {
      id: sessionId,
      title: 'Session live E2E',
      scheduledAt: new Date().toISOString(),
      status: 'planned',
    },
  ];

  const putRes = await page.request.put(`/api/me/campaigns/${campaignId}`, {
    headers: bearer(owner.token),
    data: {
      title: campaign.title,
      data: {
        ...campaign.data,
        sessions,
        activeSessionId: sessionId,
      },
    },
  });
  expect(putRes.ok(), `Start session failed: ${putRes.status()} ${await putRes.text()}`).toBeTruthy();
  return sessionId;
}

type SeedCombatOpts = {
  /** Si true, le PJ est dans le roster combat (banner init). Sinon absents → pas de faux prompt. */
  includePlayer: boolean;
  playerUserId: string;
  characterName?: string;
};

/** Place un combat en collecte d’initiative sur la session active (API). */
export async function seedCollectingInitiativeAs(
  page: Page,
  owner: AuthSession,
  campaignId: string,
  opts: SeedCombatOpts,
): Promise<{ code: string; combatantId: string | null }> {
  const getRes = await page.request.get(`/api/me/campaigns/${campaignId}`, {
    headers: bearer(owner.token),
  });
  expect(getRes.ok(), `Get campaign failed: ${getRes.status()}`).toBeTruthy();
  const campaign = (await getRes.json()) as {
    title: string;
    data: {
      activeSessionId?: string | null;
      sessions?: Array<Record<string, unknown> & { id: string }>;
      [key: string]: unknown;
    };
  };

  const activeId = campaign.data.activeSessionId;
  expect(activeId, 'activeSessionId required').toBeTruthy();
  const code = `E${String(Date.now()).slice(-3)}`;
  const combatantId = opts.includePlayer ? `cb-pj-${Date.now()}` : null;
  const combatants: Array<Record<string, unknown>> = [
    {
      id: 'cb-gob-e2e',
      name: 'Gobelin',
      kind: 'monster',
      armorClass: 12,
      initiativeBonus: 0,
    },
  ];
  if (opts.includePlayer && combatantId) {
    combatants.unshift({
      id: combatantId,
      name: opts.characterName ?? 'Héros E2E',
      kind: 'player',
      armorClass: 14,
      maxHp: 12,
      currentHp: 12,
      initiativeBonus: 1,
      memberUserId: opts.playerUserId,
    });
  }

  const sessions = (campaign.data.sessions ?? []).map((s) =>
    s.id === activeId
      ? {
          ...s,
          activeCombat: {
            id: `combat-e2e-${Date.now()}`,
            label: 'Embuscade E2E',
            round: 1,
            turnIndex: 0,
            collectingInitiative: true,
            initiativeCode: code,
            combatants,
          },
        }
      : s,
  );

  const putRes = await page.request.put(`/api/me/campaigns/${campaignId}`, {
    headers: bearer(owner.token),
    data: {
      title: campaign.title,
      data: {
        ...campaign.data,
        sessions,
      },
    },
  });
  expect(putRes.ok(), `Seed combat failed: ${putRes.status()} ${await putRes.text()}`).toBeTruthy();
  return { code, combatantId };
}
