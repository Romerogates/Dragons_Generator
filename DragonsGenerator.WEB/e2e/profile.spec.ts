import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

test.describe('Profil utilisateur', () => {
  test('login, update bio in settings, view profile', async ({ page }) => {
    test.setTimeout(90_000);

    await loginViaUi(page, '/settings');
    await expect(page.getByRole('heading', { name: 'Paramètres' })).toBeVisible({
      timeout: 30_000,
    });

    const bioText = `Bio E2E ${Date.now()}`;
    await page.getByLabel('Bio').fill(bioText);
    await page.getByRole('button', { name: 'Enregistrer le profil' }).click();
    await expect(page.getByText('Profil mis à jour.')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Voir le profil →' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(bioText)).toBeVisible({ timeout: 15_000 });
  });
});
