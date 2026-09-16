import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

test.describe('Guide wiki', () => {
  test('hub rulebooks and article with classic comments', async ({ page }) => {
    test.setTimeout(90_000);
    await loginViaUi(page, '/guide');

    await expect(page.getByRole('heading', { name: /^Guide$/i }).first()).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole('link', { name: /Règles présentiel/i }).first()).toBeVisible();
    await page.getByRole('link', { name: /Règles présentiel/i }).first().click();
    await expect(page).toHaveURL(/\/guide\/mj-table/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Télécharger le PDF/i })).toBeVisible();

    await page.goto('/guide/classe/cls-barbare');
    await expect(page.getByRole('heading', { name: /Barbare/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /Pack débutant/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Fiche Codex/i })).toBeVisible();

    await page.goto('/guide');
    await expect(page.getByPlaceholder('Rechercher…')).toBeVisible({ timeout: 15_000 });

    const topicLink = page
      .locator('a[href^="/guide/"]')
      .filter({ hasText: /FAQ|Premiers pas|Parcours/i })
      .first();
    await expect(topicLink).toBeVisible({ timeout: 15_000 });
    await topicLink.click();

    await expect(page).toHaveURL(/\/guide\/[a-z0-9-]+/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Commentaires' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Télécharger le PDF/i })).toBeVisible();
  });
});
