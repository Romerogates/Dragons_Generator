import { test, expect } from '@playwright/test';

test.describe('Bannière hors ligne', () => {
  test('shows offline banner when connectivity is lost', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Dragons/i })).toBeVisible({ timeout: 30_000 });

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByRole('status').filter({ hasText: 'Hors ligne' })).toBeVisible({
      timeout: 10_000,
    });

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByRole('status').filter({ hasText: 'Hors ligne' })).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
