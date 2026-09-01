import { expect, type Page } from '@playwright/test';
import {
  expectStepHeading,
  incrementAbility,
  pickCarouselCard,
  startFreshWizard,
} from './wizard';

export { startFreshWizard, expectStepHeading, pickCarouselCard, incrementAbility };

/** Parcours commun : Humain → Ajagar → historique prédéfini. */
export async function completeSpeciesCivilizationBackground(
  page: Page,
  backgroundName: string | RegExp,
): Promise<void> {
  await expectStepHeading(page, /Choisissez votre peuple/i);
  await pickCarouselCard(page, 'sp-humain');
  await expectStepHeading(page, /L'Atlas d'Eana/i);

  await page.getByRole('button', { name: 'Ajagar', exact: true }).click();
  await page.getByRole('button', { name: 'Forger ses origines' }).click();

  await expectStepHeading(page, /Historique/i);
  await page
    .locator('button')
    .filter({ has: page.getByRole('heading', { name: backgroundName }) })
    .click();
  await page.getByRole('button', { name: "Valider l'Historique" }).click();
}

export async function completeAbilitiesStandard(
  page: Page,
  primary: { label: string; points: number },
  secondary: { label: string; points: number },
  tertiary: { label: string; points: number },
): Promise<void> {
  await expectStepHeading(page, /Essence & Attributs/i);
  await incrementAbility(page, primary.label, primary.points);
  await incrementAbility(page, secondary.label, secondary.points);
  await incrementAbility(page, tertiary.label, tertiary.points);
  await page.getByRole('button', { name: 'Valider et continuer' }).click();
}

export async function pickClassSkills(
  page: Page,
  skillNames: string[],
): Promise<void> {
  const classSkills = page
    .locator('div.rounded-2xl')
    .filter({ hasText: /compétence\(s\) liées à votre vocation/i });
  for (const name of skillNames) {
    await classSkills.getByRole('button', { name: new RegExp(`^${name}\\b`) }).click();
  }
}

export async function confirmSkillsStep(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Forger les maîtrises' }).click();
}

export async function completeEquipmentStep(page: Page): Promise<void> {
  await expectStepHeading(page, /Arsenal de Départ/i);
  const confirm = page.getByTestId('wizard-equipment-confirm');

  for (let attempt = 0; attempt < 20 && (await confirm.isDisabled()); attempt++) {
    const next = page.getByRole('button', { name: 'Choix suivant' });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      continue;
    }
    const card = page.locator('.perf-card').filter({ visible: true }).first();
    if ((await card.count()) > 0) {
      await card.click();
    }
  }

  await expect(confirm).toBeEnabled({ timeout: 15_000 });
  await confirm.click();
}

export async function completeLanguagesStep(page: Page): Promise<void> {
  await expectStepHeading(page, /Langues & Dialectes/i);
  const confirm = page.getByRole('button', { name: 'Inscrire ces langues au registre' });
  const bonusLanguages = [
    'Arolave',
    'Aupuniwi',
    'Cyfand',
    'Cyrillan',
    'Elfique',
    'Gnome',
    'Nain',
    'Orc',
  ];

  for (let round = 0; round < 12 && (await confirm.isDisabled()); round++) {
    for (const lang of bonusLanguages) {
      if (!(await confirm.isDisabled())) break;
      const btn = page.getByRole('button', { name: new RegExp(`^${lang}\\b`) });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
      }
    }
  }

  await expect(confirm).toBeEnabled({ timeout: 15_000 });
  await confirm.click();
}

export async function completeMagicStep(page: Page, options?: { cleric?: boolean }): Promise<void> {
  await expectStepHeading(page, /Grimoire & Incantations/i);
  const confirm = page.getByRole('button', { name: 'Sceller le Grimoire' });
  await expect(confirm).toBeVisible({ timeout: 30_000 });

  if (options?.cleric) {
    const deityHeading = page.getByRole('heading', { name: /Divinité vénérée/i });
    if (await deityHeading.isVisible().catch(() => false)) {
      const deityCard = page
        .locator('button')
        .filter({ has: page.locator('.text-amber-400') })
        .first();
      await deityCard.click();
    }
  }

  for (let attempt = 0; attempt < 40 && (await confirm.isDisabled()); attempt++) {
    const cards = page.locator('.magic-spell-grid .cursor-pointer').filter({ visible: true });
    const count = await cards.count();
    if (count === 0) break;
    await cards.nth(attempt % count).click();
  }

  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
}

export async function completeIdentityStep(page: Page, name: string): Promise<void> {
  await expectStepHeading(page, /Identité & Personnalité/i);
  await page.getByPlaceholder(/Ex: Valerius/i).fill(name);
  await page.getByRole('button', { name: "Finaliser l'identité" }).click();
}

export async function expectSummaryWithPdf(page: Page): Promise<void> {
  await expectStepHeading(page, /Le Destin Scellé/i);
  await expect(page.getByRole('button', { name: 'Sauvegarder le héros' })).toBeVisible();
  await expect(page.locator('iframe[title="Aperçu de la fiche de personnage"]')).toBeVisible({
    timeout: 30_000,
  });
}
