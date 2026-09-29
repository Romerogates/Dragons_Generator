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

    await page.getByTestId('agenda-add-date').click();
    await expect(page.getByTestId('agenda-add-panel')).toBeVisible();
    await expect(page.getByTestId('agenda-campaign-select')).toBeVisible();
    // Campagne présélectionnée → enregistrement campagne.
    await page.getByTestId('agenda-save-date').click();
    await expect(page.getByTestId('agenda-add-panel')).toHaveCount(0, { timeout: 20_000 });
  });

  test('date perso sans campagne (héros seul)', async ({ page }) => {
    test.setTimeout(90_000);

    const owner = await loginSeedSession(page.request);
    await createCampaignAs(page, owner, `E2E Agenda Perso ${Date.now()}`);
    await applyAuthSession(page, owner, '/agenda');

    await expect(page.getByTestId('global-agenda-calendar')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('agenda-add-date').click();
    await expect(page.getByTestId('agenda-add-panel')).toBeVisible();

    // Aucune campagne → chemin perso ; héros requis si présent.
    await page.getByTestId('agenda-campaign-select').selectOption({ value: '' });
    const heroSelect = page.getByTestId('agenda-hero-select');
    const heroOptions = heroSelect.locator('option');
    const heroCount = await heroOptions.count();
    if (heroCount > 1) {
      const firstHeroValue = await heroOptions.nth(1).getAttribute('value');
      if (firstHeroValue) await heroSelect.selectOption(firstHeroValue);
    } else {
      // Pas de héros cloud : le save doit rester désactivé sans campagne.
      await expect(page.getByTestId('agenda-save-date')).toBeDisabled();
      return;
    }

    await page.getByTestId('agenda-save-date').click();
    await expect(page.getByTestId('agenda-add-panel')).toHaveCount(0, { timeout: 20_000 });
  });
});
