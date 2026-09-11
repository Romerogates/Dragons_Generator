import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  registerConfirmAndLogin,
} from './helpers/auth';
import {
  createCampaignAs,
  createJoinLinkAs,
  revokeJoinLinkAs,
} from './helpers/campaign';

/**
 * Lien /join/{token} : rejoindre une campagne sans amitié.
 * Couvre le flux P2 invitation publique (≠ invite ami).
 */
test.describe('Lien invitation campagne /join', () => {
  test('MJ crée le lien → joueur non ami rejoint → révocation invalide le lien', async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const ownerContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const playerPage = await playerContext.newPage();

    const owner = await loginSeedSession(ownerPage.request);
    const player = await registerConfirmAndLogin(playerPage.request, 'Join');
    const title = `E2E Join ${Date.now()}`;
    const campaignId = await createCampaignAs(ownerPage, owner, title);

    const { token } = await createJoinLinkAs(ownerPage, owner, campaignId);
    expect(token.length).toBeGreaterThan(8);

    await applyAuthSession(playerPage, player, `/join/${token}`);
    await expect(playerPage.getByRole('heading', { name: title })).toBeVisible({
      timeout: 20_000,
    });
    await expect(playerPage.getByText(/Animée par/i)).toBeVisible();
    await playerPage.getByRole('button', { name: 'Rejoindre la campagne' }).click();

    await expect(playerPage).toHaveURL(new RegExp(`/campaigns/${campaignId}`), {
      timeout: 20_000,
    });
    await expect(playerPage.getByText(title).first()).toBeVisible({ timeout: 15_000 });

    // Déjà membre : le preview redirige vers le hub
    await playerPage.goto(`/join/${token}`);
    await expect(playerPage).toHaveURL(new RegExp(`/campaigns/${campaignId}`), {
      timeout: 20_000,
    });

    await revokeJoinLinkAs(ownerPage, owner, campaignId);

    const stranger = await registerConfirmAndLogin(playerPage.request, 'JoX');
    await applyAuthSession(playerPage, stranger, `/join/${token}`);
    await expect(
      playerPage.getByText(/lien d’invitation est invalide ou a été révoqué/i),
    ).toBeVisible({ timeout: 20_000 });

    await ownerContext.close();
    await playerContext.close();
  });

  test('lien invalide affiche l’erreur', async ({ page }) => {
    await page.goto('/join/token-invalide-e2e-zzzz');
    await expect(
      page.getByText(/lien d’invitation est invalide ou a été révoqué/i),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Retour aux campagnes/i })).toBeVisible();
  });
});
