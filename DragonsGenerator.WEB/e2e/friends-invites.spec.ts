import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  loginSeedSession,
  registerConfirmAndLogin,
} from './helpers/auth';
import { createCampaignAs } from './helpers/campaign';

function bearer(token: string | null): Record<string, string> {
  expect(token, 'Bearer token required').toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

test.describe('Amis & invitations campagne (UI)', () => {
  test('demande d’ami → accepter ; invitation campagne → rejoindre', async ({ browser }) => {
    test.setTimeout(120_000);

    const ownerContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const playerPage = await playerContext.newPage();

    const owner = await loginSeedSession(ownerPage.request);
    const player = await registerConfirmAndLogin(playerPage.request, 'Ami');
    const campaignId = await createCampaignAs(ownerPage, owner, `E2E Amis ${Date.now()}`);

    const friendReq = await ownerPage.request.post('/api/me/friends/request', {
      headers: bearer(owner.token),
      data: { userId: player.user.id },
    });
    expect(friendReq.ok(), await friendReq.text()).toBeTruthy();

    await applyAuthSession(playerPage, player, '/friends');
    await playerPage.getByRole('button', { name: 'Demandes' }).click();
    await expect(playerPage.getByText(owner.user.displayName)).toBeVisible({ timeout: 20_000 });
    await playerPage.getByRole('button', { name: 'Accepter' }).first().click();
    await expect(playerPage.getByText(/Demande d’ami acceptée/i)).toBeVisible({ timeout: 15_000 });

    const inviteRes = await ownerPage.request.post(`/api/me/campaigns/${campaignId}/invites`, {
      headers: bearer(owner.token),
      data: { userId: player.user.id },
    });
    expect(inviteRes.ok(), await inviteRes.text()).toBeTruthy();

    await applyAuthSession(playerPage, player, '/campaigns');
    await expect(playerPage.getByText(/Invitations en attente/i)).toBeVisible({ timeout: 20_000 });
    await playerPage.getByRole('button', { name: 'Rejoindre' }).first().click();
    await expect(playerPage.getByRole('heading', { name: /E2E Amis/i })).toBeVisible({
      timeout: 20_000,
    }).catch(async () => {
      await expect(playerPage.getByText(/E2E Amis/i).first()).toBeVisible({ timeout: 10_000 });
    });

    await ownerContext.close();
    await playerContext.close();
  });

  test('demande d’ami → refuser', async ({ browser }) => {
    test.setTimeout(90_000);

    const aCtx = await browser.newContext();
    const bCtx = await browser.newContext();
    const aPage = await aCtx.newPage();
    const bPage = await bCtx.newPage();

    const a = await loginSeedSession(aPage.request);
    const b = await registerConfirmAndLogin(bPage.request, 'Ref');

    const friendReq = await aPage.request.post('/api/me/friends/request', {
      headers: bearer(a.token),
      data: { userId: b.user.id },
    });
    expect(friendReq.ok(), await friendReq.text()).toBeTruthy();

    await applyAuthSession(bPage, b, '/friends');
    await bPage.getByRole('button', { name: 'Demandes' }).click();
    await expect(bPage.getByText(a.user.displayName)).toBeVisible({ timeout: 20_000 });
    await bPage.getByRole('button', { name: 'Refuser' }).first().click();
    await expect(bPage.getByText(/Demande refusée/i)).toBeVisible({ timeout: 15_000 });

    await aCtx.close();
    await bCtx.close();
  });
});
