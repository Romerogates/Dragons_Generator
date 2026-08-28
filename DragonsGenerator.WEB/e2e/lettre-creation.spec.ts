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
    await page.getByTestId('wizard-civ-civ-ajagar').click();
    await page.getByRole('button', { name: 'Forger ses origines' }).click();

    // 3 — Historique : Érudit
    await expectStepHeading(page, /Historique/i);
    await page.getByTestId('wizard-bg-bg-erudit').click();
    await page.getByRole('button', { name: "Valider l'Historique" }).click();

    // 4 — Classe : Lettré + 2 astuces
    await expect(page.getByText('La Vocation')).toBeVisible({ timeout: 20_000 });
    await pickCarouselCard(page, 'cls-lettre');
    await expect(page.getByText(/Astuces initiales/i)).toBeVisible({ timeout: 15_000 });
    await pickCarouselCard(page, 'feat-astuce-audace');
    await pickCarouselCard(page, 'feat-astuce-brio');

    // 5 — Caractéristiques (15 pts : Int 15, Dex 14, Con 13)
    await expectStepHeading(page, /Essence & Attributs/i);
    await incrementAbility(page, 'Intelligence', 5);
    await incrementAbility(page, 'Dextérité', 4);
    await incrementAbility(page, 'Constitution', 3);
    await page.getByRole('button', { name: 'Valider et continuer' }).click();

    // 6 — Savoirs & Maîtrises
    await expect(page.getByText('Savoirs & Maîtrises')).toBeVisible({ timeout: 20_000 });
    // Historique Érudit : 1 compétence au choix
    await page.getByRole('button', { name: 'Arcanes', exact: true }).click();
    // 3 compétences de classe
    await page.getByRole('button', { name: 'Investigation', exact: true }).click();
    await page.getByRole('button', { name: 'Perception', exact: true }).click();
    await page.getByRole('button', { name: 'Persuasion', exact: true }).click();
    // 2 armes de classe (≤ 25 po)
    const weaponsSection = page.getByTestId('wizard-class-weapons');
    await weaponsSection.getByRole('button', { name: 'Épée courte' }).click();
    await weaponsSection.getByRole('button', { name: 'Arbalète légère' }).click();
    // 3 outils de classe
    const toolsSection = page.getByTestId('wizard-class-tools');
    await toolsSection.getByRole('button', { name: 'Lyre' }).click();
    await toolsSection.getByRole('button', { name: 'Dés' }).click();
    await toolsSection.getByRole('button', { name: 'Échecs' }).click();
    await page.getByRole('button', { name: 'Forger les maîtrises' }).click();

    // 7 — Équipement
    await expect(page.getByText('Équipement automatique reçu')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Choix suivant' }).click();
    // Slot 2 : arme maîtrisée
    await page.locator('div.cursor-pointer').filter({ hasText: /Arme.*maîtrisée/i }).first().click();
    await page.getByRole('button', { name: 'Épée courte' }).click();
    await page.getByRole('button', { name: 'Choix suivant' }).click();
    // Slot 3 : sac
    await page.locator('div.cursor-pointer').filter({ hasText: /Sac d'érudit/i }).first().click();
    await page.getByTestId('wizard-equipment-confirm').click();

    // 8 — Langues (6 bonus : Humain×2 + Érudit×1 + Lettré×3)
    await expectStepHeading(page, /Langues & Dialectes/i);
    const confirmLang = page.getByRole('button', { name: 'Inscrire ces langues au registre' });
    for (let guard = 0; guard < 12 && (await confirmLang.isDisabled()); guard++) {
      await page.locator('.grid.grid-cols-1.sm\\:grid-cols-2 button').first().click();
    }
    await expect(confirmLang).toBeEnabled({ timeout: 10_000 });
    await confirmLang.click();

    // 9 — Identité
    await expectStepHeading(page, /Identité & Personnalité/i);
    await page.getByTestId('wizard-identity-name').fill('Valerius le Lettré');
    await page.getByRole('button', { name: "Finaliser l'identité" }).click();

    // 10 — Récapitulatif
    await expectStepHeading(page, /Le Destin Scellé/i);
    await expect(page.getByRole('button', { name: 'Sauvegarder le héros' })).toBeVisible();
    await expect(page.getByText(/Lettré|Humains|Ajagar|Érudit/i).first()).toBeVisible();
  });
});
