import { test, expect } from '@playwright/test';
import { applyAuthSession, registerConfirmAndLogin } from './helpers/auth';
import {
  startFreshWizard,
  pickCarouselCard,
  incrementAbility,
  expectStepHeading,
} from './helpers/wizard';

/**
 * E2E forge bout-en-bout — Lettré L1 → récap → sauvegarde cloud → fiche.
 * Compte frais pour éviter la limite de personnages du seed.
 */
test.describe('Lettré L1 save', () => {
  test('creates, saves, and opens character sheet', async ({ page, request }) => {
    test.setTimeout(240_000);

    const session = await registerConfirmAndLogin(request, 'LettreSave');
    await applyAuthSession(page, session, '/create');
    await startFreshWizard(page);

    // 1 — Espèce : Humains
    await expectStepHeading(page, /Choisissez votre peuple/i);
    await pickCarouselCard(page, 'sp-humain');
    await expectStepHeading(page, /L'Atlas d'Eana/i);

    // 2 — Civilisation : Ajagar
    await expectStepHeading(page, /L'Atlas d'Eana/i);
    await page.getByRole('button', { name: 'Ajagar', exact: true }).click();
    await page.getByRole('button', { name: 'Forger ses origines' }).click();

    // 3 — Historique : Érudit
    await expectStepHeading(page, /Historique/i);
    await page.locator('button').filter({ has: page.getByRole('heading', { name: 'Érudit' }) }).click();
    await page.getByRole('button', { name: "Valider l'Historique" }).click();

    // 4 — Classe : Lettré + 2 astuces
    await expect(page.getByText('La Vocation')).toBeVisible({ timeout: 20_000 });
    await pickCarouselCard(page, 'cls-lettre', { clickCount: 1 });
    await expect(page.getByText(/Astuces initiales/i)).toBeVisible({ timeout: 15_000 });
    await pickCarouselCard(page, 'feat-astuce-audace', { clickCount: 1 });
    await pickCarouselCard(page, 'feat-astuce-brio', { clickCount: 1 });

    // 5 — Caractéristiques
    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Intelligence', 5);
    await incrementAbility(page, 'Dextérité', 4);
    await incrementAbility(page, 'Constitution', 3);
    await page.getByRole('button', { name: 'Valider et continuer' }).click();

    // 6 — Savoirs & Maîtrises
    await expectStepHeading(page, /Savoirs & Maîtrises/i);
    const bgSkills = page
      .locator('div.rounded-2xl')
      .filter({ hasText: '1 compétence(s) fixe(s) + 1 au choix' });
    await bgSkills.getByRole('button', { name: /^Arcanes\b/ }).click();
    const classSkills = page
      .locator('div.rounded-2xl')
      .filter({ hasText: 'Choisissez 3 compétence(s) liées à votre vocation' });
    await classSkills.getByRole('button', { name: /^Investigation\b/ }).click();
    await classSkills.getByRole('button', { name: /^Perception\b/ }).click();
    await classSkills.getByRole('button', { name: /^Persuasion\b/ }).click();
    const weaponsSection = page.getByTestId('wizard-class-weapons');
    await weaponsSection.getByRole('button', { name: 'Épée courte', exact: true }).click();
    await weaponsSection.getByRole('button', { name: 'Arbalète légère', exact: true }).click();
    const toolsSection = page.getByTestId('wizard-class-tools');
    await toolsSection.getByRole('button', { name: 'Lyre', exact: true }).click();
    await toolsSection.getByRole('button', { name: 'Dés', exact: true }).click();
    await toolsSection.getByRole('button', { name: 'Échecs', exact: true }).click();
    await page.getByRole('button', { name: 'Forger les maîtrises' }).click();

    // 7 — Équipement
    await expectStepHeading(page, /Arsenal de Départ/i);
    await page.getByRole('button', { name: 'Choix suivant' }).click();
    await page.locator('.perf-card').filter({ hasText: /Arme.*maîtrisée/i }).click();
    await page.getByRole('button', { name: /^Épée courte\b/ }).click();
    await page.locator('.perf-card').filter({ hasText: /Sac d'érudit/i }).click();
    await page.getByTestId('wizard-equipment-confirm').click();

    // 8 — Langues
    await expectStepHeading(page, /Langues & Dialectes/i);
    const confirmLang = page.getByRole('button', { name: 'Inscrire ces langues au registre' });
    const bonusLanguages = ['Arolave', 'Aupuniwi', 'Cyfand', 'Cyrillan', 'Elfique', 'Gnome'];
    for (const lang of bonusLanguages) {
      if (!(await confirmLang.isDisabled())) break;
      await page.getByRole('button', { name: new RegExp(`^${lang}\\b`) }).click();
    }
    await expect(confirmLang).toBeEnabled({ timeout: 10_000 });
    await confirmLang.click();

    // 9 — Identité
    await expectStepHeading(page, /Identité & Personnalité/i);
    await page.getByPlaceholder('Ex: Valerius').fill('Valerius Save E2E');
    await page.getByRole('button', { name: "Finaliser l'identité" }).click();

    // 10 — Récap + sauvegarde
    await expectStepHeading(page, /Le Destin Scellé/i);
    const saveBtn = page.getByRole('button', { name: 'Sauvegarder le héros' });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    await expect(page).toHaveURL(/\/character-sheet/, { timeout: 45_000 });
    await expect(page.getByText(/Valerius Save E2E/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
