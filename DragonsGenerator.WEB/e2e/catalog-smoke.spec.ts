import { test, expect } from '@playwright/test';

test.describe('Catalogues (smoke)', () => {
  test('species list loads readable entries', async ({ page }) => {
    await page.goto('/species');
    await expect(page.getByText(/Registre des/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/espèces recensées/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('a[href^="/species/"]').first()).toBeVisible({ timeout: 30_000 });
  });

  test('classes list loads', async ({ page }) => {
    await page.goto('/classes');
    await expect(page.getByRole('heading', { name: /Classes de/i })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByPlaceholder(/Rechercher une classe/i)).toBeVisible();
  });

  test('backgrounds list loads', async ({ page }) => {
    await page.goto('/backgrounds');
    await expect(page.getByRole('heading', { name: /Historiques/i })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.locator('a[href^="/backgrounds/"]').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('combat actions list loads', async ({ page }) => {
    await page.goto('/combat-actions');
    await expect(page.getByRole('heading', { name: /Actions de combat/i })).toBeVisible({
      timeout: 45_000,
    });
  });
});
