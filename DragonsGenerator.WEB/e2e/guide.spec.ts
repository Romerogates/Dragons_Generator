import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

test.describe('Guide wiki', () => {
  test('hub rulebooks and article with classic comments', async ({ page }) => {
    test.setTimeout(90_000);
    await loginViaUi(page, '/guide');

    await expect(page.getByRole('navigation').or(page.locator('app-navbar')).first()).toBeVisible({
      timeout: 30_000,
    });
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

  test('livrets en ligne + post commentaire (smoke)', async ({ page }) => {
    test.setTimeout(90_000);
    await loginViaUi(page, '/guide/mj-en-ligne');

    await expect(page.getByRole('heading', { name: /MJ|En ligne/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Télécharger le PDF/i })).toBeVisible();

    await page.goto('/guide/joueur-en-ligne');
    await expect(page.getByRole('heading', { name: /Joueur|En ligne/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/guide/faq');
    await expect(page.getByRole('heading', { name: 'Commentaires' })).toBeVisible({ timeout: 15_000 });
    const box = page.getByPlaceholder(/Écrire un commentaire/i);
    await expect(box).toBeVisible({ timeout: 10_000 });
    const body = `E2E smoke ${Date.now()}`;
    await box.fill(body);
    await page.getByRole('button', { name: /^Publier$/i }).click();
    await expect(page.getByText(body).first()).toBeVisible({ timeout: 20_000 });
  });
});
