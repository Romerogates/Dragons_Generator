import { test, expect } from '@playwright/test';
import {
  startFreshWizard,
  pickCarouselCard,
  incrementAbility,
  expectStepHeading,
} from './helpers/wizard';

/**
 * E2E Lettré L1 — parcours wizard complet (10 étapes, sans sauvegarde cloud).
 * Prérequis : stack local (docker-compose.local.yml) sur :8081 ou CI équivalente.
 */
test.describe('Lettré L1 wizard', () => {
  test.beforeEach(async ({ page }) => {
    await startFreshWizard(page);
  });

  test('loads character creation and shows species step', async ({ page }) => {
    await expect(page.getByText('Choisissez votre peuple')).toBeVisible({ timeout: 15_000 });
  });

  test('reaches class step with level selector 1–20', async ({ page }) => {
    await expect(page.getByText('Choisissez votre peuple')).toBeVisible({ timeout: 15_000 });
    const levelSelect = page.getByTestId('wizard-level-select');
    await expect(levelSelect).toBeVisible();
    const options = await levelSelect.locator('option').allTextContents();
    expect(options).toContain('1');
    expect(options).toContain('20');
  });

  test('completes full Lettré L1 creation path to summary', async ({ page }) => {
    test.setTimeout(180_000);

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

    // 5 — Caractéristiques (15 pts : Int 15, Dex 14, Con 13)
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

    // 8 — Langues (6 bonus : Humain×2 + Érudit×1 + Lettré×3)
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
    await page.getByPlaceholder('Ex: Valerius').fill('Valerius le Lettré');
    await page.getByRole('button', { name: "Finaliser l'identité" }).click();

    // 10 — Récapitulatif (contenu dans l'aperçu PDF iframe)
    await expectStepHeading(page, /Le Destin Scellé/i);
    await expect(page.getByRole('button', { name: 'Sauvegarder le héros' })).toBeVisible();
    await expect(page.locator('iframe[title="Aperçu de la fiche de personnage"]')).toBeVisible({
      timeout: 30_000,
    });
  });
});
