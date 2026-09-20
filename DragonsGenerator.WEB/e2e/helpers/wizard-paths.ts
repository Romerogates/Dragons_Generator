import { expect, type Page } from '@playwright/test';
import {
  expectStepHeading,
  incrementAbility,
  pickCarouselCard,
  startFreshWizard,
} from './wizard';

export { startFreshWizard, expectStepHeading, pickCarouselCard, incrementAbility };

/** Pill Atlas (toujours visible ; évite strict mode pin+pill et le crop cover). */
export async function pickCivilizationPin(page: Page, civId = 'civ-ajagar'): Promise<void> {
  await page.getByTestId(`wizard-civ-pill-${civId}`).click();
}

/** Parcours commun : Humain → Ajagar → historique prédéfini. */
export async function completeSpeciesCivilizationBackground(
  page: Page,
  backgroundName: string | RegExp,
): Promise<void> {
  await expectStepHeading(page, /Choisissez votre peuple/i);
  await pickCarouselCard(page, 'sp-humain');
  await expectStepHeading(page, /L'Atlas d'Eana/i);

  await pickCivilizationPin(page);
  await page.getByRole('button', { name: 'Forger ses origines' }).click();

  await expectStepHeading(page, /Historique/i);
  await page
    .locator('button')
    .filter({ has: page.getByRole('heading', { name: backgroundName }) })
    .click();
  await page.getByRole('button', { name: "Valider l'Historique" }).click();
  await expect(page.getByText('La Vocation')).toBeVisible({ timeout: 20_000 });
}
