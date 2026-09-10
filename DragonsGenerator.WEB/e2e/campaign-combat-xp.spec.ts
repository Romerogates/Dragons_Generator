import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  registerConfirmAndLogin,
} from './helpers/auth';
import {
  approveCharacterAs,
  createCharacterAs,
  createXpReadyCampaignAs,
  invitePlayerToCampaign,
  proposeCharacterAs,
  seedCollectingInitiativeAs,
  startActiveSessionAs,
} from './helpers/campaign';

test.describe('Campagne — combat XP & initiative joueur', () => {
  test('import party → Distribuer XP une fois (persiste après refresh)', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'Xp');
    const { campaignId } = await createXpReadyCampaignAs(page, owner);
    const characterId = await createCharacterAs(page, player, 'Borin XP');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    await startActiveSessionAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Combattre' }).click();
    await page.getByRole('button', { name: '+ Toute la party' }).click();
    await expect(page.getByText(/Borin XP|\+1 PJ importé/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await page
      .getByRole('navigation', { name: 'Sections de la session' })
      .getByRole('button', { name: 'Rencontres' })
      .click();

    const distribute = page.getByRole('button', { name: /Distribuer \d+ XP/ });
    await expect(distribute).toBeVisible({ timeout: 15_000 });
    await distribute.click();

    await expect(page.getByText(/\+\d+ XP/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Distribuer \d+ XP/ })).toHaveCount(0, {
      timeout: 10_000,
    });

    await page.reload();
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole('navigation', { name: 'Sections de la session' })
      .getByRole('button', { name: 'Rencontres' })
      .click();
    await expect(page.getByRole('button', { name: /Distribuer \d+ XP/ })).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  test('joueur lié : banner initiative ; non lié : pas de faux prompt', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'In');
    const { campaignId } = await createXpReadyCampaignAs(page, owner, `E2E Init ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Lyra Init');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    await startActiveSessionAs(page, owner, campaignId);

    // --- Sans le PJ dans le combat ---
    await seedCollectingInitiativeAs(page, owner, campaignId, {
      includePlayer: false,
      playerUserId: player.user.id,
    });
    await applyAuthSession(page, player, `/campaigns/${campaignId}`);
    await expect(page.getByText(/Le MJ attend votre initiative/i)).toHaveCount(0, {
      timeout: 15_000,
    });

    await page.goto(`/campaigns/${campaignId}/init`);
    await expect(page.getByText(/pas dans ce combat/i)).toBeVisible({ timeout: 15_000 });

    // --- Avec le PJ dans le combat ---
    await seedCollectingInitiativeAs(page, owner, campaignId, {
      includePlayer: true,
      playerUserId: player.user.id,
      characterName: 'Lyra Init',
    });
    await applyAuthSession(page, player, `/campaigns/${campaignId}`);
    await expect(page.getByText(/Le MJ attend votre initiative/i)).toBeVisible({
      timeout: 20_000,
    });
  });
});
