import { test, expect } from '@playwright/test';
import { applyAuthSession, loginSeedSession } from './helpers/auth';
import {
  createCampaignAs,
  setSessionModeAs,
  startActiveSessionAs,
} from './helpers/campaign';

/**
 * Checklist automatisée hub → session → Codex → table (frictions soirée).
 * Complète campaign-play-smoke / campaign-codex-table sans duplicata combat long.
 */
test.describe('Audit soirée — hub → Codex → table', () => {
  test('session → CTA Codex → rencontre → Lancer le combat sans frottement', async ({ page }) => {
    test.setTimeout(150_000);

    const owner = await loginSeedSession(page.request);
    const campaignId = await createCampaignAs(page, owner, `E2E Soirée Audit ${Date.now()}`);
    const sessionId = await startActiveSessionAs(page, owner, campaignId);
    await setSessionModeAs(page, owner, campaignId, sessionId, 'in_person');

    await applyAuthSession(page, owner, `/campaigns/${campaignId}`);
    await expect(page.getByRole('button', { name: 'Session en cours' })).toBeVisible({
      timeout: 30_000,
    });

    // Préparation → Rencontres : empty state lisible
    await page.getByRole('button', { name: /Prépa|Préparation/i }).first().click();
    const encTab = page.getByRole('button', { name: /^Rencontres$/i }).first();
    if (await encTab.isVisible().catch(() => false)) {
      await encTab.click();
    }

    // Codex → table + rencontre
    await page.goto('/creatures/cre-guerrier-gobelin');
    await expect(page.getByRole('heading', { name: /Guerrier gobelin/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Ajouter à la table/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ajouter à une rencontre/i })).toBeVisible();

    await page.getByRole('button', { name: /Ajouter à une rencontre/i }).click();
    await expect(page.getByText(/nouvelle rencontre|ajouté à/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: /Voir les rencontres/i })).toBeVisible();

    await page.getByRole('button', { name: /Ajouter à la table/i }).click();
    await expect(page.getByText(/ajouté à la table/i)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: /Voir la table/i }).click();

    await expect(page).toHaveURL(new RegExp(`/campaigns/${campaignId}/play`), {
      timeout: 20_000,
    });
    await expect(page.getByText(/ajouté depuis le Codex|Table de jeu/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const encPlay = page.getByRole('button', { name: /Rencontres|Renc\.?/i }).first();
    await encPlay.click();
    await expect(page.getByRole('button', { name: /Lancer le combat|\+ Au combat/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /Lancer le combat|\+ Au combat/i }).click();
    await expect(page.getByText(/Guerrier gobelin/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
