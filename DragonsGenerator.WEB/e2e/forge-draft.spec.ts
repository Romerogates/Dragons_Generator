import { test, expect } from '@playwright/test';

/**
 * E2E brouillon forge — Reprendre / Recommencer (#28).
 * Persiste un brouillon niveau-seul (sans speciesId) puis vérifie le prompt.
 */
test.describe('Forge draft resume', () => {
  test('shows Reprendre / Recommencer for a level-only draft', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto('/create');
    await page.evaluate(() => {
      localStorage.setItem(
        'dragon_character_builder_v6',
        JSON.stringify({
          creation: {
            targetLevel: 5,
            speciesId: null,
            classId: null,
            name: '',
          },
          currentStep: 1,
          savedAt: Date.now(),
        }),
      );
    });
    await page.reload();

    await expect(page.getByRole('heading', { name: /Brouillon retrouvé/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Reprendre/i })).toBeVisible();
    await expect(page.getByTestId('wizard-draft-restart')).toBeVisible();

    await page.getByRole('button', { name: /Reprendre/i }).click();
    await expect(page.getByRole('heading', { name: /Brouillon retrouvé/i })).toHaveCount(0);

    // Recharge → prompt à nouveau, puis Recommencer
    await page.reload();
    await expect(page.getByRole('heading', { name: /Brouillon retrouvé/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('wizard-draft-restart').click();
    await page.getByRole('button', { name: /Effacer et recommencer/i }).click();
    await expect(page.getByTestId('level-step-continue')).toBeVisible({ timeout: 20_000 });
  });
});
