import { test, expect } from '@playwright/test';
import { applyAuthSession, loginSeedSession } from './helpers/auth';
import { createCampaignAs } from './helpers/campaign';

test.describe('Campagne — calendrier de table', () => {
  test('MJ ouvre Calendrier, ajoute une date et voit le panneau', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Cal ${Date.now()}`);

    await applyAuthSession(page, owner, `/campaigns/${campaignId}?tab=calendar`);

    await expect(page.getByTestId('campaign-calendar-root')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('calendar-export-ics')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Calendrier de cette campagne/i })).toBeVisible();

    await page.getByTestId('calendar-add-date').click();
    const panel = page.getByTestId('calendar-event-panel');
    await expect(panel).toBeVisible();

    await panel.locator('input[type="text"]').first().fill('Soirée E2E');
    await page.getByTestId('calendar-save-event').click();

    await expect(page.getByTestId('calendar-event-panel')).toHaveCount(0);
    await expect(page.getByText('Soirée E2E').first()).toBeVisible({ timeout: 15_000 });
  });
});
