import { test, expect } from '@playwright/test';
import {
  applyAuthSession,
  registerConfirmAndLogin,
} from './helpers/auth';
import {
  approveCharacterAs,
  createCampaignAs,
  createCharacterAs,
  invitePlayerToCampaign,
  proposeCharacterAs,
  patchLiveTableAs,
  seedEveningPawnsAs,
  startActiveSessionAs,
} from './helpers/campaign';
import { bearer } from './helpers/campaign/http';

test.describe('Campagne — table joueur', () => {
  test('dock session : Documents, Ma fiche, attente combat', async ({ page }) => {
    test.setTimeout(120_000);

    const owner = await registerConfirmAndLogin(page.request, 'Mj');
    const player = await registerConfirmAndLogin(page.request, 'Pj');

    const campaignId = await createCampaignAs(page, owner, `E2E Player ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Lyra E2E');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    await startActiveSessionAs(page, owner, campaignId);

    await applyAuthSession(page, player, `/campaigns/${campaignId}`);

    const dockFab = page.getByRole('button', { name: 'Session en cours' });
    await expect(dockFab).toBeVisible({ timeout: 30_000 });
    await dockFab.click();

    await expect(page.getByText('Session live E2E').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await page.getByRole('button', { name: /Table plein écran/i }).click();

    await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}/play`), { timeout: 15_000 });
    await expect(page.getByText(/Table de jeu ·/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('play-documents-btn')).toBeVisible();
    await expect(page.getByTestId('play-my-sheet-btn')).toBeVisible();
    await expect(page.getByText('Le MJ pose le décor…')).toBeVisible();
  });

  test('le joueur déplace son pion via live-table, pas celui des autres', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await registerConfirmAndLogin(page.request, 'MjPawn');
    const player = await registerConfirmAndLogin(page.request, 'PjPawn');

    const campaignId = await createCampaignAs(page, owner, `E2E Pawn ${Date.now()}`);
    const characterId = await createCharacterAs(page, player, 'Lyra Pawn');
    await invitePlayerToCampaign(page, owner, player, campaignId);
    await proposeCharacterAs(page, player, campaignId, characterId);
    await approveCharacterAs(page, owner, campaignId);
    const sessionId = await startActiveSessionAs(page, owner, campaignId);

    const playerPawnId = `pawn-${player.user.id}`;
    await seedEveningPawnsAs(page, owner, campaignId, sessionId, [
      { id: playerPawnId, name: 'Lyra', mapX: 1, mapY: 1, memberUserId: player.user.id },
      { id: 'pawn-other', name: 'Aria', mapX: 2, mapY: 2, memberUserId: 'other' },
    ]);

    await patchLiveTableAs(page, player, campaignId, {
      sessionId,
      activeMapId: 'map-hijack',
      tablePawns: [
        { id: playerPawnId, name: 'Lyra', mapX: 8, mapY: 7, memberUserId: player.user.id },
        { id: 'pawn-other', name: 'Aria', mapX: 9, mapY: 9, memberUserId: 'other' },
      ],
    });

    const getRes = await page.request.get(`/api/me/campaigns/${campaignId}`, {
      headers: bearer(owner.token),
    });
    expect(getRes.ok()).toBeTruthy();
    const campaign = (await getRes.json()) as {
      data: {
        sessions: Array<{
          id: string;
          activeMapId?: string;
          tablePawns?: Array<{ id: string; mapX: number }>;
        }>;
      };
    };
    const session = campaign.data.sessions.find((s) => s.id === sessionId);
    expect(session?.tablePawns?.find((p) => p.id === playerPawnId)?.mapX).toBe(8);
    expect(session?.tablePawns?.find((p) => p.id === 'pawn-other')?.mapX).toBe(2);
  });
});
