import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  registerConfirmAndLogin,
} from './helpers/auth';
import { createCampaignAs, createJoinLinkAs } from './helpers/campaign';

/**
 * Preview /join anonyme + rejoindre après login (≠ ami).
 */
test.describe('Lien /join — preview invité', () => {
  test('invité voit login/register → joueur rejoint avec bannière Bienvenue', async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const ownerCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const guestPage = await guestCtx.newPage();

    const owner = await loginSeedSession(ownerPage.request);
    const title = `E2E Join Guest ${Date.now()}`;
    const campaignId = await createCampaignAs(ownerPage, owner, title);
    const { token } = await createJoinLinkAs(ownerPage, owner, campaignId);

    await guestPage.goto(`/join/${token}`);
    await expect(guestPage.getByRole('heading', { name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(guestPage.getByText(/Animée par/i)).toBeVisible();
    await expect(
      guestPage.getByRole('button', { name: /Se connecter pour rejoindre/i }),
    ).toBeVisible();
    await expect(guestPage.getByRole('link', { name: /Créer un compte/i })).toBeVisible();
    await expect(
      guestPage.getByText(/Pas besoin d’être ami/i),
    ).toBeVisible();

    const player = await registerConfirmAndLogin(guestPage.request, 'Gst');
    await applyAuthSession(guestPage, player, `/join/${token}`);
    await expect(guestPage.getByRole('heading', { name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      guestPage.getByText(/proposer un héros/i),
    ).toBeVisible();
    await guestPage.getByRole('button', { name: 'Rejoindre la campagne' }).click();

    await expect(guestPage).toHaveURL(new RegExp(`/campaigns/${campaignId}`), {
      timeout: 20_000,
    });
    await expect(
      guestPage.getByText(/Bienvenue dans la campagne|Proposer un héros/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await ownerCtx.close();
    await guestCtx.close();
  });
});
