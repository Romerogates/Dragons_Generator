import { test, expect } from '@playwright/test';
import { applyAuthSession, loginSeedSession } from './helpers/auth';
import {
  createCampaignAs,
  seedEveningExportSessionAs,
  seedScheduleEventAs,
} from './helpers/campaign';

test.describe('Lot ABC — convert / deep-link / run sheet', () => {
  test('deep-link ?event= ouvre le panneau calendrier', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E EventLink ${Date.now()}`);
    const eventId = await seedScheduleEventAs(page, owner, campaignId, 'Date deep-link');

    await applyAuthSession(
      page,
      owner,
      `/campaigns/${campaignId}?tab=calendar&event=${encodeURIComponent(eventId)}`,
    );

    await expect(page.getByTestId('campaign-calendar-root')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('calendar-event-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('calendar-copy-rsvp-link')).toBeVisible();
  });

  test('MJ convertit une date en session depuis le calendrier', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Convert ${Date.now()}`);
    const eventId = await seedScheduleEventAs(page, owner, campaignId, 'À convertir');

    await applyAuthSession(
      page,
      owner,
      `/campaigns/${campaignId}?tab=calendar&event=${encodeURIComponent(eventId)}`,
    );
    await expect(page.getByTestId('calendar-event-panel')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Session de play/i }).click();

    await expect(page.getByText(/Session « À convertir » créée|Sessions/i).first()).toBeVisible({
      timeout: 20_000,
    });
    // Date liée conservée (linkedSessionId) — l’événement reste dans le JSON.
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`/api/me/campaigns/${campaignId}`, {
            headers: { Authorization: `Bearer ${owner.token}` },
          });
          if (!res.ok()) return false;
          const body = (await res.json()) as {
            data?: {
              scheduleEvents?: Array<{ id: string; linkedSessionId?: string | null }>;
              sessions?: Array<{ title?: string }>;
            };
          };
          const ev = (body.data?.scheduleEvents ?? []).find((e) => e.id === eventId);
          const hasSession = (body.data?.sessions ?? []).some((s) => s.title === 'À convertir');
          return !!ev?.linkedSessionId && hasSession;
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  });

  test('préremplir run sheet depuis la prépa', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E RunSheet ${Date.now()}`);
    const sessionId = await seedEveningExportSessionAs(page, owner, campaignId);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}/sessions/${sessionId}`);
    await expect(page.getByTestId('prefill-run-sheet')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('prefill-run-sheet').click();
    await expect(page.getByText(/Run sheet prérempli/i)).toBeVisible({ timeout: 10_000 });
  });
});
