import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
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

    const owner = await loginSeedSession(page.request);
    expect(owner.token, 'seed JWT').toBeTruthy();

    const reset = await page.request.put('/api/me/guide-preferences', {
      headers: { Authorization: `Bearer ${owner.token}` },
      data: { readNewsIds: [], readSectionIds: [], audience: null },
    });
    expect(reset.ok(), `Reset prefs failed: ${reset.status()}`).toBeTruthy();

    await applyAuthSession(page, owner, '/');
    await expect(page.getByRole('heading', { name: 'Comment jouez-vous ?' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Je suis MJ/i }).click();
    await expect(page).toHaveURL(/\/guide/, { timeout: 15_000 });

    await expect
      .poll(
        async () => {
          const prefs = await page.request.get('/api/me/guide-preferences', {
            headers: { Authorization: `Bearer ${owner.token}` },
          });
          if (!prefs.ok()) return null;
          const body = (await prefs.json()) as { audience: string | null };
          return body.audience;
        },
        { timeout: 10_000 },
      )
      .toBe('dm');
  });
});

test.describe('Campagne — roster joueur', () => {
  test('inviter → proposer → valider fiche → retirer', async ({ page }) => {
    test.setTimeout(120_000);

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

    await page.getByRole('navigation', { name: 'Sections de la campagne' }).getByRole('button', { name: 'Joueurs' }).click();
    await page.getByRole('button', { name: 'Retirer' }).first().click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Retirer le joueur' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: 'Retirer', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Retirer' })).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Accepter' })).toHaveCount(0);
  });
});
