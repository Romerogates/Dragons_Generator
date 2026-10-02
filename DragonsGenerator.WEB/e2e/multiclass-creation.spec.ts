import { test, expect } from '@playwright/test';
import {
  completeSpeciesCivilizationBackground,
  expectStepHeading,
  finishClassStep,
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
  test('ajoute une classe secondaire et affiche le budget primaire/secondaires/total', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // Niveau primaire 5 avant de quitter l'étape Niveau (startFreshWizard le valide).
    await startFreshWizard(page, { level: 5 });

    await completeSpeciesCivilizationBackground(page, 'Érudit');

    await pickCarouselCard(page, 'cls-guerrier');
    await pickCarouselCard(page, 'feat-style-duel');
    // Niv.5 → archétype requis avant que classId soit posé (panneau multiclass).
    await pickCarouselCard(page, 'subcls-champion');

    const budget = page.getByTestId('multiclass-level-budget');
    await expect(budget).toBeVisible({ timeout: 15_000 });
    await expect(budget).toContainText(/primaire 5/i);
    await expect(budget).toContainText(/secondaires 0/i);
    await expect(budget).toContainText(/total 5 \/ 20/i);

    await budget.scrollIntoViewIfNeeded();
    const addSelect = page.getByTestId('multiclass-add-select');
    await addSelect.selectOption('cls-magicien');
    await expect(addSelect).toHaveValue('cls-magicien');
    const addBtn = page.getByTestId('multiclass-add-class');
    await expect(addBtn).toBeEnabled();
    // Native click — évite le sticky « Forger cette voie » qui intercepte les pointer events.
    await addBtn.evaluate((el: HTMLButtonElement) => el.click());

    const row = page.locator(
      '[data-testid="multiclass-secondary-row"][data-class-id="cls-magicien"]',
    );
    await expect(row).toBeVisible({ timeout: 10_000 });

    const levelInput = row.locator('input[type="number"]');
    await levelInput.fill('2');

    await expect(budget).toContainText(/primaire 5/i);
    await expect(budget).toContainText(/secondaires 2/i);
    await expect(budget).toContainText(/total 7 \/ 20/i);

    await finishClassStep(page);
    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Force', 3);
    await incrementAbility(page, 'Intelligence', 2);

    await expect(page.getByText(/prérequis de multiclassage/i)).toHaveCount(0);
  });
});
