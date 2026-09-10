import { test, expect } from '@playwright/test';
import { applyAuthSession, loginSeedSession } from './helpers/auth';
import { createCampaignAs } from './helpers/campaign';

test.describe('Campagne — documents FR', () => {
  test('créer un document type Lettre (pas Letter)', async ({ page }) => {
    test.setTimeout(60_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Docs ${Date.now()}`);
    await applyAuthSession(page, owner, `/campaigns/${campaignId}?tab=handouts`);

    await expect(page.getByText(/Aucun document — créez un document/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: '+ Document' }).click();

    const kindSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: 'Lettre' }) })
      .first();
    await expect(kindSelect).toBeVisible({ timeout: 10_000 });
    await kindSelect.selectOption({ label: 'Lettre' });
    await expect(kindSelect).toHaveValue('letter');
    await expect(page.getByRole('option', { name: 'Letter' })).toHaveCount(0);
  });
});
