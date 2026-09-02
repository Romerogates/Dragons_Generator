import { test } from '@playwright/test';
import {
  completeSpeciesCivilizationBackground,
  expectStepHeading,
  pickCarouselCard,
  startFreshWizard,
} from './helpers/wizard-paths';

/**
 * Smoke wizard — vérifie que chaque classe clé passe l'étape Classe
 * et atteint les Caractéristiques. Pas de parcours complet (trop lent en CI).
 * Parcours intégral : e2e/lettre-creation.spec.ts
 */
test.describe('Wizard — smoke classes clés', () => {
  test.beforeEach(async ({ page }) => {
    await startFreshWizard(page);
  });

  test('guerrier atteint les caractéristiques', async ({ page }) => {
    await completeSpeciesCivilizationBackground(page, 'Érudit');
    await pickCarouselCard(page, 'cls-guerrier');
    await pickCarouselCard(page, 'feat-style-duel');
    await expectStepHeading(page, /Essence & Attributs/i);
  });

  test('magicien atteint les caractéristiques', async ({ page }) => {
    await completeSpeciesCivilizationBackground(page, 'Érudit');
    await pickCarouselCard(page, 'cls-magicien');
    await expectStepHeading(page, /Essence & Attributs/i);
  });

  test('prêtre atteint les caractéristiques', async ({ page }) => {
    await completeSpeciesCivilizationBackground(page, 'Acolyte');
    await pickCarouselCard(page, 'cls-pretre');
    await pickCarouselCard(page, 'subcls-domaine-de-la-vie');
    await expectStepHeading(page, /Essence & Attributs/i);
  });
});
