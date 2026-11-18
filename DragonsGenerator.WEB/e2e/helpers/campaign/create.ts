import { expect, type Page } from '@playwright/test';
import { type AuthSession } from '../auth';
import { bearer } from './http';

export async function createPlayableCampaign(page: Page, owner: AuthSession): Promise<string> {
  const sessionId = `e2e-sess-${Date.now()}`;

  const res = await page.request.post('/api/me/campaigns', {
    headers: bearer(owner.token),
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

/** Crée / régénère le lien public /join/{token} (API, MJ). */
