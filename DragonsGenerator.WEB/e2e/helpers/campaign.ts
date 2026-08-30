import { expect, type Page } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from './auth';

async function authToken(page: Page): Promise<string> {
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Login API failed: ${loginRes.status()}`).toBeTruthy();
  const auth = (await loginRes.json()) as { token: string };
  return auth.token;
}

/** Crée une campagne MJ avec une session planifiée (API). */
export async function createPlayableCampaign(page: Page): Promise<string> {
  const token = await authToken(page);
  const sessionId = `e2e-sess-${Date.now()}`;

  const res = await page.request.post('/api/me/campaigns', {
    headers: { Authorization: `Bearer ${token}` },
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
