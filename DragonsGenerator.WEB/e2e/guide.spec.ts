import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

test.describe('Guide forum', () => {
  test('index lists topics and opens a detail page', async ({ page }) => {
    test.setTimeout(90_000);
    await loginViaUi(page, '/guide');

    await expect(page.getByRole('heading', { name: 'Guide', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByPlaceholder('Rechercher une fiche…')).toBeVisible();

    const topicLink = page.locator('a[href^="/guide/"]').filter({ hasText: /FAQ|Premiers pas|Parcours/i }).first();
    await expect(topicLink).toBeVisible({ timeout: 15_000 });
    await topicLink.click();

    await expect(page).toHaveURL(/\/guide\/[a-z0-9-]+/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Commentaires/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('Ajouter un commentaire…')).toBeVisible();
    await expect(page.getByText(/Lire →|Étapes|Parcours|widgets/i).first()).toBeVisible();
  });
});
