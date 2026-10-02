import { test, expect, type Page } from '@playwright/test';
import { applyAuthSession, registerConfirmAndLogin } from './helpers/auth';
import {
  startFreshWizard,
  pickCarouselCard,
  incrementAbility,
  expectStepHeading,
} from './helpers/wizard';
import { completeSpeciesCivilizationBackground } from './helpers/wizard-paths';

/** Clique les N premières cartes de sorts visibles dans la grille Magie. */
async function pickFirstMagicCards(page: Page, count: number): Promise<void> {
  const cards = page.locator('.magic-spell-grid > div').filter({ visible: true });
  await expect(cards.first()).toBeVisible({ timeout: 20_000 });
  const n = Math.min(count, await cards.count());
  for (let i = 0; i < n; i++) {
    await cards.nth(i).click();
  }
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

    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Intelligence', 5);
    await incrementAbility(page, 'Constitution', 4);
    await incrementAbility(page, 'Dextérité', 3);
    await page.getByRole('button', { name: 'Valider et continuer' }).click();

    await expectStepHeading(page, /Savoirs & Maîtrises/i);
    const bgSkills = page
      .locator('div.rounded-2xl')
      .filter({ hasText: '1 compétence(s) fixe(s) + 1 au choix' });
    if (await bgSkills.isVisible().catch(() => false)) {
      await bgSkills.getByRole('button').first().click();
    }
    const classSkills = page
      .locator('div.rounded-2xl')
      .filter({ hasText: /Choisissez \d+ compétence/i });
    if (await classSkills.isVisible().catch(() => false)) {
      const btns = classSkills.getByRole('button');
      const need = Number(((await classSkills.textContent()) ?? '').match(/Choisissez (\d+)/)?.[1] ?? 2);
      for (let i = 0; i < need; i++) await btns.nth(i).click();
    }
    await page.getByRole('button', { name: 'Forger les maîtrises' }).click();

    await expectStepHeading(page, /Arsenal de Départ/i);
    const confirmEq = page.getByTestId('wizard-equipment-confirm');
    for (let i = 0; i < 15 && (await confirmEq.isDisabled().catch(() => true)); i++) {
      const next = page.getByRole('button', { name: 'Choix suivant' });
      if (await next.isVisible().catch(() => false)) await next.click();
      const card = page.locator('.perf-card').first();
      if (await card.isVisible().catch(() => false)) await card.click();
      const option = page.getByRole('button').filter({ hasText: /^(Dague|Bâton|Sac|Arc|Épée|Fronde)/i });
      if ((await option.count()) > 0) await option.first().click();
    }
    await expect(confirmEq).toBeEnabled({ timeout: 20_000 });
    await confirmEq.click();

    await expectStepHeading(page, /Langues & Dialectes/i);
    const confirmLang = page.getByRole('button', { name: 'Inscrire ces langues au registre' });
    for (const lang of ['Arolave', 'Aupuniwi', 'Cyfand', 'Elfique', 'Gnome', 'Nain']) {
      if (!(await confirmLang.isDisabled())) break;
      const btn = page.getByRole('button', { name: new RegExp(`^${lang}\\b`) });
      if (await btn.isVisible().catch(() => false)) await btn.click();
    }
    await expect(confirmLang).toBeEnabled({ timeout: 10_000 });
    await confirmLang.click();

    await expectStepHeading(page, /Sorts & Incantations/i);
    await pickFirstMagicCards(page, 3);
    // Grimoire : basculer évent. sur sorts niv.1 puis en reprendre.
    await pickFirstMagicCards(page, 12);
    const confirmMagic = page.locator('#btn-confirm-magic');
    await expect(confirmMagic).toBeEnabled({ timeout: 30_000 });
    await confirmMagic.click();
    await page.getByRole('button', { name: /Continuer/i }).click();

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

    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Sagesse', 5);
    await incrementAbility(page, 'Constitution', 4);
    await incrementAbility(page, 'Dextérité', 3);
    await page.getByRole('button', { name: 'Valider et continuer' }).click();

    await expectStepHeading(page, /Savoirs & Maîtrises/i);
    const classSkills = page
      .locator('div.rounded-2xl')
      .filter({ hasText: /Choisissez \d+ compétence/i });
    if (await classSkills.isVisible().catch(() => false)) {
      const btns = classSkills.getByRole('button');
      const need = Number(((await classSkills.textContent()) ?? '').match(/Choisissez (\d+)/)?.[1] ?? 2);
      for (let i = 0; i < need; i++) await btns.nth(i).click();
    }
    await page.getByRole('button', { name: 'Forger les maîtrises' }).click();

    await expectStepHeading(page, /Arsenal de Départ/i);
    const confirmEq = page.getByTestId('wizard-equipment-confirm');
    for (let i = 0; i < 15 && (await confirmEq.isDisabled().catch(() => true)); i++) {
      const next = page.getByRole('button', { name: 'Choix suivant' });
      if (await next.isVisible().catch(() => false)) await next.click();
      const card = page.locator('.perf-card').first();
      if (await card.isVisible().catch(() => false)) await card.click();
      const option = page.getByRole('button').filter({ hasText: /^(Masse|Bouclier|Armure|Sac|Symbol)/i });
      if ((await option.count()) > 0) await option.first().click();
    }
    await expect(confirmEq).toBeEnabled({ timeout: 20_000 });
    await confirmEq.click();

    await expectStepHeading(page, /Langues & Dialectes/i);
    const confirmLang = page.getByRole('button', { name: 'Inscrire ces langues au registre' });
    if (await confirmLang.isDisabled()) {
      for (const lang of ['Arolave', 'Céleste', 'Elfique', 'Nain']) {
        if (!(await confirmLang.isDisabled())) break;
        const btn = page.getByRole('button', { name: new RegExp(`^${lang}\\b`) });
        if (await btn.isVisible().catch(() => false)) await btn.click();
      }
    }
    await expect(confirmLang).toBeEnabled({ timeout: 10_000 });
    await confirmLang.click();

    await expectStepHeading(page, /Sorts & Incantations/i);
    const deityCard = page.locator('button').filter({ has: page.locator('.font-serif.text-amber-400') });
    if ((await deityCard.count()) > 0) await deityCard.first().click();
    await pickFirstMagicCards(page, 3);
    const confirmMagic = page.locator('#btn-confirm-magic');
    await expect(confirmMagic).toBeEnabled({ timeout: 30_000 });
    await confirmMagic.click();
    await expect(page.getByText(/Sorts mémorisés/i)).toBeVisible({ timeout: 10_000 });
  });
});
