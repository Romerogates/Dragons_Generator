import { expect, type Page } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD, type AuthSession } from './auth';

async function authToken(page: Page): Promise<string> {
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Login API failed: ${loginRes.status()}`).toBeTruthy();
  const auth = (await loginRes.json()) as { token: string };
  return auth.token;
}

function bearer(token: string): Record<string, string> {
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
      },
    },
  });
  expect(res.ok(), `Create character failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
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
