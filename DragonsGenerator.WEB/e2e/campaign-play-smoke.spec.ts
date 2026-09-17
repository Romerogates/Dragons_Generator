import { test, expect, type Page } from '@playwright/test';
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
  seedFightCombatAs,
  setSessionModeAs,
  startActiveSessionAs,
} from './helpers/campaign';

async function confirmInApp(page: Page, title: string): Promise<void> {
  const dialog = page.getByRole('dialog').filter({ hasText: title });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Terminer', exact: true }).click();
}

test.describe('Campagne — smoke hub → combat → terminer', () => {
  test('MJ hub → table → combat seed → fin combat → fin session ; joueur voit la table', async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    const ownerCtx = await browser.newContext();
    const playerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const playerPage = await playerCtx.newPage();

    const owner = await loginSeedSession(ownerPage.request);
    const player = await registerConfirmAndLogin(playerPage.request, 'Smoke');
    const campaignId = await createCampaignAs(ownerPage, owner, `E2E Smoke ${Date.now()}`);
    const characterId = await createCharacterAs(playerPage, player, 'Héros Smoke');
    await invitePlayerToCampaign(ownerPage, owner, player, campaignId);
    await proposeCharacterAs(playerPage, player, campaignId, characterId);
    await approveCharacterAs(ownerPage, owner, campaignId);
    const sessionId = await startActiveSessionAs(ownerPage, owner, campaignId);
    await setSessionModeAs(ownerPage, owner, campaignId, sessionId, 'in_person');
    await seedFightCombatAs(ownerPage, owner, campaignId);

    await applyAuthSession(ownerPage, owner, `/campaigns/${campaignId}`);
    await expect(ownerPage.getByText(/Session en cours|Entrer en session|Table/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const tableCta = ownerPage.getByRole('button', { name: /Table|Entrer en session|Rejoindre la table/i });
    if (await tableCta.count()) {
      await tableCta.first().click();
    } else {
      await ownerPage.goto(`/campaigns/${campaignId}/play`);
    }

    await expect(ownerPage.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });

    await applyAuthSession(playerPage, player, `/campaigns/${campaignId}/play`);
    await expect(playerPage.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    // Combat déjà seedé : le joueur voit le tour sans CTA Combattre.
    await expect(playerPage.getByText(/Tour de/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(playerPage.getByText(/En attente que le MJ lance un combat/i)).toHaveCount(0);

    await ownerPage.goto(`/campaigns/${campaignId}/play`);
    await expect(ownerPage.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await ownerPage.getByRole('button', { name: /Combattre|Reprendre/i }).click();
    await expect(ownerPage.getByText(/Tour de/i).first()).toBeVisible({ timeout: 15_000 });

    await ownerPage.getByRole('button', { name: 'Fin combat' }).first().click();
    await confirmInApp(ownerPage, 'Terminer le combat');

    await ownerPage.getByRole('button', { name: 'Terminer la session' }).click();
    await confirmInApp(ownerPage, 'Terminer la session');

    await expect(ownerPage).toHaveURL(new RegExp(`/campaigns/${campaignId}$`), {
      timeout: 20_000,
    });
    await expect(ownerPage.getByText('Table de jeu — session en cours')).not.toBeVisible({
      timeout: 20_000,
    });

    await ownerCtx.close();
    await playerCtx.close();
  });
});
