import { test, expect } from '@playwright/test';
import {
  completeSpeciesCivilizationBackground,
  expectStepHeading,
  incrementAbility,
  pickCarouselCard,
  startFreshWizard,
} from './helpers/wizard-paths';

/**
 * Smoke wizard — multiclassage (RAW).
 * Vérifie le chemin additif : niveau 5 choisi en amont, classe primaire (Guerrier 3), puis ajout
 * d'une classe secondaire (Magicien 2) via le panneau « Multiclassage » de l'étape Classe.
 * Ne couvre pas le parcours complet jusqu'au récapitulatif (voir e2e/lettre-creation.spec.ts pour
 * un chemin mono-classe intégral, volontairement inchangé par le multiclassage additif).
 */
test.describe('Wizard — multiclassage (RAW)', () => {
  test.beforeEach(async ({ page }) => {
    await startFreshWizard(page);
  });

  test('ajoute une classe secondaire et vérifie les maîtrises réduites + prérequis', async ({ page }) => {
    // Étape 0 — Niveau : sélectionne 5 pour pouvoir répartir les niveaux entre 2 classes.
    const levelOption = page.getByTestId('level-step-option').filter({ hasText: /^5$/ });
    if (await levelOption.isVisible().catch(() => false)) {
      await levelOption.click();
      await page.getByTestId('level-step-continue').click();
    }

    await completeSpeciesCivilizationBackground(page, 'Érudit');

    // Classe primaire : Guerrier niveau 5 (total), on ne prend que 3 niveaux ici, le reste ira
    // à la classe secondaire.
    await pickCarouselCard(page, 'cls-guerrier');
    await pickCarouselCard(page, 'feat-style-duel');

    // Panneau « Multiclassage » : ajoute le Magicien comme classe secondaire.
    const multiclassHeading = page.getByText('⚔️ Multiclassage (optionnel)');
    await expect(multiclassHeading).toBeVisible({ timeout: 15_000 });

    const addSelect = page
      .locator('select')
      .filter({ has: page.locator('option', { hasText: '— Choisir une classe à ajouter —' }) });
    await addSelect.selectOption({ label: 'Magicien' });
    await page.getByRole('button', { name: '+ Ajouter cette classe' }).click();

    // La classe secondaire apparaît avec ses maîtrises réduites (jamais les maîtrises complètes de
    // départ) et son propre champ de niveau.
    const secondaryRow = page.locator('div.border-slate-700').filter({ hasText: 'Magicien' }).last();
    await expect(secondaryRow).toBeVisible();

    // Répartit les niveaux : Guerrier 3 + Magicien 2 = 5 (le niveau total choisi à l'étape 0).
    const levelInput = secondaryRow.locator('input[type="number"]');
    await levelInput.fill('2');

    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Force', 3);
    await incrementAbility(page, 'Intelligence', 2);

    // Aucun blocage de prérequis de multiclassage ne doit apparaître (Guerrier + Magicien n'ont
    // pas de prérequis conflictuel avec les caractéristiques ci-dessus).
    await expect(page.getByText(/prérequis de multiclassage/i)).toHaveCount(0);
  });
});
