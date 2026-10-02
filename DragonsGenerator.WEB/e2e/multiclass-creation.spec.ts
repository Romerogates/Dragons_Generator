import { test, expect } from '@playwright/test';
import {
  completeSpeciesCivilizationBackground,
  expectStepHeading,
  incrementAbility,
  pickCarouselCard,
  startFreshWizard,
} from './helpers/wizard-paths';

/**
 * Smoke wizard — multiclassage (RAW, budget additif).
 * Niveau étape 1 = classe primaire ; chaque secondaire ajoute des niveaux (total ≤ 20).
 * Ex. Guerrier 5 + Magicien 2 → total 7.
 */
test.describe('Wizard — multiclassage (RAW)', () => {
  test.beforeEach(async ({ page }) => {
    await startFreshWizard(page);
  });

  test('ajoute une classe secondaire et affiche le budget primaire/secondaires/total', async ({
    page,
  }) => {
    const levelOption = page.getByTestId('level-step-option').filter({ hasText: /^5$/ });
    if (await levelOption.isVisible().catch(() => false)) {
      await levelOption.click();
      await page.getByTestId('level-step-continue').click();
    }

    await completeSpeciesCivilizationBackground(page, 'Érudit');

    await pickCarouselCard(page, 'cls-guerrier');
    await pickCarouselCard(page, 'feat-style-duel');

    const multiclassHeading = page.getByText('⚔️ Multiclassage (optionnel)');
    await expect(multiclassHeading).toBeVisible({ timeout: 15_000 });

    const budget = page.getByTestId('multiclass-level-budget');
    await expect(budget).toContainText(/primaire 5/i);
    await expect(budget).toContainText(/secondaires 0/i);
    await expect(budget).toContainText(/total 5 \/ 20/i);

    const addSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: '— Choisir une classe à ajouter —' }) });
    await addSelect.selectOption({ label: 'Magicien' });
    await page.getByRole('button', { name: '+ Ajouter cette classe' }).click();

    const secondaryRow = page.locator('div.border-slate-700').filter({ hasText: 'Magicien' }).last();
    await expect(secondaryRow).toBeVisible();

    const levelInput = secondaryRow.locator('input[type="number"]');
    await levelInput.fill('2');

    await expect(budget).toContainText(/primaire 5/i);
    await expect(budget).toContainText(/secondaires 2/i);
    await expect(budget).toContainText(/total 7 \/ 20/i);

    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Force', 3);
    await incrementAbility(page, 'Intelligence', 2);

    await expect(page.getByText(/prérequis de multiclassage/i)).toHaveCount(0);
  });
});
