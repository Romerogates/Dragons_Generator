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
      localStorage.setItem('dragons-forge-skip-mode-prompt', '1');
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
    // Après reset : dialog mode éventuel ou étape Niveau.
    const modeManual = page.getByTestId('forge-mode-manual');
    if (await modeManual.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await modeManual.click();
    }
    await expect(page.getByTestId('level-step-continue')).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Forge quick generate', () => {
  test('Générer un héros after level ack jumps to récap', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/create');
    await page.evaluate(() => {
      localStorage.removeItem('dragon_character_builder_v6');
      localStorage.setItem('dragons-forge-skip-mode-prompt', '1');
    });
    await page.reload();

    const modeManual = page.getByTestId('forge-mode-manual');
    if (await modeManual.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await modeManual.click();
    }

    await expect(page.getByTestId('level-step-continue')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: '3', exact: true }).click();

    await page.getByTestId('forge-quick-generate').click();
    await expect(page.getByText(/Héros généré/i)).toBeVisible({ timeout: 60_000 });
    // Stepper : étape récap active (dernier numéro / titre)
    await expect(page.getByTestId('forge-current-step-title')).toHaveText(/Récapitulatif/i, {
      timeout: 15_000,
    });
  });

  test('Compléter le reste without level shows popup', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/create');
    await page.evaluate(() => {
      localStorage.removeItem('dragon_character_builder_v6');
      localStorage.setItem('dragons-forge-skip-mode-prompt', '1');
    });
    await page.reload();

    const modeManual = page.getByTestId('forge-mode-manual');
    if (await modeManual.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await modeManual.click();
    }

    await expect(page.getByTestId('forge-auto-complete')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('forge-auto-complete').click();
    await expect(page.getByTestId('forge-level-required')).toBeVisible({ timeout: 10_000 });
  });
});
