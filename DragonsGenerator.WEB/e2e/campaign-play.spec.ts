import { test, expect, type Page } from '@playwright/test';
import { loginViaUi } from './helpers/auth';
import { createPlayableCampaign } from './helpers/campaign';

async function confirmInApp(page: Page, title: string): Promise<void> {
  const dialog = page.getByRole('dialog').filter({ hasText: title });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Terminer', exact: true }).click();
}

test.describe('Mode table MJ', () => {
  test('session → combat → collecte init → fin combat → fin session', async ({ page }) => {
    test.setTimeout(120_000);

    await loginViaUi(page, '/');
    const campaignId = await createPlayableCampaign(page);
    await page.goto(`/campaigns/${campaignId}/play`);

    await expect(page.getByRole('button', { name: 'Entrer en session' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Entrer en session' }).click();

    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('navigation', { name: 'Sections de la session' })).toBeVisible();
    await page.getByRole('button', { name: 'Combattre' }).click();

    await page.getByRole('button', { name: '+ Allié PNJ' }).click();
    await page.getByRole('button', { name: '+ Adversaire', exact: true }).click();
    await page.getByRole('button', { name: 'Adversaire vierge' }).click();

    await page.getByRole('button', { name: 'Continuer → Initiative' }).click();
    await expect(page.getByText(/Collecte ouverte/i)).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Fin combat' }).first().click();
    await confirmInApp(page, 'Terminer le combat');

    await expect(
      page.getByRole('navigation', { name: 'Sections de la session' }).getByRole('button', { name: 'Résumé' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Combattre' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Sections de la session' }).getByRole('button', { name: 'Donjon' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Terminer la session' }).click();
    await confirmInApp(page, 'Terminer la session');

    await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}$`), { timeout: 20_000 });
    await expect(page.getByText('Table de jeu — session en cours')).not.toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Résumé' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Sections de la campagne' }).getByRole('button', { name: 'Préparation' }),
    ).toBeVisible();
  });

  test('notes calepin persistent après navigation onglets', async ({ page }) => {
    test.setTimeout(90_000);

    await loginViaUi(page, '/');
    const campaignId = await createPlayableCampaign(page);
    await page.goto(`/campaigns/${campaignId}/play`);

    await page.getByRole('button', { name: 'Entrer en session' }).click();
    await expect(page.getByText('Table de jeu — session en cours')).toBeVisible({ timeout: 15_000 });

    await page
      .getByRole('navigation', { name: 'Sections de la session' })
      .getByRole('button', { name: 'Notes' })
      .click();
    const marker = `e2e-note-${Date.now()}`;
    const notesField = page.getByRole('article').getByPlaceholder('Scènes, PNJ, décisions des joueurs…');
    await expect(notesField).toBeVisible({ timeout: 15_000 });
    await notesField.fill(marker);

    await page
      .getByRole('navigation', { name: 'Sections de la session' })
      .getByRole('button', { name: 'Résumé' })
      .click();
    await page
      .getByRole('navigation', { name: 'Sections de la session' })
      .getByRole('button', { name: 'Notes' })
      .click();
    await expect(notesField).toHaveValue(marker, { timeout: 15_000 });
  });
});
