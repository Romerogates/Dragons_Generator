import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  registerConfirmAndLogin,
} from './helpers/auth';
import {
  approveCharacterAs,
  createCampaignAs,
  createCharacterAs,
  invitePlayerToCampaign,
  proposeCharacterAs,
  startActiveSessionAs,
  upsertPublishedHandoutAs,
} from './helpers/campaign';

test.describe('Campagne — handouts overlay /play joueur', () => {
  test('publié + épinglé visibles dans overlay Documents depuis /play', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'HoPlay');
    const campaignId = await createCampaignAs(page, owner, `E2E Play HO ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Doc Play');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    await startActiveSessionAs(page, owner, campaignId);

    const publishedId = await upsertPublishedHandoutAs(page, owner, campaignId, {
      title: 'Lettre publique Play E2E',
      body: 'Contenu joueur overlay E2E',
      published: true,
    });

    // Épingler via API (même blob que hub Épingler).
    const getRes = await page.request.get(`/api/me/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const campaign = (await getRes.json()) as {
      title: string;
      data: Record<string, unknown>;
    };
    const putRes = await page.request.put(`/api/me/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: {
        title: campaign.title,
        data: { ...campaign.data, pinnedHandoutId: publishedId },
      },
    });
    expect(putRes.ok()).toBeTruthy();

    await applyAuthSession(page, player, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId('play-documents-btn').click();
    await expect(page.getByTestId('play-player-overlay')).toBeVisible();
    // Overlay ouvre l’épinglé directement (ou liste avec badge).
    await expect(page.getByText('Lettre publique Play E2E').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Contenu joueur overlay E2E')).toBeVisible();
  });
});
