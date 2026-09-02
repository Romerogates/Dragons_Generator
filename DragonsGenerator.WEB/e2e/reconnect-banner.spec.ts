import { test, expect } from '@playwright/test';

const LEGACY_TOKEN_KEY = 'dragons_auth_token';
const DISMISS_KEY = 'dragons-auth-cookie-migration-dismissed';

function seedLegacyAuthInitScript(): void {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([tokenKey, dismissKey]) => {
        localStorage.setItem(tokenKey, 'legacy-jwt-test');
        sessionStorage.removeItem(dismissKey);
      },
      [LEGACY_TOKEN_KEY, DISMISS_KEY],
    );
  });
}

test.describe('Bannière reconnexion auth', () => {
  seedLegacyAuthInitScript();

  test('shows reconnect banner when legacy JWT is stored', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Dragons/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('status').filter({ hasText: 'Connexion mise à jour' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: 'Se connecter' }).first()).toBeVisible();
  });

  test('dismiss hides banner and clears legacy token', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('status').filter({ hasText: 'Connexion mise à jour' });
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await banner.getByRole('button', { name: 'Fermer' }).click();
    await expect(banner).toHaveCount(0, { timeout: 5_000 });
    expect(
      await page.evaluate((tokenKey) => localStorage.getItem(tokenKey), LEGACY_TOKEN_KEY),
    ).toBeNull();
  });
});
