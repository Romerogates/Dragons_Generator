import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  registerConfirmAndLogin,
  type AuthSession,
} from './helpers/auth';
import {
  becomeFriendsAs,
  createCampaignAs,
  createCharacterAs,
  createJoinLinkAs,
} from './helpers/campaign';

function bearer(token: string | null): Record<string, string> {
  expect(token, 'Bearer token required').toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

async function sendFriendAttachment(
  page: import('@playwright/test').Page,
  session: AuthSession,
  friendUserId: string,
  attachmentKind: 'character' | 'invite',
  attachmentPayload: Record<string, string>,
): Promise<void> {
  const res = await page.request.post(`/api/me/friends/${friendUserId}/messages`, {
    headers: bearer(session.token),
    data: {
      body: '',
      attachmentKind,
      attachmentPayload: JSON.stringify(attachmentPayload),
    },
  });
  expect(res.ok(), `Send attachment failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/**
 * Smoke dock Messages : partage fiche + invitation /join.
 * Deep-link /friends/chat/:id pour éviter la liste Amis saturée du compte seed.
 */
test.describe('Chat amis — partage fiche & invitation', () => {
  test('MJ partage fiche + inviter → ami consulte et rejoint', async ({ browser }) => {
    test.setTimeout(180_000);

    const ownerCtx = await browser.newContext();
    const playerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const playerPage = await playerCtx.newPage();

    const owner = await loginSeedSession(ownerPage.request);
    const player = await registerConfirmAndLogin(playerPage.request, 'Chat');
    const title = `E2E Chat Share ${Date.now()}`;
    const campaignId = await createCampaignAs(ownerPage, owner, title);
    const heroName = `Héros Chat ${Date.now()}`;
    await createCharacterAs(ownerPage, owner, heroName);
    await becomeFriendsAs(ownerPage, owner, player);
    const { token: joinToken } = await createJoinLinkAs(ownerPage, owner, campaignId);

    // Partie UI MJ : deep-link + trombone
    await applyAuthSession(ownerPage, owner, `/friends/chat/${player.user.id}`);
    const ownerPanel = ownerPage.locator('.friend-chat-panel');
    await expect(ownerPage.getByRole('heading', { name: 'Messages' })).toBeVisible({
      timeout: 20_000,
    });
    await ownerPanel.getByRole('button', { name: 'Partager' }).click();
    await ownerPanel.getByRole('button', { name: heroName, exact: true }).click();
    await expect(ownerPanel.getByText('Fiche partagée').first()).toBeVisible({ timeout: 15_000 });

    await ownerPanel.getByRole('button', { name: 'Partager' }).click();
    await ownerPanel
      .getByRole('button', { name: new RegExp(`Ouvrir · ${title}`) })
      .locator('xpath=..')
      .getByRole('button', { name: /Inviter à rejoindre/i })
      .click();
    await expect(ownerPanel.getByText('Invitation campagne').first()).toBeVisible({
      timeout: 15_000,
    });

    // Token connu côté joueur (évite un 2e invite UI si le menu a scrollé).
    await sendFriendAttachment(ownerPage, owner, player.user.id, 'invite', {
      joinToken,
      campaignId,
      campaignTitle: title,
    });

    await applyAuthSession(playerPage, player, `/friends/chat/${owner.user.id}`);
    const playerPanel = playerPage.locator('.friend-chat-panel');
    await expect(playerPage.getByRole('heading', { name: 'Messages' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(playerPanel.getByText('Fiche partagée').first()).toBeVisible({ timeout: 15_000 });

    // Scope thread : éviter le preview « Invitation / Fiche » de la liste conversations.
    await playerPanel
      .getByRole('button', { name: new RegExp(heroName) })
      .filter({ hasText: 'Fiche partagée' })
      .first()
      .click();
    await expect(playerPage).toHaveURL(/\/character-sheet/, { timeout: 20_000 });
    await expect(playerPage.getByText(/Consultation/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(playerPage.getByText(/Fiche partagée par un ami/i).first()).toBeVisible();
    await expect(playerPage.getByRole('button', { name: /Retour aux messages/i })).toBeVisible();

    await playerPage.getByRole('button', { name: /Retour aux messages/i }).click();
    await expect(playerPage).toHaveURL(/\/friends/, { timeout: 15_000 });

    await applyAuthSession(playerPage, player, `/friends/chat/${owner.user.id}`);
    const playerPanel2 = playerPage.locator('.friend-chat-panel');
    await playerPanel2
      .getByRole('button', { name: new RegExp(title) })
      .filter({ hasText: 'Invitation campagne' })
      .first()
      .click();
    await expect(playerPage).toHaveURL(/\/join\//, { timeout: 20_000 });
    await expect(playerPage.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 });
    await playerPage.getByRole('button', { name: 'Rejoindre la campagne' }).click();
    await expect(playerPage).toHaveURL(new RegExp(`/campaigns/${campaignId}`), {
      timeout: 20_000,
    });
    await expect(
      playerPage.getByText(/Bienvenue|Proposer un héros|E2E Chat Share/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await ownerCtx.close();
    await playerCtx.close();
  });
});
