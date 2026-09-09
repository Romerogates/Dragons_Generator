import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';
import { createPlayableCampaign } from './helpers/campaign';

test.describe('Mode table MJ', () => {
  test('session → combat → collecte init → fin combat → fin session', async ({ page }) => {
    test.setTimeout(120_000);

    page.on('dialog', (dialog) => dialog.accept());

    await loginViaUi(page, '/');
    const campaignId = await createPlayableCampaign(page);
    await page.goto(`/campaigns/${campaignId}/play`);

    await expect(page.getByRole('button', { name: 'Entrer en session' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Entrer en session' }).click();

    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('navigation', { name: 'Sections de la session' })).toBeVisible();
    await page.getByRole('button', { name: 'Combattre' }).click();

    await page.getByRole('button', { name: '+ Allié PNJ' }).click();
    await page.getByRole('button', { name: '+ Adversaire', exact: true }).click();

    await page.getByRole('button', { name: 'Continuer → Initiative' }).click();
    await expect(page.getByText(/Collecte ouverte/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Fin combat' }).first().click();
    await expect(page.getByRole('navigation', { name: 'Sections de la session' }).getByRole('button', { name: 'Résumé' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Combattre' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sections de la session' }).getByRole('button', { name: 'Donjon' })).toBeVisible();

    await page.getByRole('button', { name: 'Terminer la session' }).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}$`), { timeout: 20_000 });
    await expect(page.getByText('Table de jeu — session en cours')).not.toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Résumé' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sections de la campagne' }).getByRole('button', { name: 'Préparation' })).toBeVisible();
  });
});
