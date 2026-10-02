import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  registerConfirmAndLogin,
} from './helpers/auth';
import {
  createCampaignAs,
  createSharedDungeonAs,
  invitePlayerToCampaign,
  seedCollectingInitiativeAs,
  seedEveningExportSessionAs,
  seedScheduleEventAs,
  startActiveSessionAs,
  createCharacterAs,
  proposeCharacterAs,
  approveCharacterAs,
} from './helpers/campaign';

test.describe('Lot smoke — RSVP / init display / galerie / PDF', () => {
  test('joueur RSVP Oui sur une date agenda', async ({ browser }) => {
    test.setTimeout(120_000);

    const ownerCtx = await browser.newContext();
    const playerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const playerPage = await playerCtx.newPage();

    const owner = await loginSeedSession(ownerPage.request);
    const player = await registerConfirmAndLogin(playerPage.request, 'Rsvp');
    const campaignId = await createCampaignAs(ownerPage, owner, `E2E RSVP ${Date.now()}`);
    await invitePlayerToCampaign(ownerPage, owner, player, campaignId);
    const eventId = await seedScheduleEventAs(ownerPage, owner, campaignId, 'Soirée RSVP E2E');

    await applyAuthSession(playerPage, player, `/campaigns/${campaignId}?tab=calendar`);
    await expect(playerPage.getByTestId('campaign-calendar-root')).toBeVisible({ timeout: 30_000 });
    const eventTitle = playerPage.getByText('Soirée RSVP E2E').first();
    await expect(eventTitle).toBeVisible({ timeout: 20_000 });
    await eventTitle.click();
    await expect(playerPage.getByTestId('calendar-event-panel')).toBeVisible();
    await playerPage.getByTestId('rsvp-yes').click();

    await expect
      .poll(
        async () => {
          const res = await playerPage.request.get(`/api/me/campaigns/${campaignId}`, {
            headers: { Authorization: `Bearer ${player.token}` },
          });
          if (!res.ok()) return false;
          const body = (await res.json()) as {
            data?: { scheduleEvents?: Array<{ id: string; rsvps?: Array<{ status: string }> }> };
          };
          const ev = (body.data?.scheduleEvents ?? []).find((e) => e.id === eventId);
          return (ev?.rsvps ?? []).some((r) => r.status === 'yes');
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    await ownerCtx.close();
    await playerCtx.close();
  });

  test('écran initiative ?display=1 est lecture seule', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const player = await registerConfirmAndLogin(page.request, 'InitDisp');
    const campaignId = await createCampaignAs(page, owner, `E2E InitDisp ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Héros Display');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    await startActiveSessionAs(page, owner, campaignId);
    await seedCollectingInitiativeAs(page, owner, campaignId, {
      includePlayer: true,
      playerUserId: player.user.id,
      characterName: 'Héros Display',
    });

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/init?display=1`);
    await expect(page.getByTestId('initiative-display-board')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Collecte|Embuscade|initiative/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Envoyer mon jet/i })).toHaveCount(0);
    await expect(page.getByText(/Héros Display|Gobelin/i).first()).toBeVisible();
  });

  test('galerie donjons liste un partage public', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await loginSeedSession(page.request);
    const name = `Galerie E2E ${Date.now()}`;
    await createSharedDungeonAs(page, owner, name);

    await applyAuthSession(page, owner, '/dungeons/gallery');
    await expect(page.getByRole('heading', { name: /Galerie de donjons/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Voir \/ copier/i }).first()).toBeVisible();
  });

  test('create → share → gallery → copy → Mes donjons', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const name = `Copie Galerie E2E ${Date.now()}`;
    const { token } = await createSharedDungeonAs(page, owner, name);

    await applyAuthSession(page, owner, '/dungeons/gallery');
    await expect(page.getByRole('heading', { name: /Galerie de donjons/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });

    const card = page.getByTestId('gallery-card').filter({ hasText: name });
    await expect(card).toBeVisible();
    await card.getByRole('link', { name: /Voir \/ copier/i }).click();
    await expect(page).toHaveURL(new RegExp(`/dungeons/shared/${token}`), { timeout: 15_000 });
    await expect(page.getByTestId('dungeon-shared')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('dungeon-shared-import').click();
    await expect(page).toHaveURL(/\/dungeons\/[^/]+$/, { timeout: 20_000 });

    await page.goto('/dungeons');
    await expect(page.getByRole('heading', { name: /Mes\s+Donjons/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('session : PDF soirée + brouillon récap sur /play', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E PDF ${Date.now()}`);
    const sessionId = await seedEveningExportSessionAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/sessions/${sessionId}`);
    await expect(page.getByTestId('export-evening-pdf')).toBeVisible({ timeout: 30_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByTestId('export-evening-pdf').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    await startActiveSessionAs(page, owner, campaignId);
    await applyAuthSession(page, owner, `/campaigns/${campaignId}/play`);
    await expect(page.getByText(/Table de jeu/i).first()).toBeVisible({ timeout: 30_000 });
    // Sticky play header covers the button center — DOM click bypasses hit-testing.
    await page.getByTestId('end-play-session').evaluate((el: HTMLButtonElement) => el.click());
    await expect(page.getByTestId('fill-recap-draft')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('fill-recap-draft').click();
    const recap = page.locator('#end-session-recap');
    await expect(recap).toBeVisible();
    const value = await recap.inputValue();
    expect(value.length).toBeGreaterThan(10);
    await page.getByRole('button', { name: 'Annuler' }).click();
  });
});
