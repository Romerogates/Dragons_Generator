import { test, expect, type Locator, type Page } from '@playwright/test';
import { applyAuthSession, registerConfirmAndLogin } from './helpers/auth';
import {
  startFreshWizard,
  pickCarouselCard,
  incrementAbility,
  expectStepHeading,
  finishClassStep,
} from './helpers/wizard';
import { completeSpeciesCivilizationBackground } from './helpers/wizard-paths';

/** Magie : tours puis sorts libres (non cochés, non grisés) jusqu'à pouvoir confirmer. */
async function fillMagic(page: Page): Promise<void> {
  const confirm = page.locator('#btn-confirm-magic');
  const freeIn = (section: string) =>
    page.locator(
      `${section} .magic-spell-grid > div:not(.pointer-events-none):not([data-selected="true"])`,
    );
  await expect(page.locator('.magic-spell-grid > div').first()).toBeVisible({ timeout: 20_000 });
  for (let i = 0; i < 30 && (await confirm.isDisabled()); i++) {
    const hint = (await page.locator('.wizard-nav-hint').textContent().catch(() => '')) ?? '';
    const free = /tour/i.test(hint) ? freeIn('#section-cantrips') : freeIn('#section-level-1');
    if ((await free.count()) === 0) break;
    await free.first().dispatchEvent('click');
  }
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
}

/** Compétences de classe : ignore celles déjà accordées par l’historique (boutons désactivés). */
async function pickClassSkills(classSkills: Locator): Promise<void> {
  if (!(await classSkills.isVisible().catch(() => false))) return;
  const need = Number(((await classSkills.textContent()) ?? '').match(/Choisissez (\d+)/)?.[1] ?? 2);
  // Clic DOM (dispatchEvent) : les pastilles grossissent / la barre bouge pendant un clic souris.
  const free = classSkills.locator('button:enabled:not(.bg-emerald-500)');
  const counter = classSkills.getByText(new RegExp(`^\\s*${need} / ${need}\\s*$`));
  for (let i = 0; i < need * 3 && !(await counter.isVisible()); i++) {
    await free.first().dispatchEvent('click');
  }
  await expect(counter).toBeVisible({ timeout: 5_000 });
}

/** Reste de l'étape Compétences (outils d'historique, etc.) : un choix libre à la fois jusqu'à « Forger ». */
async function forgeSkills(page: Page): Promise<void> {
  await pickClassSkills(page.getByTestId('wizard-class-skills'));
  const forge = page.getByRole('button', { name: 'Forger les maîtrises' });
  const free = page.locator('app-skills-step button.bg-slate-900:enabled');
  for (let i = 0; i < 20 && (await forge.isDisabled()); i++) {
    if ((await free.count()) === 0) break;
    await free.first().dispatchEvent('click');
  }
  await expect(forge).toBeEnabled({ timeout: 10_000 });
  await forge.click();
}

/** Langues bonus : n'importe lesquelles proposées, jusqu'à pouvoir valider. */
async function pickLanguages(page: Page): Promise<void> {
  const confirm = page.getByRole('button', { name: 'Inscrire ces langues au registre' });
  const pick = page.getByTestId('language-pick');
  for (let i = 0; i < 8 && (await confirm.isDisabled()); i++) {
    if ((await pick.count()) === 0) break;
    await pick.first().dispatchEvent('click');
  }
  await expect(confirm).toBeEnabled({ timeout: 10_000 });
  await confirm.click();
}

/**
 * E2E Magicien / Prêtre — Magie (+ save Magicien, pattern lettre-save).
 */
test.describe('Caster forge — Magie + save', () => {
  test('Magicien L1 : magie → identité → sauvegarde', async ({ page, request }) => {
    test.setTimeout(300_000);

    const session = await registerConfirmAndLogin(request, 'WizardSave');
    await applyAuthSession(page, session, '/create');
    await startFreshWizard(page);

    await completeSpeciesCivilizationBackground(page, 'Érudit');
    await pickCarouselCard(page, 'cls-magicien');
    await finishClassStep(page);

    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Intelligence', 5);
    await incrementAbility(page, 'Constitution', 4);
    await incrementAbility(page, 'Dextérité', 3);
    await page.getByRole('button', { name: 'Valider et continuer' }).first().click();

    await expectStepHeading(page, /Savoirs & Maîtrises/i);
    const bgSkills = page.getByTestId('wizard-bg-skills');
    if (await bgSkills.isVisible().catch(() => false)) {
      const chooseBtn = bgSkills.getByRole('button').first();
      if (await chooseBtn.isVisible().catch(() => false)) await chooseBtn.click();
    }
    await forgeSkills(page);

    await expectStepHeading(page, /Arsenal de Départ/i);
    const confirmEq = page.getByTestId('wizard-equipment-confirm');
    for (let i = 0; i < 15 && (await confirmEq.isDisabled().catch(() => true)); i++) {
      const next = page.getByRole('button', { name: 'Choix suivant' });
      if (await next.isVisible().catch(() => false)) await next.click({ timeout: 3_000 }).catch(() => {});
      const card = page.locator('.perf-card').first();
      if (await card.isVisible().catch(() => false)) await card.click({ timeout: 3_000 }).catch(() => {});
      const option = page.getByRole('button').filter({ hasText: /^(Dague|Bâton|Sac|Arc|Épée|Fronde)/i });
      if ((await option.count()) > 0) await option.first().click({ timeout: 3_000 }).catch(() => {});
    }
    await expect(confirmEq).toBeEnabled({ timeout: 20_000 });
    await confirmEq.click();

    await expectStepHeading(page, /Langues & Dialectes/i);
    await pickLanguages(page);

    await expectStepHeading(page, /Sorts & Incantations/i);
    await fillMagic(page);

    await expectStepHeading(page, /Identité & Personnalité/i);
    await page.getByPlaceholder('Ex: Valerius').fill('Aldric Magicien E2E');
    await page.getByRole('button', { name: "Finaliser l'identité" }).click();

    await expectStepHeading(page, /Le Destin Scellé/i);
    await page.getByRole('button', { name: 'Sauvegarder le héros' }).click();
    await expect(page).toHaveURL(/\/character-sheet/, { timeout: 45_000 });
    await expect(page.getByText(/Aldric Magicien E2E/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('Prêtre L1 : Magie (cantrips + divinité) confirmée', async ({ page }) => {
    test.setTimeout(240_000);
    await startFreshWizard(page);

    await completeSpeciesCivilizationBackground(page, 'Acolyte');
    await pickCarouselCard(page, 'cls-pretre');
    await pickCarouselCard(page, 'subcls-domaine-de-la-vie');
    await finishClassStep(page);

    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Sagesse', 5);
    await incrementAbility(page, 'Constitution', 4);
    await incrementAbility(page, 'Dextérité', 3);
    await page.getByRole('button', { name: 'Valider et continuer' }).first().click();

    await expectStepHeading(page, /Savoirs & Maîtrises/i);
    await forgeSkills(page);

    await expectStepHeading(page, /Arsenal de Départ/i);
    const confirmEq = page.getByTestId('wizard-equipment-confirm');
    for (let i = 0; i < 15 && (await confirmEq.isDisabled().catch(() => true)); i++) {
      const next = page.getByRole('button', { name: 'Choix suivant' });
      if (await next.isVisible().catch(() => false)) await next.click({ timeout: 3_000 }).catch(() => {});
      const card = page.locator('.perf-card').first();
      if (await card.isVisible().catch(() => false)) await card.click({ timeout: 3_000 }).catch(() => {});
      const option = page.getByRole('button').filter({ hasText: /^(Masse|Bouclier|Armure|Sac|Symbol)/i });
      if ((await option.count()) > 0) await option.first().click({ timeout: 3_000 }).catch(() => {});
    }
    await expect(confirmEq).toBeEnabled({ timeout: 20_000 });
    await confirmEq.click();

    await expectStepHeading(page, /Langues & Dialectes/i);
    await pickLanguages(page);

    await expectStepHeading(page, /Sorts & Incantations/i);
    const deityCard = page.locator('button').filter({ has: page.locator('.font-serif.text-amber-400') });
    if ((await deityCard.count()) > 0) await deityCard.first().dispatchEvent('click');
    await fillMagic(page);
    await expectStepHeading(page, /Identité & Personnalité/i);
  });
});
