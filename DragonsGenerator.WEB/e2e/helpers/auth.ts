import { expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'test@dragons.local';
const TEST_PASSWORD = 'TestDragons!2026';

/** Connexion via l'écran /login (compte seed local). */
export async function loginViaUi(page: Page, returnUrl = '/'): Promise<void> {
  await page.goto(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

export { TEST_EMAIL, TEST_PASSWORD };
