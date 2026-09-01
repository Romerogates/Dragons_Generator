import { test } from '@playwright/test';
import {
  completeAbilitiesStandard,
  completeEquipmentStep,
  completeIdentityStep,
  completeLanguagesStep,
  completeMagicStep,
  completeSpeciesCivilizationBackground,
  confirmSkillsStep,
  expectSummaryWithPdf,
  pickCarouselCard,
  pickClassSkills,
  startFreshWizard,
} from './helpers/wizard-paths';
import { expectStepHeading } from './helpers/wizard';

test.describe('Wizard — classes clés', () => {
  test.beforeEach(async ({ page }) => {
    await startFreshWizard(page);
  });

  test('completes Guerrier L1 path to summary', async ({ page }) => {
    test.setTimeout(180_000);

    await completeSpeciesCivilizationBackground(page, 'Érudit');

    await expect(page.getByText('La Vocation')).toBeVisible({ timeout: 20_000 });
    await pickCarouselCard(page, 'cls-guerrier');
    await pickCarouselCard(page, 'feat-style-duel');

    await completeAbilitiesStandard(
      page,
      { label: 'Force', points: 5 },
      { label: 'Constitution', points: 4 },
      { label: 'Dextérité', points: 3 },
    );

    await expectStepHeading(page, /Savoirs & Maîtrises/i);
    await pickClassSkills(page, ['Athlétisme', 'Intimidation']);
    await confirmSkillsStep(page);

    await completeEquipmentStep(page);
    await completeLanguagesStep(page);
    await completeIdentityStep(page, 'Marcus le Guerrier');
    await expectSummaryWithPdf(page);
  });

  test('completes Magicien L1 path to summary', async ({ page }) => {
    test.setTimeout(240_000);

    await completeSpeciesCivilizationBackground(page, 'Érudit');

    await expect(page.getByText('La Vocation')).toBeVisible({ timeout: 20_000 });
    await pickCarouselCard(page, 'cls-magicien');

    await completeAbilitiesStandard(
      page,
      { label: 'Intelligence', points: 5 },
      { label: 'Constitution', points: 4 },
      { label: 'Dextérité', points: 3 },
    );

    await expectStepHeading(page, /Savoirs & Maîtrises/i);
    await pickClassSkills(page, ['Arcanes', 'Investigation']);
    const toolsSection = page.getByTestId('wizard-class-tools');
    if (await toolsSection.isVisible().catch(() => false)) {
      await toolsSection
        .getByRole('button', { name: /Calligraphe|Alchimiste|Cartographe/i })
        .first()
        .click();
    }
    await confirmSkillsStep(page);

    await completeEquipmentStep(page);
    await completeLanguagesStep(page);
    await completeMagicStep(page);
    await completeIdentityStep(page, 'Elara la Mage');
    await expectSummaryWithPdf(page);
  });

  test('completes Prêtre L1 path to summary', async ({ page }) => {
    test.setTimeout(240_000);

    await completeSpeciesCivilizationBackground(page, 'Acolyte');

    await expect(page.getByText('La Vocation')).toBeVisible({ timeout: 20_000 });
    await pickCarouselCard(page, 'cls-pretre');
    await pickCarouselCard(page, 'subcls-domaine-de-la-vie');

    await completeAbilitiesStandard(
      page,
      { label: 'Sagesse', points: 5 },
      { label: 'Constitution', points: 4 },
      { label: 'Force', points: 3 },
    );

    await expectStepHeading(page, /Savoirs & Maîtrises/i);
    await pickClassSkills(page, ['Médecine', 'Persuasion']);
    await confirmSkillsStep(page);

    await completeEquipmentStep(page);
    await completeLanguagesStep(page);
    await completeMagicStep(page, { cleric: true });
    await completeIdentityStep(page, 'Brother Aldric');
    await expectSummaryWithPdf(page);
  });
});
