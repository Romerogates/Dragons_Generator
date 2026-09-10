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
  createXpReadyCampaignAs,
  invitePlayerToCampaign,
  proposeCharacterAs,
  seedCollectingInitiativeAs,
  setSessionModeAs,
  startActiveSessionAs,
  upsertPublishedHandoutAs,
} from './helpers/campaign';

test.describe('Campagne — initiative joueur (jet)', () => {
  test('banner → Envoyer jet → confirmation', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'Jet');
    const { campaignId } = await createXpReadyCampaignAs(page, owner, `E2E Jet ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Kael Jet');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    await startActiveSessionAs(page, owner, campaignId);
    await seedCollectingInitiativeAs(page, owner, campaignId, {
      includePlayer: true,
      playerUserId: player.user.id,
      characterName: 'Kael Jet',
    });

    await applyAuthSession(page, player, `/campaigns/${campaignId}`);
    await expect(page.getByText(/Le MJ attend votre initiative/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('input[type="number"]').fill('17');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    // Le bandeau se ferme dès que le jet est pris en compte (le toast disparaît avec).
    await expect(page.getByText(/Le MJ attend votre initiative/i)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`/api/me/campaigns/${campaignId}/initiative`, {
            headers: { Authorization: `Bearer ${player.token}` },
          });
          if (!res.ok()) return false;
          const board = (await res.json()) as {
            combatants: Array<{ hasRoll?: boolean; memberUserId?: string }>;
          };
          return board.combatants.some(
            (c) => c.memberUserId === player.user.id && c.hasRoll === true,
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });
});

test.describe('Campagne — documents publié / épinglé', () => {
  test('MJ publie + épingle ; joueur voit publié, pas le brouillon', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'Doc');
    const campaignId = await createCampaignAs(page, owner, `E2E Pin ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Doc Hero');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);

    const publishedId = await upsertPublishedHandoutAs(page, owner, campaignId, {
      title: 'Lettre publique E2E',
      published: true,
    });
    await upsertPublishedHandoutAs(page, owner, campaignId, {
      title: 'Brouillon secret E2E',
      published: false,
    });

    await applyAuthSession(page, owner, `/campaigns/${campaignId}?tab=handouts`);
    await expect(page.getByText('Lettre publique E2E').first()).toBeVisible({ timeout: 20_000 });
    await page
      .locator('#handout-' + publishedId)
      .getByRole('button', { name: 'Épingler' })
      .click();
    await expect(
      page.locator('#handout-' + publishedId).getByRole('button', { name: 'Épinglé' }),
    ).toBeVisible({ timeout: 10_000 });

    await applyAuthSession(page, player, `/campaigns/${campaignId}?tab=handouts`);
    await expect(page.getByText('Lettre publique E2E').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Brouillon secret E2E')).toHaveCount(0);
  });
});

test.describe('Campagne — mode session', () => {
  test('mode Autre affiche Encoder / Lancer le dé en combat', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Mode ${Date.now()}`);
    const sessionId = await startActiveSessionAs(page, owner, campaignId);
    await setSessionModeAs(page, owner, campaignId, sessionId, 'other');

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Autre/i).first()).toBeVisible();

    await page.getByRole('button', { name: 'Combattre' }).click();
    await expect(page.getByRole('button', { name: 'Encoder' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Lancer le dé' })).toBeVisible();
  });
});

test.describe('Campagne — XP offline', () => {
  test('Distribuer XP hors ligne → erreur, pas de xpAwarded', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'Off');
    const { campaignId } = await createXpReadyCampaignAs(page, owner);
    const characterId = await createCharacterAs(page, player, 'Offline XP');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    await startActiveSessionAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/play`);
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole('navigation', { name: 'Sections de la session' })
      .getByRole('button', { name: 'Rencontres' })
      .click();

    const distribute = page.getByRole('button', { name: /Distribuer \d+ XP/ });
    await expect(distribute).toBeVisible({ timeout: 15_000 });

    await page.context().setOffline(true);
    await distribute.click();
    await expect(page.getByText(/Échec XP|connexion|impossible/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.context().setOffline(false);

    await page.reload();
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole('navigation', { name: 'Sections de la session' })
      .getByRole('button', { name: 'Rencontres' })
      .click();
    await expect(page.getByRole('button', { name: /Distribuer \d+ XP/ })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('Campagne — roster live joueur', () => {
  test('MJ −5 PV → joueur voit PV mis à jour sans F5', async ({ browser }) => {
    test.setTimeout(180_000);

    const dmCtx = await browser.newContext();
    const playerCtx = await browser.newContext();
    const dm = await dmCtx.newPage();
    const player = await playerCtx.newPage();

    const owner = await loginSeedSession(dm.request);
    const pj = await registerConfirmAndLogin(player.request, 'Live');
    const { campaignId } = await createXpReadyCampaignAs(dm, owner, `E2E Live ${Date.now()}`);
    const charId = await createCharacterAs(player, pj, 'Lyra Live');
    await invitePlayerToCampaign(dm, owner, pj, campaignId);
    await proposeCharacterAs(player, pj, campaignId, charId);
    await approveCharacterAs(dm, owner, campaignId);
    await startActiveSessionAs(dm, owner, campaignId);
    await seedCollectingInitiativeAs(dm, owner, campaignId, {
      includePlayer: true,
      playerUserId: pj.user.id,
      characterName: 'Lyra Live',
      collectingInitiative: false,
      currentHp: 20,
      maxHp: 20,
      initiativeRoll: 14,
    });

    await applyAuthSession(player, pj, `/campaigns/${campaignId}`);
    await player.getByRole('button', { name: 'Session en cours' }).click();
    await player.getByRole('button', { name: 'Table', exact: true }).click();
    const roster = player.locator('[aria-label="Ordre de combat en direct"]');
    await expect(roster.getByText(/Roster live/i)).toBeVisible({ timeout: 20_000 });
    await expect(roster.getByText('PV 20/20')).toBeVisible();

    await applyAuthSession(dm, owner, `/campaigns/${campaignId}/play`);
    await expect(dm.getByText('Table de jeu — session en cours')).toBeVisible({
      timeout: 30_000,
    });
    await dm.getByRole('button', { name: 'Combattre' }).click();
    const lyraCard = dm.getByRole('button', { name: /Lyra Live/ }).filter({
      has: dm.getByRole('button', { name: '−5' }),
    });
    await expect(lyraCard).toBeVisible({ timeout: 15_000 });
    await lyraCard.getByRole('button', { name: '−5' }).click();
    await expect(lyraCard.getByText('PV 15/20')).toBeVisible({ timeout: 15_000 });

    await player.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect
      .poll(async () => roster.textContent(), { timeout: 30_000 })
      .toMatch(/PV 15\/20/);

    await dmCtx.close();
    await playerCtx.close();
  });
});
