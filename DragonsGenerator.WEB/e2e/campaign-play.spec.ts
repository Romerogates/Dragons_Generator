import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';
import { createPlayableCampaign } from './helpers/campaign';

test.describe('Mode table MJ', () => {
  test('session → combat → collecte init → mort → fin combat → fin session', async ({ page }) => {
    test.setTimeout(120_000);

    page.on('dialog', (dialog) => dialog.accept());

    await loginViaUi(page, '/');
    const campaignId = await createPlayableCampaign(page);
    await page.goto(`/campaigns/${campaignId}/play`);

    await expect(page.getByRole('button', { name: 'Démarrer la table' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Démarrer la table' }).click();

    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Nouveau combat (vide)' }).click();

    await page.getByRole('button', { name: '+ Combattant' }).click();

    const row = page.locator('tbody tr').first();
    await row.getByPlaceholder('Nom').fill('Gobelin test');
    await row.locator('select').selectOption('monster');
    await row.locator('input[min="1"]').fill('12');

    await page.getByRole('button', { name: 'Collecter l’init' }).click();
    await expect(page.getByText(/Collecte ouverte/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Mort' }).click();
    await expect(page.locator('tr.opacity-50')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Fin combat' }).click();
    await expect(page.getByRole('button', { name: 'Nouveau combat (vide)' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Terminer la session' }).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}$`), { timeout: 20_000 });
    await expect(page.getByText('Table de jeu — session en cours')).not.toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Planifiez une session/i)).toBeVisible({ timeout: 20_000 });
  });
});
