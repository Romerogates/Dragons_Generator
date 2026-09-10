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
} from './helpers/campaign';

test.describe('Campagne — table joueur', () => {
  test('dock session : Documents, Ma fiche, attente combat', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'Pj');

    const campaignId = await createCampaignAs(page, owner, `E2E Player ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Lyra E2E');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    await startActiveSessionAs(page, owner, campaignId);

    await applyAuthSession(page, player, `/campaigns/${campaignId}`);

    const dockFab = page.getByRole('button', { name: 'Session en cours' });
    await expect(dockFab).toBeVisible({ timeout: 30_000 });
    await dockFab.click();

    await expect(page.getByText('Session live E2E').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Table', exact: true }).click();

    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: 'Documents', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ma fiche', exact: true })).toBeVisible();
    await expect(page.getByText(/En attente que le MJ lance un combat/i)).toBeVisible();
  });
});
