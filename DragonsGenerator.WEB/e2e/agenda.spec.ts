import { test, expect } from '@playwright/test';
import { applyAuthSession, loginSeedSession } from './helpers/auth';
import { createCampaignAs } from './helpers/campaign';

test.describe('Agenda global', () => {
  test('navbar Agenda ouvre le calendrier multi-campagnes', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await loginSeedSession(page.request);
    await createCampaignAs(page, owner, `E2E Agenda ${Date.now()}`);
    await applyAuthSession(page, owner, '/agenda');

    await expect(page.getByTestId('global-agenda')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /^Agenda$/i })).toBeVisible();
    await expect(page.getByTestId('agenda-export-ics')).toBeVisible({ timeout: 15_000 });
    // Calendrier visible une fois le chargement terminé (liste ou mois).
    await expect(page.getByTestId('global-agenda-calendar')).toBeVisible({ timeout: 20_000 });
  });
});
