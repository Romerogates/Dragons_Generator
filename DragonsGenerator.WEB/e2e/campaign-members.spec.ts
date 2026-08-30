import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  loginViaUi,
  ONBOARDING_SEEN_KEY,
  registerConfirmAndLogin,
} from './helpers/auth';
import {
  createCampaignAs,
  createCharacterAs,
  invitePlayerToCampaign,
  proposeCharacterAs,
} from './helpers/campaign';

test.describe('Onboarding rôle', () => {
  test('choisir MJ ouvre le guide filtré', async ({ page }) => {
    test.setTimeout(60_000);

    await loginViaUi(page, '/');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
      localStorage.removeItem('dragons-guide-audience');
    }, ONBOARDING_SEEN_KEY);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Comment jouez-vous ?' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /Je suis MJ/i }).click();
    await expect(page).toHaveURL(/\/guide/, { timeout: 15_000 });

    const audience = await page.evaluate(() => localStorage.getItem('dragons-guide-audience'));
    expect(audience).toBe('dm');
  });
});

test.describe('Campagne — roster joueur', () => {
  test('inviter → proposer → valider fiche → retirer', async ({ page }) => {
    test.setTimeout(120_000);
    page.on('dialog', (dialog) => dialog.accept());

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'Pl');

    const campaignId = await createCampaignAs(page, owner, `E2E Roster ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Eldrin E2E');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}`);

    await expect(page.getByText('Eldrin E2E').first()).toBeVisible({ timeout: 20_000 });

    const viewProposed = page.getByRole('button', { name: /Voir la fiche proposée/i }).first();
    await expect(viewProposed).toBeVisible({ timeout: 15_000 });
    await viewProposed.click();
    await expect(page).toHaveURL(/\/character-sheet/, { timeout: 20_000 });
    await expect(page.getByText(/Eldrin E2E/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`/campaigns/${campaignId}`);
    await expect(page.getByRole('button', { name: 'Accepter' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Accepter' }).first().click();

    await expect(page.getByRole('button', { name: /Voir la fiche$/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Retirer' }).first().click();
    await expect(page.getByRole('button', { name: 'Retirer' })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Accepter' })).toHaveCount(0);
  });
});
